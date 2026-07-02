const mysql = require('mysql2/promise');

async function createCustomersTable() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'alio_pos'
    });

    console.log('Connected to MySQL server (alio_pos).');

    // Create Customers Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        points INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert dummy customer
    const insertQuery = `
      INSERT INTO customers (name, phone, points)
      SELECT * FROM (SELECT 'Bos Toko', '081234567890', 100) AS tmp
      WHERE NOT EXISTS (
          SELECT name FROM customers WHERE phone = '081234567890'
      ) LIMIT 1;
    `;
    await connection.query(insertQuery);

    console.log('Customers table created successfully.');
    await connection.end();
  } catch (error) {
    console.error('Error creating customers table:', error.message);
  }
}

createCustomersTable();
