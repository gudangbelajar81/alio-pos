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

// Database Connection
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'alio_pos',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ==========================================
// AUTHENTICATION & MULTI-TENANCY MIDDLEWARE
// ==========================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Akses Ditolak: Token tidak ditemukan' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Sesi kedaluwarsa atau tidak valid' });
    req.user = user; // { id: user_id, email, store_name }
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
    
    // Auto-create default category for this new user
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
    // If no category selected, assign to their default category or 1 if none
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
  const { cart, subtotal, tax, total } = req.body;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [orderResult] = await connection.query(
      'INSERT INTO orders (total_amount, user_id) VALUES (?, ?)',
      [total, req.user.id]
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

// --- DASHBOARD STATS ---
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const [[stats]] = await db.query(
      'SELECT COUNT(id) as total_orders, SUM(total_amount) as total_revenue FROM orders WHERE DATE(created_at) = CURDATE() AND user_id = ?',
      [req.user.id]
    );
    res.json(stats);
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

// WA Receipt Endpoint
app.post('/api/receipts/whatsapp', authenticateToken, async (req, res) => {
  const { phone, orderId, total } = req.body;
  
  // Here we would normally fetch the key for this specific user
  // const [keys] = await db.query("SELECT * FROM api_keys_manager WHERE provider = 'whatsapp' AND status = 'Alive' AND user_id = ?", [req.user.id]);
  // if(keys.length === 0) return res.status(400).json({error: "Belum ada kunci WhatsApp yang aktif."});

  try {
    console.log(`[WhatsApp Simulated] Sending receipt to ${phone} for Toko: ${req.user.store_name}`);
    res.json({
      success: true,
      message: `Struk digital berhasil dikirim ke WhatsApp ${phone}! (Simulasi berjalan sempurna untuk toko ${req.user.store_name})`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Alio POS SaaS Backend running on http://localhost:${PORT}`);
});
