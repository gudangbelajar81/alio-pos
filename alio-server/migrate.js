const mysql = require('mysql2/promise');

async function migrateMultiTenant() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'alio_pos'
    });

    console.log('Connected to MySQL server (alio_pos). Starting migration...');

    // 1. Create users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        store_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created users table.');

    // 2. Insert a default user (if none exist) so existing data isn't orphaned
    const [rows] = await connection.query(`SELECT id FROM users WHERE email = 'admin@aliopos.com'`);
    let defaultUserId = 1;
    if (rows.length === 0) {
      // Just a dummy password hash (we won't use it, just for structure)
      const [result] = await connection.query(
        `INSERT INTO users (store_name, email, password) VALUES (?, ?, ?)`,
        ['Toko Simulator Induk', 'admin@aliopos.com', 'dummyhash123']
      );
      defaultUserId = result.insertId;
      console.log('Inserted default user.');
    } else {
      defaultUserId = rows[0].id;
    }

    // 3. Add user_id column to tables if not exists
    const tablesToUpdate = ['categories', 'products', 'orders', 'customers', 'api_keys_manager'];
    
    for (const table of tablesToUpdate) {
      const [columns] = await connection.query(`SHOW COLUMNS FROM ${table} LIKE 'user_id'`);
      if (columns.length === 0) {
        await connection.query(`ALTER TABLE ${table} ADD COLUMN user_id INT DEFAULT ${defaultUserId}`);
        console.log(`Added user_id to ${table}.`);
      } else {
        console.log(`user_id already exists in ${table}.`);
      }
    }

    console.log('Multi-Tenant Migration Completed Successfully!');
    await connection.end();
  } catch (error) {
    console.error('Migration Error:', error.message);
  }
}

migrateMultiTenant();
