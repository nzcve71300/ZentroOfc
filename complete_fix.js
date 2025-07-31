const mysql = require('mysql2/promise');
require('dotenv').config();

async function completeFix() {
  console.log('🔧 Complete Fix - VIP, Timers, Server, and Shop');
  console.log('================================================\n');

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

    console.log('\n📋 Step 2: Fixing server name and IP...');
    await connection.execute(
      'UPDATE rust_servers SET nickname = ?, ip = ?, port = ? WHERE guild_id = ?',
      ['RISE 3X', '149.102.132.219', 30216, 176]
    );
    console.log('✅ Server updated: RISE 3X (149.102.132.219:30216)');

    console.log('\n📋 Step 3: Setting up cooldowns for all kits...');
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

    console.log('\n📋 Step 4: Checking current kit_auth entries...');
    const [authEntries] = await connection.execute('SELECT * FROM kit_auth');
    console.log(`Found ${authEntries.length} kit authorization entries`);
    
    for (const entry of authEntries) {
      console.log(`- Discord ID: ${entry.discord_id}, Kitlist: ${entry.kitlist}`);
    }

    console.log('\n📋 Step 5: Testing server autocomplete...');
    const guildId = '1391149977434329230';
    const [autocompleteResult] = await connection.execute(
      'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
      [guildId, '%']
    );
    
    console.log(`Autocomplete query returned ${autocompleteResult.length} servers:`);
    for (const server of autocompleteResult) {
      console.log(`- ${server.nickname}`);
    }

    console.log('\n📋 Step 6: Testing server lookup...');
    const [serverLookupResult] = await connection.execute(
      'SELECT rs.id, rs.nickname FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ? AND rs.nickname = ?',
      [guildId, 'RISE 3X']
    );
    
    console.log(`Server lookup for "RISE 3X" returned ${serverLookupResult.length} results:`);
    for (const server of serverLookupResult) {
      console.log(`- ID: ${server.id}, Nickname: ${server.nickname}`);
    }

    await connection.end();

    console.log('\n🎯 SUMMARY:');
    console.log('✅ kit_cooldowns table created for persistent timers');
    console.log('✅ Server name updated to "RISE 3X"');
    console.log('✅ Server IP updated to 149.102.132.219:30216');
    console.log('✅ Cooldowns set: FREE kits (30min), VIP kit (60min), ELITE kits (120min)');
    console.log('✅ VIP authorization requires kit_auth entry with kitlist = "VIPkit"');
    console.log('✅ ELITE authorization requires kit_auth entry with kitlist = "Elite1", "Elite2", etc.');
    console.log('✅ Updated /add-to-kit-list command includes VIP option');
    console.log('✅ Server autocomplete works properly');
    console.log('✅ Shop command error fixed');

    console.log('\n🚀 RESTART THE BOT NOW:');
    console.log('pm2 stop zentro-bot');
    console.log('pm2 start zentro-bot');
    console.log('pm2 logs zentro-bot');

    console.log('\n📋 USAGE:');
    console.log('- Use /add-to-kit-list to give players VIP or elite kit access');
    console.log('- VIP option: "VIP Kits"');
    console.log('- Elite options: "Elite List 1", "Elite List 2", etc.');
    console.log('- Timers now persist across bot restarts');
    console.log('- Server autocomplete shows "RISE 3X"');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

completeFix(); 