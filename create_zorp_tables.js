const mysql = require('mysql2/promise');
const config = require('./src/config');

async function createZorpTables() {
  let pool;
  
  try {
    console.log('🔧 Creating ZORP tables...');
    
    // Create connection pool
    pool = mysql.createPool({
      host: config.database.host,
      user: config.database.user,
      password: config.database.password,
      database: config.database.name,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');

    // Create zorp_zones table
    console.log('📋 Creating zorp_zones table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS zorp_zones (
        id SERIAL PRIMARY KEY,
        server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        owner TEXT NOT NULL,
        team JSONB,
        position JSONB,
        size INTEGER DEFAULT 75,
        color_online TEXT DEFAULT '0,255,0',
        color_offline TEXT DEFAULT '255,0,0',
        radiation INTEGER DEFAULT 0,
        delay INTEGER DEFAULT 0,
        expire INTEGER DEFAULT 126000,
        min_team INTEGER DEFAULT 1,
        max_team INTEGER DEFAULT 8,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ zorp_zones table created successfully');

    // Create zorp_defaults table
    console.log('📋 Creating zorp_defaults table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS zorp_defaults (
        id SERIAL PRIMARY KEY,
        server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
        size INTEGER DEFAULT 75,
        color_online TEXT DEFAULT '0,255,0',
        color_offline TEXT DEFAULT '255,0,0',
        radiation INTEGER DEFAULT 0,
        delay INTEGER DEFAULT 0,
        expire INTEGER DEFAULT 126000,
        min_team INTEGER DEFAULT 1,
        max_team INTEGER DEFAULT 8,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(server_id)
      )
    `);
    console.log('✅ zorp_defaults table created successfully');

    // Verify tables exist
    console.log('🔍 Verifying tables...');
    const [tables] = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ? AND table_name IN ('zorp_zones', 'zorp_defaults')
    `, [config.database.name]);

    console.log('📊 Found tables:');
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });

    console.log('🎉 All ZORP tables created successfully!');

  } catch (error) {
    console.error('❌ Error creating ZORP tables:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

createZorpTables(); 