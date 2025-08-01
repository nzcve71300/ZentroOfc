const pool = require('./src/db');

console.log('🔍 Checking guild_id values...');

async function checkGuildIds() {
  try {
    // Check what guild_id the bot is using
    console.log('\n📋 Current guilds in database:');
    const [guilds] = await pool.query('SELECT id, discord_id FROM guilds');
    guilds.forEach(guild => {
      console.log(`Guild ID: ${guild.id}, Discord ID: ${guild.discord_id}`);
    });
    
    // Check servers and their guild_ids
    console.log('\n📡 Current servers:');
    const [servers] = await pool.query('SELECT id, nickname, guild_id FROM rust_servers');
    servers.forEach(server => {
      console.log(`Server: ${server.nickname}, Guild ID: ${server.guild_id}`);
    });
    
    // Test what guild_id Discord is sending
    console.log('\n🔧 Testing guild_id conversion...');
    const testDiscordId = '1342235198175182800'; // This is what Discord sends
    
    // Check if this Discord ID exists in guilds table
    const [guildCheck] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [testDiscordId]);
    console.log(`Discord ID ${testDiscordId} found in guilds:`, guildCheck.length > 0 ? 'YES' : 'NO');
    
    if (guildCheck.length > 0) {
      console.log(`Matching guild_id: ${guildCheck[0].id}`);
    } else {
      console.log('❌ This Discord ID is not in the guilds table!');
    }
    
    // Test server lookup with the Discord ID
    console.log('\n🔧 Testing server lookup with Discord ID...');
    const [serverLookup] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)',
      [testDiscordId]
    );
    console.log(`Server lookup returned ${serverLookup.length} results`);
    
    // Test server lookup with direct guild_id
    if (guildCheck.length > 0) {
      const guildId = guildCheck[0].id;
      console.log(`\n🔧 Testing server lookup with guild_id ${guildId}...`);
      const [directLookup] = await pool.query(
        'SELECT id FROM rust_servers WHERE guild_id = ?',
        [guildId]
      );
      console.log(`Direct lookup returned ${directLookup.length} results`);
    }
    
  } catch (error) {
    console.error('❌ Error checking guild IDs:', error);
  } finally {
    process.exit(0);
  }
}

checkGuildIds(); 