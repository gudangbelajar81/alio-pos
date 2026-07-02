const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_alio_key';

app.use(cors());
app.use(express.json());

// Database Connection (Support Railway Native Variables & Local)
const db = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
  user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'alio_pos',
  port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Auto-Migrate Database (Create tables on startup for Railway)
async function syncDatabase() {
  try {
    const conn = await db.getConnection();
    console.log('✅ Connected to MySQL Database. Syncing tables...');
    
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        store_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Phase 9 Migrations: Add new columns if they don't exist
    const addColumn = async (table, columnDef) => {
      try {
        await conn.query(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
        console.log(`✅ Added column ${columnDef} to ${table}`);
      } catch (err) {
        if (err.code !== 'ER_DUP_FIELDNAME') console.error(`Error adding column: ${err.message}`);
      }
    };

    await addColumn('users', "admin_pin VARCHAR(10) DEFAULT '1234'");
    await addColumn('users', "store_logo VARCHAR(500) DEFAULT ''");
    await addColumn('users', "theme_color VARCHAR(20) DEFAULT '#4F46E5'");
    await addColumn('users', "tax_rate DECIMAL(5,2) DEFAULT 11.00");

    await conn.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        user_id INT NOT NULL DEFAULT 1
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        image_url VARCHAR(500),
        category_id INT,
        user_id INT NOT NULL DEFAULT 1
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        total_amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'Lunas',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id INT NOT NULL DEFAULT 1
      )
    `);

    await addColumn('orders', "subtotal DECIMAL(10,2) DEFAULT 0");
    await addColumn('orders', "discount DECIMAL(10,2) DEFAULT 0");
    await addColumn('orders', "tax_amount DECIMAL(10,2) DEFAULT 0");

    await conn.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        price_at_time DECIMAL(10, 2) NOT NULL
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        points INT DEFAULT 0,
        user_id INT NOT NULL DEFAULT 1
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS api_keys_manager (
        id INT AUTO_INCREMENT PRIMARY KEY,
        provider VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        api_key VARCHAR(255) NOT NULL,
        base_url VARCHAR(255),
        status VARCHAR(20) DEFAULT 'Alive',
        used_count INT DEFAULT 0,
        user_id INT NOT NULL DEFAULT 1
      )
    `);
    
    conn.release();
    console.log('✅ All tables synced successfully.');
  } catch (error) {
    console.error('❌ Database Sync Error:', error.message);
  }
}
syncDatabase();

// ==========================================
// AUTHENTICATION & MULTI-TENANCY MIDDLEWARE
// ==========================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Akses Ditolak: Token tidak ditemukan' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Sesi kedaluwarsa atau tidak valid' });
    req.user = user; 
    next();
  });
};

