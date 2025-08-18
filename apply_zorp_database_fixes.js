const mysql = require('mysql2/promise');
const config = require('./src/config');

async function applyZorpDatabaseFixes() {
  let pool;
  
  try {
    console.log('🔧 Applying ZORP database fixes...');
    
    // Create connection pool
    pool = mysql.createPool({
      host: config.db.host,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      port: config.db.port,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');

    // Add missing columns to zorp_zones table
    console.log('📋 Adding missing columns to zorp_zones table...');
    
    try {
      await pool.query(`
        ALTER TABLE zorp_zones 
        ADD COLUMN color_yellow TEXT DEFAULT '255,255,0'
      `);
      console.log('✅ Added color_yellow column');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ color_yellow column already exists');
      } else {
        throw error;
      }
    }

    try {
      await pool.query(`
        ALTER TABLE zorp_zones 
        ADD COLUMN current_state TEXT DEFAULT 'white'
      `);
      console.log('✅ Added current_state column');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ current_state column already exists');
      } else {
        throw error;
      }
    }

    try {
      await pool.query(`
        ALTER TABLE zorp_zones 
        ADD COLUMN last_online_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      console.log('✅ Added last_online_at column');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ last_online_at column already exists');
      } else {
        throw error;
      }
    }

    // Add missing columns to zorp_defaults table
    console.log('📋 Adding missing columns to zorp_defaults table...');
    
    try {
      await pool.query(`
        ALTER TABLE zorp_defaults 
        ADD COLUMN color_yellow TEXT DEFAULT '255,255,0'
      `);
      console.log('✅ Added color_yellow column to zorp_defaults');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ color_yellow column already exists in zorp_defaults');
      } else {
        throw error;
      }
    }

    try {
      await pool.query(`
        ALTER TABLE zorp_defaults 
        ADD COLUMN enabled BOOLEAN DEFAULT TRUE
      `);
      console.log('✅ Added enabled column to zorp_defaults');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ enabled column already exists in zorp_defaults');
      } else {
        throw error;
      }
    }

    // Update existing zones to have proper state
    console.log('📋 Updating existing zones...');
    const [updateResult] = await pool.query(`
      UPDATE zorp_zones 
      SET current_state = 'green', 
          last_online_at = CURRENT_TIMESTAMP 
      WHERE current_state IS NULL OR current_state = ''
    `);
    console.log(`✅ Updated ${updateResult.affectedRows} existing zones`);

    // Add indexes for better performance
    console.log('📋 Adding database indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_zorp_zones_owner ON zorp_zones(owner)',
      'CREATE INDEX IF NOT EXISTS idx_zorp_zones_server_id ON zorp_zones(server_id)', 
      'CREATE INDEX IF NOT EXISTS idx_zorp_zones_current_state ON zorp_zones(current_state)'
    ];

    for (const indexQuery of indexes) {
      try {
        await pool.query(indexQuery);
        console.log(`✅ Created index: ${indexQuery.split(' ')[5]}`);
      } catch (error) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`ℹ️ Index already exists: ${indexQuery.split(' ')[5]}`);
        } else {
          console.error(`❌ Error creating index: ${error.message}`);
        }
      }
    }

    // Clean up any expired zones
    console.log('📋 Cleaning up expired zones...');
    const [cleanupResult] = await pool.query(`
      DELETE FROM zorp_zones 
      WHERE created_at + INTERVAL expire SECOND < CURRENT_TIMESTAMP
    `);
    console.log(`✅ Cleaned up ${cleanupResult.affectedRows} expired zones`);

    console.log('🎉 ZORP database fixes applied successfully!');

  } catch (error) {
    console.error('❌ Error applying ZORP database fixes:', error);
    throw error;
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  applyZorpDatabaseFixes()
    .then(() => {
      console.log('Database fixes completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to apply database fixes:', error);
      process.exit(1);
    });
}

module.exports = applyZorpDatabaseFixes;
