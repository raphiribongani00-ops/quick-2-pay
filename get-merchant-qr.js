const db = require('./db');

db.get("SELECT user_id, store_name, store_qr_code FROM merchants LIMIT 1", (err, merchant) => {
  if (err) console.error("Error:", err.message);
  else if (!merchant) console.log("No merchant found. Please register a merchant first.");
  else console.log(`Store: ${merchant.store_name}\nMerchant QR Code: ${merchant.store_qr_code}`);
  db.close();
});