const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const auth = require('../auth');

router.use(auth.authMiddleware(['customer']));

router.get('/dashboard', (req, res) => {
  res.render('customer-dashboard', { user: req.user });
});

router.get('/cart', (req, res) => {
  res.render('cart');
});

router.get('/scan-more', (req, res) => {
  res.render('scan-more');
});

router.get('/receipt/:id', (req, res) => {
  res.render('receipt', { transactionId: req.params.id });
});

// Verify merchant store QR
router.post('/api/verify-merchant', (req, res) => {
  const { qrData } = req.body;
  db.get('SELECT user_id, store_name FROM merchants WHERE store_qr_code = ?', [qrData], (err, merchant) => {
    if (err || !merchant) return res.json({ success: false, message: 'Invalid merchant QR' });
    res.json({ success: true, merchantId: merchant.user_id, storeName: merchant.store_name });
  });
});

// Verify custom product QR (token)
router.post('/api/verify-custom-product', (req, res) => {
  const { token } = req.body;
  db.get(`
    SELECT cp.id, cp.name, cp.description, cp.price_cents, cp.image_url, cp.merchant_id, m.store_name
    FROM merchant_custom_products cp
    JOIN merchants m ON cp.merchant_id = m.user_id
    WHERE cp.qr_code_token = ?
  `, [token], (err, product) => {
    if (err || !product) return res.json({ success: false, message: 'Invalid product QR code' });
    res.json({
      success: true,
      merchantId: product.merchant_id,
      storeName: product.store_name,
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price_cents,
        image_url: product.image_url
      }
    });
  });
});

// Add item by barcode (standard product)
router.post('/api/add-item', (req, res) => {
  const { merchantId, barcode } = req.body;
  db.get(`
    SELECT mp.price, mp.stock, gp.name, gp.image_url 
    FROM merchant_products mp
    JOIN global_products gp ON mp.barcode = gp.barcode
    WHERE mp.merchant_id = ? AND mp.barcode = ? AND mp.stock > 0
  `, [merchantId, barcode], (err, product) => {
    if (err || !product) return res.json({ success: false, message: 'Item not available or out of stock' });
    res.json({
      success: true,
      barcode,
      name: product.name,
      price: product.price,
      image_url: product.image_url || '',
      stock: product.stock
    });
  });
});

// Get merchant's product catalog (for browsing)
router.get('/api/merchant-products', (req, res) => {
  const { merchantId, search } = req.query;
  if (!merchantId) return res.status(400).json({ error: 'Merchant ID required' });
  let sql = `
    SELECT mp.barcode, gp.name, mp.price, gp.image_url
    FROM merchant_products mp
    JOIN global_products gp ON mp.barcode = gp.barcode
    WHERE mp.merchant_id = ? AND mp.stock > 0
  `;
  const params = [merchantId];
  if (search && search.trim() !== '') {
    sql += ` AND (gp.name LIKE ? OR gp.barcode LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ` ORDER BY gp.name LIMIT 50`;
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json([]);
    res.json(rows);
  });
});

// Checkout (fake payment)
router.post('/api/checkout', (req, res) => {
  const { merchantId, items, totalCents } = req.body;
  const customerId = req.user.userId;
  if (!items || items.length === 0) return res.status(400).json({ success: false, message: 'Cart empty' });

  const paymentAggregatorId = 'fake_' + uuidv4();
  const transactionId = uuidv4();
  const now = Math.floor(Date.now() / 1000);

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.run(`INSERT INTO transactions (id, customer_id, merchant_id, total_cents, status, payment_aggregator_id, created_at)
            VALUES (?, ?, ?, ?, 'paid', ?, ?)`,
      [transactionId, customerId, merchantId, totalCents, paymentAggregatorId, now], (err) => {
      if (err) { db.run('ROLLBACK'); return res.status(500).json({ success: false, message: 'Transaction failed' }); }

      let pending = items.length;
      let errorOccurred = false;
      items.forEach(item => {
        db.run(`INSERT INTO transaction_items (transaction_id, barcode, quantity, price_cents) VALUES (?, ?, ?, ?)`,
          [transactionId, item.barcode, item.quantity, item.price], (err2) => { if (err2) errorOccurred = true; });
        db.run(`UPDATE merchant_products SET stock = stock - ? WHERE merchant_id = ? AND barcode = ?`,
          [item.quantity, merchantId, item.barcode], (err3) => { if (err3) errorOccurred = true; });
        pending--;
        if (pending === 0) {
          if (errorOccurred) { db.run('ROLLBACK'); res.status(500).json({ success: false, message: 'Stock update failed' }); }
          else { db.run('COMMIT'); res.json({ success: true, transactionId }); }
        }
      });
    });
  });
});

// Get transaction details (for receipt)
router.get('/api/transaction/:id', (req, res) => {
  const transactionId = req.params.id;
  db.get(`SELECT * FROM transactions WHERE id = ? AND customer_id = ?`, [transactionId, req.user.userId], (err, transaction) => {
    if (err || !transaction) return res.status(404).json({ error: 'Not found' });
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

// Recent transactions (for dashboard)
router.get('/api/recent-transactions', (req, res) => {
  db.all(`
    SELECT t.id, t.total_cents, t.created_at, m.store_name
    FROM transactions t
    JOIN merchants m ON t.merchant_id = m.user_id
    WHERE t.customer_id = ? AND t.status = 'paid'
    ORDER BY t.created_at DESC LIMIT 10
  `, [req.user.userId], (err, transactions) => {
    if (err) return res.status(500).json([]);
    res.json(transactions);
  });
});

module.exports = router;