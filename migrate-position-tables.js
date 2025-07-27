require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
});

async function createPositionTables() {
  try {
    console.log('Creating position tables...');
    
    // Create position_configs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS position_configs (
        id SERIAL PRIMARY KEY,
        server_id INT REFERENCES rust_servers(id) ON DELETE CASCADE,
        position_type TEXT NOT NULL,
        enabled BOOLEAN DEFAULT true,
        delay_seconds INT DEFAULT 5,
        cooldown_minutes INT DEFAULT 10,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(server_id, position_type)
      )
    `);
    
    // Create position_coordinates table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS position_coordinates (
        id SERIAL PRIMARY KEY,
        server_id INT REFERENCES rust_servers(id) ON DELETE CASCADE,
        position_type TEXT NOT NULL,
        x_pos TEXT NOT NULL,
        y_pos TEXT NOT NULL,
        z_pos TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(server_id, position_type)
      )
    `);
    
    console.log('✅ Position tables created successfully!');
    
    // Verify the tables exist
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('position_configs', 'position_coordinates')
      ORDER BY table_name
    `);
    
    if (tableCheck.rows.length === 2) {
      console.log('✅ Table verification: Both position tables exist');
      console.log('Tables found:', tableCheck.rows.map(row => row.table_name).join(', '));
    } else {
      console.log('❌ Table verification failed: Some tables missing');
      console.log('Tables found:', tableCheck.rows.map(row => row.table_name).join(', '));
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Failed to create position tables:', error.message);
    await pool.end();
    process.exit(1);
  }
}

createPositionTables(); 