// --- AUTH ENDPOINTS ---
app.post('/api/auth/register', async (req, res) => {
  const { store_name, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (store_name, email, password) VALUES (?, ?, ?)',
      [store_name, email, hashedPassword]
    );
    
    await db.query('INSERT INTO categories (name, user_id) VALUES (?, ?)', ['Semua', result.insertId]);

    res.json({ success: true, message: 'Toko berhasil didaftarkan! Silakan login.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Email sudah terdaftar.' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Email tidak ditemukan.' });

    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Password salah.' });

    const token = jwt.sign({ id: user.id, email: user.email, store_name: user.store_name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, store_name: user.store_name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// PROTECTED API ENDPOINTS (Requires Login)
// ==========================================

// --- PRODUCTS ---
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT p.*, c.name as category FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.user_id = ?', 
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  const { name, price, category_id, image_url } = req.body;
  try {
    let catId = category_id;
    if (!catId) {
      const [cat] = await db.query('SELECT id FROM categories WHERE user_id = ? LIMIT 1', [req.user.id]);
      if(cat.length > 0) catId = cat[0].id;
      else catId = 1;
    }

    await db.query(
      'INSERT INTO products (name, price, category_id, image_url, user_id) VALUES (?, ?, ?, ?, ?)',
      [name, price, catId, image_url, req.user.id]
    );
    res.json({ success: true, message: 'Produk berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    await db.query('DELETE FROM products WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Produk berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ORDERS ---
app.post('/api/orders', authenticateToken, async (req, res) => {
  const { cart, subtotal, tax, discount, total } = req.body;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [orderResult] = await connection.query(
      'INSERT INTO orders (total_amount, subtotal, discount, tax_amount, user_id) VALUES (?, ?, ?, ?, ?)',
      [total, subtotal || 0, discount || 0, tax || 0, req.user.id]
    );
    
    const orderId = orderResult.insertId;

    for (let item of cart) {
      await connection.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price_at_time) VALUES (?, ?, ?, ?)',
        [orderId, item.id, item.qty, item.price]
      );
    }

    await connection.commit();
    res.json({ success: true, orderId: orderId });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// --- DASHBOARD STATS & EXPORT ---
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const [[stats]] = await db.query(
      'SELECT COUNT(id) as total_orders, SUM(total_amount) as total_revenue FROM orders WHERE DATE(created_at) = CURDATE() AND user_id = ?',
      [req.user.id]
    );
    // Get Chart Data (Last 7 Days)
    const [chartData] = await db.query(
      `SELECT DATE_FORMAT(created_at, '%d %b') as date, SUM(total_amount) as revenue 
       FROM orders WHERE user_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) 
       GROUP BY DATE(created_at) ORDER BY DATE(created_at) ASC`,
      [req.user.id]
    );
    res.json({ ...stats, chartData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/recent', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, DATE_FORMAT(created_at, "%H:%i") as time, total_amount as total, status FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/all', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, DATE_FORMAT(created_at, "%Y-%m-%d %H:%i") as datetime, subtotal, discount, tax_amount, total_amount as total, status FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- CUSTOMERS ---
app.get('/api/customers', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM customers WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/customers', authenticateToken, async (req, res) => {
  const { name, phone } = req.body;
  try {
    await db.query(
      'INSERT INTO customers (name, phone, points, user_id) VALUES (?, ?, ?, ?)',
      [name, phone, 0, req.user.id]
    );
    res.json({ success: true, message: 'Pelanggan berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/customers/:id', authenticateToken, async (req, res) => {
  try {
    await db.query('DELETE FROM customers WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Pelanggan berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- OMNI-API GATEWAY (KEYS) ---
app.get('/api/keys', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM api_keys_manager WHERE user_id = ?', [req.user.id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/keys', authenticateToken, async (req, res) => {
  const { provider, name, api_key, base_url } = req.body;
  try {
    await db.query(
      'INSERT INTO api_keys_manager (provider, name, api_key, base_url, status, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [provider, name, api_key, base_url, 'Alive', req.user.id]
    );
    res.json({ success: true, message: 'API Key berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/keys/:id/status', authenticateToken, async (req, res) => {
  const { status } = req.body;
  try {
    await db.query('UPDATE api_keys_manager SET status = ? WHERE id = ? AND user_id = ?', [status, req.params.id, req.user.id]);
    res.json({ success: true, message: 'Status API Key berhasil diubah' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- SETTINGS (STORE PROFILE) ---
app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT store_name, admin_pin, store_logo, theme_color, tax_rate FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/settings', authenticateToken, async (req, res) => {
  const { store_name, admin_pin, store_logo, theme_color, tax_rate } = req.body;
  try {
    await db.query(
      'UPDATE users SET store_name = ?, admin_pin = ?, store_logo = ?, theme_color = ?, tax_rate = ? WHERE id = ?',
      [store_name, admin_pin, store_logo, theme_color, tax_rate, req.user.id]
    );
    res.json({ success: true, message: 'Pengaturan berhasil disimpan!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/receipts/whatsapp', authenticateToken, async (req, res) => {
  const { phone, orderId, total } = req.body;
  try {
    console.log(`[WhatsApp Simulated] Sending receipt to ${phone}`);
    res.json({
      success: true,
      message: `Struk digital berhasil dikirim ke WhatsApp ${phone}!`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('Alio POS API is running.');
});

app.listen(PORT, () => {
  console.log(`🚀 Alio POS SaaS Backend running on port ${PORT}`);
});
