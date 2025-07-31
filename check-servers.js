const pool = require('./src/db');

async function checkServers() {
  try {
    console.log('🔍 Checking servers in database...');
    
    // Check all servers
    const [servers] = await pool.query('SELECT * FROM rust_servers');
    console.log(`Found ${servers.length} servers:`);
    
    servers.forEach((server, index) => {
      console.log(`\n${index + 1}. Server ID: ${server.id}`);
      console.log(`   Nickname: ${server.nickname}`);
      console.log(`   Guild ID: ${server.guild_id}`);
      console.log(`   IP: ${server.ip}`);
      console.log(`   Port: ${server.port}`);
      console.log(`   Password: ${server.password ? 'SET' : 'NOT SET'}`);
    });
    
    // Check guilds
    const [guilds] = await pool.query('SELECT * FROM guilds');
    console.log(`\nFound ${guilds.length} guilds:`);
    
    guilds.forEach((guild, index) => {
      console.log(`\n${index + 1}. Guild ID: ${guild.id}`);
      console.log(`   Discord ID: ${guild.discord_id}`);
      console.log(`   Name: ${guild.name}`);
    });
    
    // Test autocomplete query for first guild
    if (guilds.length > 0) {
      const guildId = guilds[0].discord_id;
      console.log(`\n🧪 Testing autocomplete query for guild ${guildId}:`);
      
      const [autocompleteResult] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
        [guildId, '%']
      );
      
      console.log(`Autocomplete found ${autocompleteResult.length} servers for guild ${guildId}:`);
      autocompleteResult.forEach(server => {
        console.log(`  - ${server.nickname}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking servers:', error);
  } finally {
    process.exit(0);
  }
}

checkServers(); 