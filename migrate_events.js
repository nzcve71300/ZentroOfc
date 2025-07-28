require('dotenv').config();
const pool = require('./src/db');

async function migrateEvents() {
  try {
    console.log('🔄 Starting event_configs table migration...');
    
    // Create the event_configs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_configs (
        id SERIAL PRIMARY KEY,
        server_id INT REFERENCES rust_servers(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        enabled BOOLEAN DEFAULT false,
        kill_message TEXT,
        respawn_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(server_id, event_type)
      );
    `);
    
    console.log('✅ event_configs table created successfully');
    
    // Insert default configurations for existing servers
    const insertBradley = await pool.query(`
      INSERT INTO event_configs (server_id, event_type, enabled, kill_message, respawn_message)
      SELECT 
        rs.id,
        'bradley',
        false,
        '<color=#00ffff>Brad got taken</color>',
        '<color=#00ffff>Bradley APC has respawned</color>'
      FROM rust_servers rs
      ON CONFLICT (server_id, event_type) DO NOTHING;
    `);
    
    const insertHelicopter = await pool.query(`
      INSERT INTO event_configs (server_id, event_type, enabled, kill_message, respawn_message)
      SELECT 
        rs.id,
        'helicopter',
        false,
        '<color=#00ffff>Heli got taken</color>',
        '<color=#00ffff>Patrol Helicopter has respawned</color>'
      FROM rust_servers rs
      ON CONFLICT (server_id, event_type) DO NOTHING;
    `);
    
    console.log('✅ Default event configurations inserted');
    
    // Verify the migration
    const count = await pool.query('SELECT COUNT(*) FROM event_configs');
    console.log(`📊 Total event configurations: ${count.rows[0].count}`);
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('🔍 Error details:', error);
  } finally {
    await pool.end();
    console.log('🔌 Database connection closed');
  }
}

migrateEvents(); 