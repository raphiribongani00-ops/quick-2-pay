const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// --- Determine which database to use ---
// If we are on Render, use SQLite. Otherwise, use Turso.
const isRender = process.env.RENDER === 'true';

if (isRender) {
  // --- SQLite for Render (persistent disk) ---
  const dbPath = process.env.DATABASE_URL || '/data/database.sqlite';
  console.log(`🌐 Render mode: Using SQLite at ${dbPath}`);
  const db = new sqlite3.Database(dbPath);

  db.serialize(() => {
    // ... (your existing CREATE TABLE statements here) ...
    // Copy all your table creation SQL from your current db.js
  });

  module.exports = db;
} else {
  // --- Turso for Local Development ---
  const { createClient } = require('@libsql/client');
  console.log('💻 Local mode: Using Turso');

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoToken) {
    console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN for local development');
    process.exit(1);
  }

  const client = createClient({
    url: tursoUrl,
    authToken: tursoToken,
  });

  // ... (your existing Turso compatibility wrapper here) ...
  // Copy all your Turso client and compatibility code from your current db.js

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

  module.exports = db;
}
