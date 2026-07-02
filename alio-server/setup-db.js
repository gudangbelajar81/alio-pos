const mysql = require('mysql2/promise');

async function setupDatabase() {
  try {
    // Connect to MySQL server (without specifying database to create it first)
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '' // Default XAMPP password
    });

    console.log('Connected to MySQL server.');

    // Create database if not exists
    await connection.query('CREATE DATABASE IF NOT EXISTS alio_pos');
    console.log('Database alio_pos created or already exists.');

    // Switch to alio_pos database
    await connection.query('USE alio_pos');

    // Create api_keys_manager table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS api_keys_manager (
        id INT AUTO_INCREMENT PRIMARY KEY,
        provider VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        api_key VARCHAR(255) NOT NULL,
        base_url VARCHAR(255),
        status ENUM('Alive', 'Limit', 'Dead') DEFAULT 'Alive',
        used_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await connection.query(createTableQuery);
    console.log('Table api_keys_manager created or already exists.');

    // Insert dummy keys for AI provider to demonstrate Key Rotator
    const insertDummyQuery = `
      INSERT INTO api_keys_manager (provider, name, api_key, base_url, status)
      SELECT * FROM (SELECT 'ai_assistant', 'OpenAI - Key 1', 'sk-proj-dummy123', 'https://api.openai.com/v1', 'Alive') AS tmp
      WHERE NOT EXISTS (
          SELECT name FROM api_keys_manager WHERE provider = 'ai_assistant'
      ) LIMIT 1;
    `;
    await connection.query(insertDummyQuery);
    
    const insertDummyQuery2 = `
      INSERT INTO api_keys_manager (provider, name, api_key, base_url, status)
      SELECT * FROM (SELECT 'ai_assistant', 'OpenAI - Key 2 (Backup)', 'sk-proj-backup456', 'https://api.openai.com/v1', 'Alive') AS tmp
      WHERE NOT EXISTS (
          SELECT name FROM api_keys_manager WHERE api_key = 'sk-proj-backup456'
      ) LIMIT 1;
    `;
    await connection.query(insertDummyQuery2);
    
    console.log('Dummy keys inserted for testing.');

    await connection.end();
    console.log('Database setup completed successfully.');
  } catch (error) {
    console.error('Error setting up database:', error.message);
  }
}

setupDatabase();
