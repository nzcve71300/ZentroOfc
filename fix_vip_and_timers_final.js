const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixVipAndTimers() {
  console.log('🔧 Fix VIP Authorization and Persistent Timers');
  console.log('==============================================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 Step 1: Creating kit_cooldowns table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS kit_cooldowns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        kit_name VARCHAR(50) NOT NULL,
        player_name VARCHAR(100) NOT NULL,
        claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_server_kit_player (server_id, kit_name, player_name),
        INDEX idx_claimed_at (claimed_at)
      )
    `);
    console.log('✅ kit_cooldowns table created!');

    console.log('\n📋 Step 2: Setting up cooldowns for all kits...');
    const [servers] = await connection.execute('SELECT id FROM rust_servers');
    
    for (const server of servers) {
      // Set cooldowns for different kit types
      await connection.execute(
        'UPDATE autokits SET cooldown = ? WHERE server_id = ? AND kit_name LIKE ?',
        [30, server.id, 'FREEkit%'] // 30 minutes for free kits
      );
      
      await connection.execute(
        'UPDATE autokits SET cooldown = ? WHERE server_id = ? AND kit_name = ?',
        [60, server.id, 'VIPkit'] // 60 minutes for VIP kit
      );
      
      await connection.execute(
        'UPDATE autokits SET cooldown = ? WHERE server_id = ? AND kit_name LIKE ?',
        [120, server.id, 'ELITEkit%'] // 120 minutes for elite kits
      );
    }
    console.log('✅ Cooldowns updated!');

    console.log('\n📋 Step 3: Checking current kit_auth entries...');
    const [authEntries] = await connection.execute('SELECT * FROM kit_auth');
    console.log(`Found ${authEntries.length} kit authorization entries`);
    
    for (const entry of authEntries) {
      console.log(`- Discord ID: ${entry.discord_id}, Kitlist: ${entry.kitlist}`);
    }

    console.log('\n✅ Final verification:');
    const [autokits] = await connection.execute(`
      SELECT ak.*, rs.nickname as server_name 
      FROM autokits ak 
      JOIN rust_servers rs ON ak.server_id = rs.id
      ORDER BY rs.nickname, ak.kit_name
    `);
    
    for (const kit of autokits) {
      console.log(`Server: ${kit.server_name} - Kit: ${kit.kit_name} - Cooldown: ${kit.cooldown} minutes`);
    }

    await connection.end();

    console.log('\n🎯 SUMMARY:');
    console.log('✅ kit_cooldowns table created for persistent timers');
    console.log('✅ Cooldowns set: FREE kits (30min), VIP kit (60min), ELITE kits (120min)');
    console.log('✅ VIP authorization now requires kit_auth entry with kitlist = "VIPkit"');
    console.log('✅ ELITE authorization now requires kit_auth entry with kitlist = "Elite1", "Elite2", etc.');
    console.log('✅ New command: /add-vip-player to authorize players for VIP kits');
    console.log('✅ Existing command: /add-to-kit-list for elite kits');

    console.log('\n🚀 RESTART THE BOT NOW:');
    console.log('pm2 stop zentro-bot');
    console.log('pm2 start zentro-bot');
    console.log('pm2 logs zentro-bot');

    console.log('\n📋 USAGE:');
    console.log('- Use /add-vip-player to give players VIP kit access');
    console.log('- Use /add-to-kit-list to give players elite kit access');
    console.log('- Timers now persist across bot restarts');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixVipAndTimers(); 