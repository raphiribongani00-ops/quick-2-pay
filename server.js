require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const db = require('./db');
const auth = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const publicRoutes = require('./routes/public');
const customerRoutes = require('./routes/customer');
const merchantRoutes = require('./routes/merchant');
const adminRoutes = require('./routes/admin');

app.use('/', publicRoutes);
app.use('/customer', customerRoutes);
app.use('/merchant', merchantRoutes);
app.use('/admin', adminRoutes);

db.ready.then(async () => {
  // Use single quotes for string literal
  db.get('SELECT * FROM users WHERE role = \'admin\'', async (err, admin) => {
    if (!admin) {
      const hashed = await bcrypt.hash('admin123', 10);
      const adminId = uuidv4();
      db.run(
        'INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, \'admin\', ?)',
        [adminId, 'admin@quick2pay.com', hashed, 'Super Admin'],
        (err2) => {
          if (err2) console.error('Error creating admin:', err2.message);
          else console.log('Default admin created: admin@quick2pay.com / admin123');
        }
      );
    }
  });

  app.listen(PORT, () => {
    console.log(`Quick 2 Pay running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});