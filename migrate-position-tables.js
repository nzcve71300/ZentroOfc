require('dotenv').config();
const pool = require('./src/db');

async function migratePositionTables() {
  try {
    console.log('Creating position_coordinates table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS position_coordinates (
        id SERIAL PRIMARY KEY,
        server_id INT REFERENCES rust_servers(id) ON DELETE CASCADE,
        position_type TEXT NOT NULL,
        x_pos TEXT,
        y_pos TEXT,
        z_pos TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(server_id, position_type)
      );
    `);
    
    console.log('✅ position_coordinates table created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating position_coordinates table:', error);
  } finally {
    await pool.end();
  }
}

migratePositionTables(); 