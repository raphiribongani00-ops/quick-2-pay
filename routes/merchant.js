const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const auth = require('../auth');

router.use(auth.authMiddleware(['merchant']));

router.get('/dashboard', (req, res) => {
  res.render('merchant-dashboard', { user: req.user });
});

router.get('/api/info', (req, res) => {
  const merchantId = req.user.userId;
  db.get('SELECT store_name, store_qr_code FROM merchants WHERE user_id = ?', [merchantId], (err, row) => {
    if (err || !row) return res.status(500).json({ error: 'Merchant not found' });
    res.json({ storeName: row.store_name, storeQrCode: row.store_qr_code });
  });
});

// ============ Standard products (from global catalog) ============
router.get('/api/products', (req, res) => {
  const merchantId = req.user.userId;
  db.all(`
    SELECT mp.barcode, gp.name, mp.price, mp.stock, gp.image_url
    FROM merchant_products mp
    JOIN global_products gp ON mp.barcode = gp.barcode
    WHERE mp.merchant_id = ?
    ORDER BY gp.name
  `, [merchantId], (err, products) => {
    if (err) return res.status(500).json([]);
    res.json(products);
  });
});

router.post('/api/product', (req, res) => {
  const { barcode, price, stock } = req.body;
  const merchantId = req.user.userId;
  if (!barcode || price === undefined) return res.status(400).json({ error: 'Missing barcode or price' });

  db.get('SELECT barcode FROM global_products WHERE barcode = ?', [barcode], (err, existing) => {
    if (!existing) {
      db.run('INSERT INTO global_products (barcode, name) VALUES (?, ?)', [barcode, `Product ${barcode}`], (err2) => {
        if (err2) return res.status(500).json({ error: 'Failed to create product' });
        upsertMerchantProduct();
      });
    } else {
      upsertMerchantProduct();
    }
  });

  function upsertMerchantProduct() {
    const finalStock = (stock !== undefined && stock !== null) ? stock : 999;
    db.run(
      `INSERT INTO merchant_products (merchant_id, barcode, price, stock) 
       VALUES (?, ?, ?, ?) 
       ON CONFLICT(merchant_id, barcode) DO UPDATE SET price = excluded.price, stock = excluded.stock`,
      [merchantId, barcode, price, finalStock],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  }
});

router.delete('/api/product/:barcode', (req, res) => {
  const merchantId = req.user.userId;
  const barcode = req.params.barcode;
  db.run('DELETE FROM merchant_products WHERE merchant_id = ? AND barcode = ?', [merchantId, barcode], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ============ Custom products / services ============
router.get('/api/custom-products', (req, res) => {
  const merchantId = req.user.userId;
  db.all('SELECT * FROM merchant_custom_products WHERE merchant_id = ? ORDER BY created_at DESC', [merchantId], (err, rows) => {
    if (err) return res.status(500).json([]);
    res.json(rows);
  });
});

router.post('/api/custom-products', (req, res) => {
  const { name, description, price_cents, image_url } = req.body;
  const merchantId = req.user.userId;
  if (!name || !price_cents) return res.status(400).json({ error: 'Name and price required' });
  const id = uuidv4();
  const token = uuidv4();
  db.run(
    `INSERT INTO merchant_custom_products (id, merchant_id, name, description, price_cents, image_url, qr_code_token)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, merchantId, name, description || '', price_cents, image_url || '', token],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, productId: id, qrToken: token });
    }
  );
});

router.put('/api/custom-products/:id', (req, res) => {
  const { name, description, price_cents, image_url } = req.body;
  const productId = req.params.id;
  const merchantId = req.user.userId;
  db.run(
    `UPDATE merchant_custom_products SET name = ?, description = ?, price_cents = ?, image_url = ? WHERE id = ? AND merchant_id = ?`,
    [name, description || '', price_cents, image_url || '', productId, merchantId],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

router.delete('/api/custom-products/:id', (req, res) => {
  const productId = req.params.id;
  const merchantId = req.user.userId;
  db.run('DELETE FROM merchant_custom_products WHERE id = ? AND merchant_id = ?', [productId, merchantId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ============ Transactions, revenue, complaints ============
router.get('/api/transactions', (req, res) => {
  const merchantId = req.user.userId;
  db.all(`
    SELECT t.id, t.total_cents, t.created_at, t.status, u.name as customer_name
    FROM transactions t
    JOIN users u ON t.customer_id = u.id
    WHERE t.merchant_id = ?
    ORDER BY t.created_at DESC LIMIT 50
  `, [merchantId], (err, transactions) => {
    if (err) return res.status(500).json([]);
    res.json(transactions);
  });
});

router.get('/api/transaction/:id', (req, res) => {
  const transactionId = req.params.id;
  const merchantId = req.user.userId;
  db.get(`SELECT * FROM transactions WHERE id = ? AND merchant_id = ?`, [transactionId, merchantId], (err, transaction) => {
    if (err || !transaction) return res.status(404).json({ error: 'Transaction not found' });
    db.all(`
      SELECT ti.*, gp.name, gp.image_url
      FROM transaction_items ti
      JOIN global_products gp ON ti.barcode = gp.barcode
      WHERE ti.transaction_id = ?
    `, [transactionId], (err2, items) => {
      if (err2) return res.status(500).json({ error: 'Items error' });
      res.json({ transaction, items });
    });
  });
});

router.get('/api/revenue', (req, res) => {
  const merchantId = req.user.userId;
  const now = Math.floor(Date.now() / 1000);
  const startOfDay = new Date().setHours(0,0,0,0) / 1000;
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000;
  db.get(`
    SELECT 
      SUM(CASE WHEN created_at >= ? THEN total_cents ELSE 0 END) as today,
      SUM(CASE WHEN created_at >= ? THEN total_cents ELSE 0 END) as this_month,
      SUM(total_cents) as total
    FROM transactions
    WHERE merchant_id = ? AND status = 'paid'
  `, [startOfDay, startOfMonth, merchantId], (err, row) => {
    if (err) return res.status(500).json({ today:0, this_month:0, total:0 });
    res.json({ today: row.today || 0, this_month: row.this_month || 0, total: row.total || 0 });
  });
});

router.get('/api/complaints', (req, res) => {
  const merchantId = req.user.userId;
  db.all(`
    SELECT c.id, c.message, c.resolved, c.created_at, u.name as customer_name
    FROM complaints c
    JOIN users u ON c.from_user_id = u.id
    WHERE c.merchant_id = ?
    ORDER BY c.created_at DESC
  `, [merchantId], (err, complaints) => {
    if (err) return res.status(500).json([]);
    res.json(complaints);
  });
});

router.post('/api/verify-payment', (req, res) => {
  const { transactionId } = req.body;
  const merchantId = req.user.userId;
  db.get(`SELECT * FROM transactions WHERE id = ? AND merchant_id = ? AND status = 'paid'`, [transactionId, merchantId], (err, transaction) => {
    if (err || !transaction) return res.json({ success: false, message: 'Invalid or already verified' });
    db.all(`
      SELECT ti.*, gp.name, gp.image_url
      FROM transaction_items ti
      JOIN global_products gp ON ti.barcode = gp.barcode
      WHERE ti.transaction_id = ?
    `, [transactionId], (err2, items) => {
      if (err2) return res.json({ success: false, message: 'Error fetching items' });
      res.json({ success: true, transaction, items });
    });
  });
});

router.post('/api/confirm-release', (req, res) => {
  const { transactionId } = req.body;
  const merchantId = req.user.userId;
  const now = Math.floor(Date.now() / 1000);
  db.run(`UPDATE transactions SET status = 'completed', completed_at = ? WHERE id = ? AND merchant_id = ? AND status = 'paid'`,
    [now, transactionId, merchantId], function(err) {
      if (err || this.changes === 0) return res.status(400).json({ success: false, message: 'Could not confirm' });
      res.json({ success: true });
    });
});

router.get('/api/search-global', (req, res) => {
  const query = req.query.q || '';
  db.all(`SELECT barcode, name, image_url FROM global_products WHERE barcode LIKE ? OR name LIKE ? LIMIT 10`, [`%${query}%`, `%${query}%`], (err, rows) => {
    if (err) return res.status(500).json([]);
    res.json(rows);
  });
});

module.exports = router;