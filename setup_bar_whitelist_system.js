const pool = require('./src/db');

async function setupBarWhitelistSystem() {
  try {
    console.log('🔧 Setting up Book-a-Ride (BAR) Whitelist System...');

    // Add use_list column to rider_config table
    console.log('\n📋 Adding use_list column to rider_config table...');
    await pool.query(`
      ALTER TABLE rider_config 
      ADD COLUMN IF NOT EXISTS use_list BOOLEAN DEFAULT FALSE AFTER fuel_amount
    `);
    console.log('✅ use_list column added to rider_config');

    // Create BAR allowed users table
    console.log('\n📋 Creating bar_allowed_users table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bar_allowed_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        discord_id VARCHAR(32) NULL,
        ign VARCHAR(255) NULL,
        added_by VARCHAR(32) NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
        UNIQUE KEY unique_bar_allowed (server_id, discord_id, ign)
      )
    `);
    console.log('✅ bar_allowed_users table created');

    // Create BAR banned users table
    console.log('\n📋 Creating bar_banned_users table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bar_banned_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        discord_id VARCHAR(32) NULL,
        ign VARCHAR(255) NULL,
        banned_by VARCHAR(32) NOT NULL,
        banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
        UNIQUE KEY unique_bar_banned (server_id, discord_id, ign)
      )
    `);
    console.log('✅ bar_banned_users table created');

    // Check current servers and their BAR configs
    console.log('\n📊 Current servers and BAR configurations:');
    const [servers] = await pool.query(`
      SELECT rs.id, rs.nickname, g.discord_id, rc.use_list
      FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id
      LEFT JOIN rider_config rc ON rs.id = rc.server_id
    `);

    if (servers.length === 0) {
      console.log('   ❌ No servers found');
    } else {
      for (const server of servers) {
        console.log(`\n🏠 Server: ${server.nickname}`);
        console.log(`   ID: ${server.id}`);
        console.log(`   Guild ID: ${server.discord_id}`);
        console.log(`   BAR Whitelist: ${server.use_list ? 'ENABLED' : 'DISABLED (default)'}`);
      }
    }

    // Check existing BAR lists
    const [allowed] = await pool.query('SELECT COUNT(*) as count FROM bar_allowed_users');
    const [banned] = await pool.query('SELECT COUNT(*) as count FROM bar_banned_users');
    
    console.log(`\n📊 Current BAR Lists:`);
    console.log(`   Allowed Users: ${allowed[0].count}`);
    console.log(`   Banned Users: ${banned[0].count}`);
    
    console.log('\n🎯 BAR Whitelist System Features:');
    console.log('   ✅ BAR-LIST: Allow specific players to use Book-a-Ride');
    console.log('   ✅ BAR-BANLIST: Ban players from using Book-a-Ride');
    console.log('   ✅ BAR-USELIST: Enable/disable allowed list requirement');
    console.log('   ✅ Ban list works regardless of USELIST setting');
    console.log('   ✅ USELIST off by default (everyone can use BAR)');
    
    console.log('\n📝 Available Commands:');
    console.log('   /add-to-list BAR-LIST <player> <server>');
    console.log('   /add-to-list BAR-BANLIST <player> <server>');
    console.log('   /remove-from-list BAR-LIST <player> <server>');
    console.log('   /remove-from-list BAR-BANLIST <player> <server>');
    console.log('   /set BAR-USELIST on <server>');
    console.log('   /set BAR-USELIST off <server>');
    
    console.log('\n🔄 Next Steps:');
    console.log('1. Update the BAR handler in src/rcon/index.js');
    console.log('2. Update add-to-list and remove-from-list commands');
    console.log('3. Update the /set command to handle BAR-USELIST');
    console.log('4. Deploy commands: node deploy-commands.js');
    console.log('5. Restart bot: pm2 restart zentro-bot');
    console.log('6. Test the system in-game');
    
    console.log('\n💡 How it works:');
    console.log('   • BAR-USELIST OFF (default): Everyone can use Book-a-Ride');
    console.log('   • BAR-USELIST ON: Only players in BAR-LIST can use Book-a-Ride');
    console.log('   • BAR-BANLIST: Banned players cannot use Book-a-Ride (always enforced)');
    console.log('   • Removing from ban list restores BAR access');
    console.log('   • Players not in whitelist get no response (silent rejection)');
        
  } catch (error) {
    console.error('❌ Error setting up BAR whitelist system:', error.message);
  } finally {
    await pool.end();
  }
}

setupBarWhitelistSystem();
