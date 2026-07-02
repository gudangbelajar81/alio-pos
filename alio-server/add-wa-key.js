const mysql = require('mysql2/promise');
require('dotenv').config();

async function addDummyWaKey() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'alio_pos'
    });

    console.log('Connected to MySQL server.');

    // Insert dummy keys for Fonnte WA Provider
    const insertQuery = `
      INSERT INTO api_keys_manager (provider, name, api_key, base_url, status)
      SELECT * FROM (SELECT 'whatsapp', 'Fonnte WA (Dummy)', 'fonnte-dummy-key-999', 'https://api.fonnte.com/send', 'Alive') AS tmp
      WHERE NOT EXISTS (
          SELECT name FROM api_keys_manager WHERE provider = 'whatsapp'
      ) LIMIT 1;
    `;
    await connection.query(insertQuery);
    
    console.log('Dummy WhatsApp key inserted successfully.');

    await connection.end();
  } catch (error) {
    console.error('Error inserting dummy WA key:', error.message);
  }
}

addDummyWaKey();
