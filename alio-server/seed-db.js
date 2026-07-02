const mysql = require('mysql2/promise');

async function seedDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'alio_pos'
    });

    console.log('Connected to MySQL server (alio_pos).');

    // Create Categories Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create Products Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        category_id INT,
        image_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )
    `);

    // Create Orders Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subtotal DECIMAL(10, 2) NOT NULL,
        tax DECIMAL(10, 2) NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        status ENUM('PAID', 'PENDING', 'CANCELLED') DEFAULT 'PAID',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Order Items Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        qty INT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    console.log('Tables for products and orders created successfully.');

    // Seed Categories
    await connection.query('TRUNCATE TABLE order_items');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('TRUNCATE TABLE products');
    await connection.query('TRUNCATE TABLE categories');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    await connection.query(`
      INSERT INTO categories (id, name) VALUES 
      (1, 'Minuman'), 
      (2, 'Makanan'), 
      (3, 'Dessert')
    `);

    // Seed Products (Opsi A - Kafe)
    const products = [
      { name: 'Kopi Susu Senja', price: 25000, category_id: 1, image: 'https://images.unsplash.com/photo-1559525839-b184a4d698c7?w=500&q=80' },
      { name: 'Espresso Single', price: 20000, category_id: 1, image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&q=80' },
      { name: 'Croissant Butter', price: 30000, category_id: 2, image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500&q=80' },
      { name: 'Beef Burger', price: 45000, category_id: 2, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80' },
      { name: 'Ice Lemon Tea', price: 18000, category_id: 1, image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&q=80' },
      { name: 'French Fries', price: 22000, category_id: 2, image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=500&q=80' },
      { name: 'Tiramisu Cake', price: 35000, category_id: 3, image: 'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=500&q=80' },
      { name: 'Vanilla Gelato', price: 28000, category_id: 3, image: 'https://images.unsplash.com/photo-1563805042-7684c8a9e9ce?w=500&q=80' }
    ];

    for (const p of products) {
      await connection.query(
        'INSERT INTO products (name, price, category_id, image_url) VALUES (?, ?, ?, ?)',
        [p.name, p.price, p.category_id, p.image]
      );
    }

    console.log('Database successfully seeded with OPSI A (Kafe) data.');
    await connection.end();
  } catch (error) {
    console.error('Error seeding database:', error.message);
  }
}

seedDatabase();
