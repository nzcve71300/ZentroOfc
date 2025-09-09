const pool = require('./src/db');

async function setupZorpWhitelistSystem() {
  try {
    console.log('🔧 Setting up ZORP Whitelist System...');

    // Add use_list column to zorp_defaults table
    console.log('\n📋 Adding use_list column to zorp_defaults table...');
    await pool.query(`
      ALTER TABLE zorp_defaults 
      ADD COLUMN IF NOT EXISTS use_list BOOLEAN DEFAULT FALSE AFTER enabled
    `);
    console.log('✅ use_list column added to zorp_defaults');

    // Check current servers and their ZORP configs
    console.log('\n📊 Current servers and ZORP configurations:');
    const [servers] = await pool.query(`
      SELECT rs.id, rs.nickname, g.discord_id, zd.use_list
      FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id
      LEFT JOIN zorp_defaults zd ON rs.id = zd.server_id
    `);

    if (servers.length === 0) {
      console.log('   ❌ No servers found');
    } else {
      for (const server of servers) {
        console.log(`\n🏠 Server: ${server.nickname}`);
        console.log(`   ID: ${server.id}`);
        console.log(`   Guild ID: ${server.discord_id}`);
        console.log(`   ZORP Whitelist: ${server.use_list ? 'ENABLED' : 'DISABLED (default)'}`);
      }
    }

    // Check existing ZORP lists
    const [allowed] = await pool.query('SELECT COUNT(*) as count FROM zorp_allowed_users');
    const [banned] = await pool.query('SELECT COUNT(*) as count FROM zorp_banned_users');
    
    console.log(`\n📊 Current ZORP Lists:`);
    console.log(`   Allowed Users: ${allowed[0].count}`);
    console.log(`   Banned Users: ${banned[0].count}`);
    
    console.log('\n🎯 ZORP Whitelist System Features:');
    console.log('   ✅ ZORP-LIST: Allow specific players to use ZORP');
    console.log('   ✅ ZORP-BANLIST: Ban players from using ZORP');
    console.log('   ✅ ZORP-USELIST: Enable/disable allowed list requirement');
    console.log('   ✅ Ban list works regardless of USELIST setting');
    console.log('   ✅ USELIST off by default (everyone can use ZORP)');
    
    console.log('\n📝 Available Commands:');
    console.log('   /edit-zorp ZORP-USELIST on|off server:ServerName');
    console.log('   /add-to-list ZORP-LIST <player> <server>');
    console.log('   /add-to-list ZORP-BANLIST <player> <server>');
    console.log('   /remove-from-list ZORP-LIST <player> <server>');
    console.log('   /remove-from-list ZORP-BANLIST <player> <server>');
    
    console.log('\n🔄 Next Steps:');
    console.log('1. Update the ZORP handler in src/rcon/index.js');
    console.log('2. Update /edit-zorp command to handle ZORP-USELIST');
    console.log('3. Deploy commands: node deploy-commands.js');
    console.log('4. Restart bot: pm2 restart zentro-bot');
    console.log('5. Test the system in-game');
    
    console.log('\n💡 How it works:');
    console.log('   • ZORP-USELIST OFF (default): Everyone can use ZORP');
    console.log('   • ZORP-USELIST ON: Only players in ZORP-LIST can use ZORP');
    console.log('   • ZORP-BANLIST: Banned players cannot use ZORP (always enforced)');
    console.log('   • Removing from ban list restores ZORP access');
    console.log('   • Players not in whitelist get no response (silent rejection)');
        
  } catch (error) {
    console.error('❌ Error setting up ZORP whitelist system:', error.message);
  } finally {
    await pool.end();
  }
}

setupZorpWhitelistSystem();
