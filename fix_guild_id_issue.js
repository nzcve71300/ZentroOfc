const pool = require('./src/db');

async function fixGuildIdIssue() {
  try {
    console.log('🔧 Fixing guild ID issue...');
    
    const correctGuildId = '1376030083038318743'; // Your actual guild ID
    const wrongGuildId = '1391149977434329230';   // Wrong guild ID being used
    
    console.log(`\n🔍 Analyzing guild situation:`);
    console.log(`Correct Guild ID: ${correctGuildId}`);
    console.log(`Wrong Guild ID: ${wrongGuildId}`);
    
    // Check both guilds
    const [correctGuild] = await pool.query('SELECT * FROM guilds WHERE discord_id = ?', [correctGuildId]);
    const [wrongGuild] = await pool.query('SELECT * FROM guilds WHERE discord_id = ?', [wrongGuildId]);
    
    console.log(`\n📋 Correct Guild (${correctGuildId}):`);
    if (correctGuild.length > 0) {
      console.log(`   ✅ Exists: ID ${correctGuild[0].id}, Name: ${correctGuild[0].name}`);
      
      // Check servers in correct guild
      const [correctServers] = await pool.query(
        'SELECT * FROM rust_servers WHERE guild_id = ?', 
        [correctGuild[0].id]
      );
      console.log(`   📊 Servers: ${correctServers.length}`);
      correctServers.forEach(server => {
        console.log(`      - ${server.nickname} (${server.id})`);
      });
      
      // Check players in correct guild
      const [correctPlayers] = await pool.query(
        'SELECT COUNT(*) as count FROM players WHERE guild_id = ? AND is_active = true',
        [correctGuild[0].id]
      );
      console.log(`   👥 Active Players: ${correctPlayers[0].count}`);
      
    } else {
      console.log(`   ❌ Does not exist`);
    }
    
    console.log(`\n📋 Wrong Guild (${wrongGuildId}):`);
    if (wrongGuild.length > 0) {
      console.log(`   ⚠️ Exists: ID ${wrongGuild[0].id}, Name: ${wrongGuild[0].name}`);
      
      // Check servers in wrong guild
      const [wrongServers] = await pool.query(
        'SELECT * FROM rust_servers WHERE guild_id = ?', 
        [wrongGuild[0].id]
      );
      console.log(`   📊 Servers: ${wrongServers.length}`);
      wrongServers.forEach(server => {
        console.log(`      - ${server.nickname} (${server.id})`);
      });
      
      // Check players in wrong guild
      const [wrongPlayers] = await pool.query(
        'SELECT COUNT(*) as count FROM players WHERE guild_id = ? AND is_active = true',
        [wrongGuild[0].id]
      );
      console.log(`   👥 Active Players: ${wrongPlayers[0].count}`);
      
    } else {
      console.log(`   ✅ Does not exist (good)`);
    }
    
    // Test the link command with both guild IDs
    console.log(`\n🧪 Testing link command queries:`);
    
    const testIgn = 'XsLdSsG';
    
    // Test with correct guild ID
    const [correctGuildQuery] = await pool.query(`
      SELECT p.*, rs.nickname 
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
      AND LOWER(p.ign) = LOWER(?)`,
      [correctGuildId, testIgn]
    );
    
    console.log(`   Correct Guild Query: Found ${correctGuildQuery.length} records for ${testIgn}`);
    
    // Test with wrong guild ID
    const [wrongGuildQuery] = await pool.query(`
      SELECT p.*, rs.nickname 
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
      AND LOWER(p.ign) = LOWER(?)`,
      [wrongGuildId, testIgn]
    );
    
    console.log(`   Wrong Guild Query: Found ${wrongGuildQuery.length} records for ${testIgn}`);
    
    // Show the fix
    console.log(`\n🔧 THE FIX:`);
    console.log(`The bot is using the wrong guild ID. You need to:`);
    console.log(`1. Find where the guild ID ${wrongGuildId} is hardcoded in your bot`);
    console.log(`2. Replace it with the correct guild ID ${correctGuildId}`);
    console.log(`3. OR fix the /setup-server command to use the correct guild ID`);
    
    console.log(`\n🔍 Common places to check:`);
    console.log(`- Environment variables (.env file)`);
    console.log(`- Config files`);
    console.log(`- Hardcoded values in bot startup`);
    console.log(`- /setup-server command implementation`);
    
    // If wrong guild exists but shouldn't, offer to clean it up
    if (wrongGuild.length > 0 && wrongServers.length === 0 && wrongPlayers[0].count === 0) {
      console.log(`\n🗑️ CLEANUP OPTION:`);
      console.log(`The wrong guild exists but has no servers or players.`);
      console.log(`You can safely delete it with:`);
      console.log(`DELETE FROM guilds WHERE discord_id = '${wrongGuildId}';`);
    }
    
    console.log(`\n✅ Once you fix the guild ID in your bot config, the linking should work perfectly!`);
    
  } catch (error) {
    console.error('❌ Error fixing guild ID issue:', error);
  } finally {
    await pool.end();
  }
}

fixGuildIdIssue();
