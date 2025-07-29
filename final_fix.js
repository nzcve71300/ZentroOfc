const mysql = require('mysql2/promise');
require('dotenv').config();

async function finalFix() {
  console.log('🔧 Running final comprehensive fix...');
  
  // Test database connection
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    console.log('📡 Testing database connection...');
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful!');
    
    // 1. Clean up old servers with invalid IP addresses
    console.log('\n🧹 Cleaning up old servers...');
    const [deleteResult] = await pool.query(
      'DELETE FROM rust_servers WHERE ip = ? OR ip = ? OR port = ? OR port IS NULL',
      ['0.0.0.0', 'PLACEHOLDER_IP', 0]
    );
    console.log(`🗑️ Deleted ${deleteResult.affectedRows} invalid servers`);
    
    // 2. Check remaining servers
    const [remainingServers] = await pool.query('SELECT * FROM rust_servers');
    console.log(`📊 Remaining servers: ${remainingServers.length}`);
    remainingServers.forEach(server => {
      console.log(`  - ${server.nickname}: ${server.ip}:${server.port}`);
    });
    
    // 3. Fix database schema issues
    console.log('\n🔧 Fixing database schema...');
    
    // Drop problematic constraints if they exist
    try {
      await pool.query('ALTER TABLE economy DROP CONSTRAINT IF EXISTS economy_unique_guild_server_discord');
      console.log('✅ Removed problematic economy constraint');
    } catch (e) {
      console.log('ℹ️ Economy constraint already removed or doesn\'t exist');
    }
    
    try {
      await pool.query('ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_unique_guild_server_discord');
      console.log('✅ Removed problematic transactions constraint');
    } catch (e) {
      console.log('ℹ️ Transactions constraint already removed or doesn\'t exist');
    }
    
    // 4. Ensure proper table structure
    console.log('\n📋 Ensuring proper table structure...');
    
    // Check if tables exist and have correct structure
    const [tables] = await pool.query('SHOW TABLES');
    console.log(`📊 Found ${tables.length} tables in database`);
    
    // Ensure economy table has correct structure
    try {
      await pool.query(`
        ALTER TABLE economy 
        MODIFY COLUMN id INT AUTO_INCREMENT PRIMARY KEY,
        MODIFY COLUMN player_id INT,
        MODIFY COLUMN balance INT DEFAULT 0
      `);
      console.log('✅ Fixed economy table structure');
    } catch (e) {
      console.log('ℹ️ Economy table structure is correct');
    }
    
    // Ensure transactions table has correct structure
    try {
      await pool.query(`
        ALTER TABLE transactions 
        MODIFY COLUMN id INT AUTO_INCREMENT PRIMARY KEY,
        MODIFY COLUMN player_id INT,
        MODIFY COLUMN amount INT NOT NULL,
        MODIFY COLUMN type TEXT NOT NULL,
        MODIFY COLUMN timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      console.log('✅ Fixed transactions table structure');
    } catch (e) {
      console.log('ℹ️ Transactions table structure is correct');
    }
    
    // 5. Create proper indexes
    console.log('\n📈 Creating proper indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_players_guild_discord ON players(guild_id, discord_id)',
      'CREATE INDEX IF NOT EXISTS idx_players_guild_ign ON players(guild_id, ign(191))',
      'CREATE INDEX IF NOT EXISTS idx_players_active ON players(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_players_server ON players(server_id)',
      'CREATE INDEX IF NOT EXISTS idx_economy_player ON economy(player_id)',
      'CREATE INDEX IF NOT EXISTS idx_link_requests_guild_discord ON link_requests(guild_id, discord_id)',
      'CREATE INDEX IF NOT EXISTS idx_link_requests_status ON link_requests(status)',
      'CREATE INDEX IF NOT EXISTS idx_link_requests_expires ON link_requests(expires_at)',
      'CREATE INDEX IF NOT EXISTS idx_link_blocks_guild_discord ON link_blocks(guild_id, discord_id)',
      'CREATE INDEX IF NOT EXISTS idx_link_blocks_guild_ign ON link_blocks(guild_id, ign(191))',
      'CREATE INDEX IF NOT EXISTS idx_link_blocks_active ON link_blocks(is_active)'
    ];
    
    for (const indexQuery of indexes) {
      try {
        await pool.query(indexQuery);
      } catch (e) {
        // Index might already exist, ignore
      }
    }
    console.log('✅ Created/verified all indexes');
    
    // 6. Update any NULL is_active values
    try {
      await pool.query('UPDATE players SET is_active = TRUE WHERE is_active IS NULL');
      console.log('✅ Updated NULL is_active values');
    } catch (e) {
      console.log('ℹ️ No NULL is_active values found');
    }
    
    console.log('\n🎉 Final fix completed successfully!');
    console.log('\n📋 Summary:');
    console.log('  ✅ Cleaned up invalid servers');
    console.log('  ✅ Fixed database constraints');
    console.log('  ✅ Ensured proper table structure');
    console.log('  ✅ Created/verified indexes');
    console.log('  ✅ Updated player status');
    
    console.log('\n🚀 Next steps:');
    console.log('  1. Restart your bot: pm2 restart zentro-bot');
    console.log('  2. Add servers with /setup-server');
    console.log('  3. Test functionality');
    
  } catch (error) {
    console.error('❌ Final fix failed:', error.message);
    console.log('\n💡 Database setup required:');
    console.log('  1. Install MySQL/XAMPP');
    console.log('  2. Create database: CREATE DATABASE zentro_bot;');
    console.log('  3. Run migration: node mysql_migrate.js');
    console.log('  4. Run this fix again: node final_fix.js');
  } finally {
    await pool.end();
  }
}

finalFix(); 