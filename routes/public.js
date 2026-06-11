const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const auth = require('../auth');

router.get('/', (req, res) => {
  res.render('landing');
});

// ============ CUSTOMER ============
router.get('/customer/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Customer Login - Quick 2 Pay</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-black text-white"><div class="container mx-auto max-w-md p-6 mt-20"><h1 class="text-2xl font-bold text-yellow-400 mb-6">Customer Login</h1>
    <form method="POST" action="/customer/login"><input type="email" name="email" placeholder="Email" class="w-full p-3 mb-3 rounded bg-gray-800" required><input type="password" name="password" placeholder="Password" class="w-full p-3 mb-3 rounded bg-gray-800" required><button type="submit" class="w-full bg-yellow-500 text-black py-3 rounded font-bold">Login</button></form>
    <p class="mt-4 text-center">No account? <a href="/customer/register" class="text-yellow-400">Register</a></p><p class="mt-4 text-center"><a href="/" class="text-gray-400">Back</a></p></div></body></html>
  `);
});
router.post('/customer/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ? AND role = "customer"', [email], async (err, user) => {
    if (err || !user) return res.send('Invalid credentials');
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.send('Invalid credentials');
    const token = auth.generateToken(user.id, 'customer');
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/customer/dashboard');
  });
});
router.get('/customer/register', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Customer Register - Quick 2 Pay</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-black text-white"><div class="container mx-auto max-w-md p-6 mt-20"><h1 class="text-2xl font-bold text-yellow-400 mb-6">Customer Register</h1>
    <form method="POST" action="/customer/register"><input type="text" name="name" placeholder="Full Name" class="w-full p-3 mb-3 rounded bg-gray-800" required><input type="email" name="email" placeholder="Email" class="w-full p-3 mb-3 rounded bg-gray-800" required><input type="password" name="password" placeholder="Password" class="w-full p-3 mb-3 rounded bg-gray-800" required><button type="submit" class="w-full bg-yellow-500 text-black py-3 rounded font-bold">Register</button></form>
    <p class="mt-4 text-center">Already have an account? <a href="/customer/login" class="text-yellow-400">Login</a></p><p class="mt-4 text-center"><a href="/" class="text-gray-400">Back</a></p></div></body></html>
  `);
});
router.post('/customer/register', async (req, res) => {
  const { email, password, name } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const id = uuidv4();
  db.run('INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, "customer", ?)', [id, email, hashed, name], (err) => {
    if (err) return res.send('Email already exists');
    const token = auth.generateToken(id, 'customer');
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/customer/dashboard');
  });
});

// ============ MERCHANT ============
router.get('/merchant/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Merchant Login - Quick 2 Pay</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-black text-white"><div class="container mx-auto max-w-md p-6 mt-20"><h1 class="text-2xl font-bold text-yellow-400 mb-6">Merchant Login</h1>
    <form method="POST" action="/merchant/login"><input type="email" name="email" placeholder="Email" class="w-full p-3 mb-3 rounded bg-gray-800" required><input type="password" name="password" placeholder="Password" class="w-full p-3 mb-3 rounded bg-gray-800" required><button type="submit" class="w-full bg-yellow-500 text-black py-3 rounded font-bold">Login</button></form>
    <p class="mt-4 text-center">No account? <a href="/merchant/register" class="text-yellow-400">Register</a></p><p class="mt-4 text-center"><a href="/" class="text-gray-400">Back</a></p></div></body></html>
  `);
});
router.post('/merchant/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ? AND role = "merchant"', [email], async (err, user) => {
    if (err || !user) return res.send('Invalid credentials');
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.send('Invalid credentials');
    const token = auth.generateToken(user.id, 'merchant');
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/merchant/dashboard');
  });
});
router.get('/merchant/register', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Merchant Register - Quick 2 Pay</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-black text-white"><div class="container mx-auto max-w-md p-6 mt-20"><h1 class="text-2xl font-bold text-yellow-400 mb-6">Merchant Registration</h1>
    <form method="POST" action="/merchant/register"><input type="text" name="store_name" placeholder="Store Name" class="w-full p-3 mb-3 rounded bg-gray-800" required><input type="email" name="email" placeholder="Email" class="w-full p-3 mb-3 rounded bg-gray-800" required><input type="password" name="password" placeholder="Password" class="w-full p-3 mb-3 rounded bg-gray-800" required><button type="submit" class="w-full bg-yellow-500 text-black py-3 rounded font-bold">Register</button></form>
    <p class="mt-4 text-center">Already registered? <a href="/merchant/login" class="text-yellow-400">Login</a></p><p class="mt-4 text-center"><a href="/" class="text-gray-400">Back</a></p></div></body></html>
  `);
});
router.post('/merchant/register', async (req, res) => {
  const { email, password, store_name } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const userId = uuidv4();
  const storeQr = uuidv4();
  db.run('INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, "merchant", ?)', [userId, email, hashed, store_name], (err) => {
    if (err) return res.send('Email already exists');
    db.run('INSERT INTO merchants (user_id, store_name, store_qr_code) VALUES (?, ?, ?)', [userId, store_name, storeQr], (err2) => {
      if (err2) return res.send('Error creating merchant');
      const token = auth.generateToken(userId, 'merchant');
      res.cookie('token', token, { httpOnly: true });
      res.redirect('/merchant/dashboard');
    });
  });
});

// ============ ADMIN ============
router.get('/admin/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Admin Login - Quick 2 Pay</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-black text-white"><div class="container mx-auto max-w-md p-6 mt-20"><h1 class="text-2xl font-bold text-yellow-400 mb-6">Admin Login</h1>
    <form method="POST" action="/admin/login"><input type="email" name="email" placeholder="Email" class="w-full p-3 mb-3 rounded bg-gray-800" required><input type="password" name="password" placeholder="Password" class="w-full p-3 mb-3 rounded bg-gray-800" required><button type="submit" class="w-full bg-yellow-500 text-black py-3 rounded font-bold">Login</button></form>
    <p class="mt-4 text-center"><a href="/" class="text-gray-400">Back</a></p></div></body></html>
  `);
});
router.post('/admin/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ? AND role = "admin"', [email], async (err, user) => {
    if (err || !user) return res.send('Invalid admin credentials');
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.send('Invalid credentials');
    const token = auth.generateToken(user.id, 'admin');
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/admin/dashboard');
  });
});

// ============ LOGOUT ============
router.get('/customer/logout', (req, res) => { res.clearCookie('token'); res.redirect('/'); });
router.get('/merchant/logout', (req, res) => { res.clearCookie('token'); res.redirect('/'); });
router.get('/admin/logout', (req, res) => { res.clearCookie('token'); res.redirect('/'); });

// ============ SEED ADMIN ============
(async () => {
  db.get('SELECT * FROM users WHERE role = "admin"', async (err, admin) => {
    if (!admin) {
      const hashed = await bcrypt.hash('admin123', 10);
      db.run('INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, "admin", ?)', [uuidv4(), 'admin@quick2pay.com', hashed, 'Super Admin']);
      console.log('Default admin created: admin@quick2pay.com / admin123');
    }
  });
})();

module.exports = router;