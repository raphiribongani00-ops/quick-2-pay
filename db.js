const { createClient } = require('@libsql/client');
require('dotenv').config();

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl || !tursoToken) {
  console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN');
  process.exit(1);
}

const client = createClient({
  url: tursoUrl,
  authToken: tursoToken,
});

// Function to create all tables
async function createTables() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      name TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,
    `CREATE TABLE IF NOT EXISTS merchants (
      user_id TEXT PRIMARY KEY,
      store_name TEXT NOT NULL,
      store_qr_code TEXT UNIQUE NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS global_products (
      barcode TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      image_url TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS merchant_products (
      merchant_id TEXT,
      barcode TEXT,
      price INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (merchant_id, barcode),
      FOREIGN KEY (merchant_id) REFERENCES merchants(user_id),
      FOREIGN KEY (barcode) REFERENCES global_products(barcode)
    )`,
    `CREATE TABLE IF NOT EXISTS merchant_custom_products (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price_cents INTEGER NOT NULL,
      image_url TEXT,
      qr_code_token TEXT UNIQUE NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (merchant_id) REFERENCES merchants(user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS transactions (
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
    )`,
    `CREATE TABLE IF NOT EXISTS transaction_items (
      transaction_id TEXT,
      barcode TEXT,
      quantity INTEGER NOT NULL,
      price_cents INTEGER NOT NULL,
      PRIMARY KEY (transaction_id, barcode),
      FOREIGN KEY (transaction_id) REFERENCES transactions(id),
      FOREIGN KEY (barcode) REFERENCES global_products(barcode)
    )`,
    `CREATE TABLE IF NOT EXISTS complaints (
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
    )`,
    `CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      merchant_id TEXT,
      period_start INTEGER,
      period_end INTEGER,
      total_platform_fee_cents INTEGER,
      payout_amount_cents INTEGER,
      paid INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (merchant_id) REFERENCES merchants(user_id)
    )`
  ];
  for (const sql of queries) {
    await client.execute(sql);
  }
  console.log('✅ Turso database tables ready');
}

// Promise that resolves when tables are created
const ready = createTables();

// Compatibility layer (callback style)
const db = {
  get: (sql, params, callback) => {
    if (typeof callback !== 'function') {
      return client.execute({ sql, args: params }).then(result => result.rows[0]);
    }
    client.execute({ sql, args: params })
      .then(result => callback(null, result.rows[0]))
      .catch(err => callback(err, null));
  },
  all: (sql, params, callback) => {
    if (typeof callback !== 'function') {
      return client.execute({ sql, args: params }).then(result => result.rows);
    }
    client.execute({ sql, args: params })
      .then(result => callback(null, result.rows))
      .catch(err => callback(err, null));
  },
  run: (sql, params, callback) => {
    if (typeof callback !== 'function') {
      return client.execute({ sql, args: params }).then(result => ({
        changes: result.rowsAffected,
        lastID: result.lastInsertRowid,
      }));
    }
    client.execute({ sql, args: params })
      .then(result => callback(null, { changes: result.rowsAffected, lastID: result.lastInsertRowid }))
      .catch(err => callback(err, null));
  },
  serialize: (callback) => callback(),
};

// Attach ready promise to db object (so server.js can access it)
db.ready = ready;

module.exports = db;