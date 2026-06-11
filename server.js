require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

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

app.listen(PORT, () => {
  console.log(`Quick 2 Pay running at http://localhost:${PORT}`);
});