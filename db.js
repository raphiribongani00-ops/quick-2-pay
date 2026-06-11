const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_URL || (process.env.RENDER ? '/data/database.sqlite' : './database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('customer', 'merchant', 'admin')) NOT NULL,
      name TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS merchants (
      user_id TEXT PRIMARY KEY,
      store_name TEXT NOT NULL,
      store_qr_code TEXT UNIQUE NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS global_products (
      barcode TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      image_url TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS merchant_products (
      merchant_id TEXT,
      barcode TEXT,
      price INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (merchant_id, barcode),
      FOREIGN KEY (merchant_id) REFERENCES merchants(user_id),
      FOREIGN KEY (barcode) REFERENCES global_products(barcode)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS merchant_custom_products (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price_cents INTEGER NOT NULL,
      image_url TEXT,
      qr_code_token TEXT UNIQUE NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (merchant_id) REFERENCES merchants(user_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      merchant_id TEXT,
      total_cents INTEGER NOT NULL,
      status TEXT DEFAULT 'paid',
      payment_aggregator_id TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      completed_at INTEGER,
      FOREIGN KEY (customer_id) REFERENCES users(id),
      FOREIGN KEY (merchant_id) REFERENCES merchants(user_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transaction_items (
      transaction_id TEXT,
      barcode TEXT,
      quantity INTEGER NOT NULL,
      price_cents INTEGER NOT NULL,
      PRIMARY KEY (transaction_id, barcode),
      FOREIGN KEY (transaction_id) REFERENCES transactions(id),
      FOREIGN KEY (barcode) REFERENCES global_products(barcode)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      from_user_id TEXT,
      merchant_id TEXT,
      transaction_id TEXT,
      message TEXT,
      resolved INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (from_user_id) REFERENCES users(id),
      FOREIGN KEY (merchant_id) REFERENCES merchants(user_id),
      FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      merchant_id TEXT,
      period_start INTEGER,
      period_end INTEGER,
      total_platform_fee_cents INTEGER,
      payout_amount_cents INTEGER,
      paid INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (merchant_id) REFERENCES merchants(user_id)
    )
  `);

  console.log('Database tables ready');
});

module.exports = db;