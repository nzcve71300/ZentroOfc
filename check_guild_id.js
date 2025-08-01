const pool = require('./src/db');

console.log('🔍 Checking guild_id mismatch...');

async function checkGuildId() {
  try {
    // Check all servers and their guild_ids
    console.log('\n📡 All servers and their guild_ids:');
    const [servers] = await pool.query('SELECT id, nickname, guild_id FROM rust_servers');
    servers.forEach(server => {
      console.log(`Server: ${server.nickname}, Guild ID: ${server.guild_id} (Type: ${typeof server.guild_id})`);
    });
    
    // Check if there are any guilds in the guilds table
    console.log('\n🏛️ Checking guilds table:');
    const [guilds] = await pool.query('SELECT id, discord_id FROM guilds');
    console.log('Guilds in guilds table:', guilds);
    
    // Check if the guild_id from the category matches any guild
    console.log('\n🔍 Checking guild_id from category...');
    const categoryGuildId = 1342235198175182800;
    console.log(`Category guild_id: ${categoryGuildId}`);
    
    const [matchingGuild] = await pool.query('SELECT id, discord_id FROM guilds WHERE id = ?', [categoryGuildId]);
    console.log('Matching guild in guilds table:', matchingGuild);
    
    const [matchingServer] = await pool.query('SELECT id, nickname, guild_id FROM rust_servers WHERE guild_id = ?', [categoryGuildId]);
    console.log('Matching server in rust_servers table:', matchingServer);
    
    // Check what the actual Discord guild ID should be
    if (matchingGuild.length > 0) {
      console.log(`\n💡 The Discord guild ID should be: ${matchingGuild[0].discord_id}`);
      console.log(`But the category is using guild_id: ${categoryGuildId}`);
    }
    
  } catch (error) {
    console.error('❌ Error checking guild_id:', error);
  } finally {
    process.exit(0);
  }
}

checkGuildId(); 