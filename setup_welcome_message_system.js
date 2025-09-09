const pool = require('./src/db');

async function setupWelcomeMessageSystem() {
  try {
    console.log('🔧 Setting up Welcome Message System...');
    
    // Add welcome message columns to rider_config table
    console.log('📋 Adding welcome message columns to rider_config table...');
    
    try {
      await pool.query(`
        ALTER TABLE rider_config 
        ADD COLUMN welcome_message_enabled BOOLEAN DEFAULT FALSE,
        ADD COLUMN welcome_message_text TEXT DEFAULT '<b><size=45><color=#00ffff>WELCOME TO {SERVER} {PLAYER}</color></size></b>'
      `);
      console.log('✅ Welcome message columns added to rider_config');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('✅ Welcome message columns already exist in rider_config');
      } else {
        throw error;
      }
    }
    
    // Check current configurations
    console.log('\n📊 Current servers and welcome message configurations:');
    const [serversResult] = await pool.query(`
      SELECT rs.nickname, rs.id, g.discord_id,
             rc.welcome_message_enabled,
             rc.welcome_message_text
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
      LEFT JOIN rider_config rc ON rs.id = rc.server_id
      ORDER BY rs.nickname
    `);
    
    serversResult.forEach(server => {
      console.log(`🏠 Server: ${server.nickname}`);
      console.log(`   ID: ${server.id}`);
      console.log(`   Guild ID: ${server.discord_id}`);
      console.log(`   Welcome Message: ${server.welcome_message_enabled ? 'ENABLED' : 'DISABLED'}`);
      console.log(`   Message Text: ${server.welcome_message_text || 'Not set'}`);
      console.log('');
    });
    
    console.log('🎯 Welcome Message System Features:');
    console.log('✅ WELCOME-MESSAGE: Enable/disable welcome messages');
    console.log('✅ WELCOME-MSG-TEXT: Customize welcome message text');
    console.log('✅ Placeholders: {SERVER} and {PLAYER}');
    console.log('✅ Rich text support: <b>, <size>, <color> tags');
    console.log('✅ Default message: Welcome to {SERVER} {PLAYER}');
    
    console.log('\n📝 Available Commands:');
    console.log('/set WELCOME-MESSAGE on <server>');
    console.log('/set WELCOME-MESSAGE off <server>');
    console.log('/set WELCOME-MSG-TEXT "<message>" <server>');
    
    console.log('\n🔄 Next Steps:');
    console.log('1. Deploy commands: node deploy-commands.js');
    console.log('2. Restart bot: pm2 restart zentro-bot');
    console.log('3. Test the system in-game');
    
    console.log('\n💡 How it works:');
    console.log('• WELCOME-MESSAGE OFF (default): No welcome messages sent');
    console.log('• WELCOME-MESSAGE ON: Send welcome message when players join');
    console.log('• WELCOME-MSG-TEXT: Customize the message content');
    console.log('• {SERVER} gets replaced with server name');
    console.log('• {PLAYER} gets replaced with player name');
    console.log('• Supports rich text formatting for in-game display');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up welcome message system:', error);
    process.exit(1);
  }
}

setupWelcomeMessageSystem();
