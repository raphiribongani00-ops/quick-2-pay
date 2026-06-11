const db = require('./db');

db.serialize(() => {
  db.run(`INSERT OR IGNORE INTO global_products (barcode, name, image_url) VALUES 
    ('123456789012', 'Test Product A', 'https://picsum.photos/id/1/100/100'),
    ('234567890123', 'Test Product B', 'https://picsum.photos/id/2/100/100'),
    ('345678901234', 'Test Product C', 'https://picsum.photos/id/3/100/100')`);

  db.get("SELECT user_id FROM merchants LIMIT 1", (err, merchant) => {
    if (err || !merchant) {
      console.log("No merchant found. Please register a merchant first.");
      process.exit(0);
    } else {
      db.run(`INSERT OR IGNORE INTO merchant_products (merchant_id, barcode, price, stock) VALUES
        (?, '123456789012', 1299, 10),
        (?, '234567890123', 2499, 5),
        (?, '345678901234', 599, 20)`,
        [merchant.user_id, merchant.user_id, merchant.user_id], (err2) => {
          if (err2) console.error("Error inserting products:", err2.message);
          else console.log("Demo products added for merchant");
          db.close();
        });
    }
  });
});