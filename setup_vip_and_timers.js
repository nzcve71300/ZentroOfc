const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupVipAndTimers() {
  console.log('🔧 Setup VIP and Timers');
  console.log('========================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('📋 Step 1: Creating kit_cooldowns table...');
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

    console.log('\n📋 Step 2: Updating autokit cooldowns...');
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

    console.log('\n📋 Step 3: Adding VIP authorization example...');
    // Get the server ID
    const [serverResult] = await connection.execute(
      'SELECT id FROM rust_servers WHERE nickname = ?',
      ['RISE 3X']
    );
    
    if (serverResult.length > 0) {
      const serverId = serverResult[0].id;
      
      // Add a VIP authorization entry (replace with actual Discord ID)
      await connection.execute(
        'INSERT INTO kit_auth (server_id, discord_id, kitlist) VALUES (?, ?, ?)',
        [serverId, '1391149977434329230', 'VIPkit'] // Replace with actual VIP Discord ID
      );
      console.log('✅ VIP authorization added! (Replace Discord ID with actual VIP user)');
    }

    console.log('\n✅ Verification:');
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

    console.log('\n🚀 RESTART THE BOT NOW:');
    console.log('pm2 stop zentro-bot');
    console.log('pm2 start zentro-bot');
    console.log('pm2 logs zentro-bot');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

setupVipAndTimers(); 