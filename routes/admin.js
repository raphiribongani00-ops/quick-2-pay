const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const auth = require('../auth');

router.use(auth.authMiddleware(['admin']));

router.get('/dashboard', (req, res) => {
  res.render('admin-dashboard', { user: req.user });
});

// Products
router.get('/api/products', (req, res) => {
  db.all('SELECT barcode, name, image_url FROM global_products ORDER BY name', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});
router.post('/api/products', (req, res) => {
  const { barcode, name, image_url } = req.body;
  if (!barcode || !name) return res.status(400).json({ error: 'Barcode and name required' });
  db.run('INSERT INTO global_products (barcode, name, image_url) VALUES (?, ?, ?)', [barcode, name, image_url || ''], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});
router.put('/api/products/:barcode', (req, res) => {
  const { name, image_url } = req.body;
  const barcode = req.params.barcode;
  db.run('UPDATE global_products SET name = ?, image_url = ? WHERE barcode = ?', [name, image_url || '', barcode], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});
router.delete('/api/products/:barcode', (req, res) => {
  const barcode = req.params.barcode;
  db.run('DELETE FROM global_products WHERE barcode = ?', [barcode], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Merchants
router.get('/api/merchants', (req, res) => {
  db.all(`
    SELECT u.id, u.email, u.name as store_name, m.store_qr_code, u.created_at
    FROM users u JOIN merchants m ON u.id = m.user_id
    WHERE u.role = 'merchant' ORDER BY u.created_at DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});
router.delete('/api/merchants/:userId', (req, res) => {
  const userId = req.params.userId;
  db.run('DELETE FROM users WHERE id = ? AND role = "merchant"', [userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Merchant not found' });
    res.json({ success: true });
  });
});

// Transactions
router.get('/api/transactions', (req, res) => {
  db.all(`
    SELECT t.id, t.total_cents, t.status, t.created_at, t.completed_at, u.name as customer_name, m.store_name
    FROM transactions t
    JOIN users u ON t.customer_id = u.id
    JOIN merchants m ON t.merchant_id = m.user_id
    ORDER BY t.created_at DESC LIMIT 100
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Invoices
router.get('/api/invoices', (req, res) => {
  db.all(`
    SELECT i.*, m.store_name FROM invoices i JOIN merchants m ON i.merchant_id = m.user_id ORDER BY i.created_at DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});
router.post('/api/invoices', (req, res) => {
  const { merchant_id, period_start, period_end, total_platform_fee_cents, payout_amount_cents } = req.body;
  const id = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  db.run(`INSERT INTO invoices (id, merchant_id, period_start, period_end, total_platform_fee_cents, payout_amount_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, merchant_id, period_start, period_end, total_platform_fee_cents, payout_amount_cents, now], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, invoiceId: id });
    });
});
router.post('/api/invoices/:id/pay', (req, res) => {
  const id = req.params.id;
  db.run('UPDATE invoices SET paid = 1 WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Complaints
router.get('/api/complaints', (req, res) => {
  db.all(`
    SELECT c.*, u.name as customer_name, m.store_name
    FROM complaints c
    JOIN users u ON c.from_user_id = u.id
    JOIN merchants m ON c.merchant_id = m.user_id
    ORDER BY c.created_at DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});
router.post('/api/complaints/:id/resolve', (req, res) => {
  const id = req.params.id;
  db.run('UPDATE complaints SET resolved = 1 WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Reports
router.get('/api/reports/platform-revenue', (req, res) => {
  db.get(`SELECT SUM(total_cents) as total_volume, COUNT(*) as total_transactions, AVG(total_cents) as avg_transaction FROM transactions WHERE status = 'paid'`, (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

module.exports = router;