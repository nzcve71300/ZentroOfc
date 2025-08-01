const pool = require('./src/db');

console.log('🔍 Testing autocomplete with current guild setup...');

async function testAutocompleteLive() {
  try {
    // Test with the actual Discord guild IDs
    const testGuilds = [
      { discord_id: '1391149977434329230', name: 'Rise 3x' },
      { discord_id: '1342235198175182921', name: 'EMPEROR 3X' }
    ];
    
    for (const guild of testGuilds) {
      console.log(`\n🔧 Testing guild: ${guild.name} (Discord ID: ${guild.discord_id})`);
      
      // Get the guild_id from the database
      const [guildResult] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [guild.discord_id]);
      
      if (guildResult.length > 0) {
        const guildId = guildResult[0].id;
        console.log(`Found guild_id: ${guildId}`);
        
        // Test server autocomplete query
        const [serverResults] = await pool.query(
          'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ? LIMIT 25',
          [guildId, '%']
        );
        console.log(`Server autocomplete returned ${serverResults.length} results:`, serverResults.map(r => r.nickname));
        
        // Test category autocomplete query
        if (serverResults.length > 0) {
          const serverName = serverResults[0].nickname;
          const [categoryResults] = await pool.query(
            `SELECT sc.id, sc.name FROM shop_categories sc 
             JOIN rust_servers rs ON sc.server_id = rs.id 
             WHERE rs.guild_id = ? AND rs.nickname = ? 
             AND (sc.type = 'items' OR sc.type = 'both')
             AND sc.name LIKE ? LIMIT 25`,
            [guildId, serverName, '%']
          );
          console.log(`Category autocomplete returned ${categoryResults.length} results:`, categoryResults.map(r => r.name));
        }
      } else {
        console.log(`❌ Guild not found in database!`);
      }
    }
    
    // Test the exact query that the commands use
    console.log('\n🔧 Testing exact command query...');
    const testDiscordId = '1391149977434329230';
    const [exactQuery] = await pool.query(
      'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
      [testDiscordId, '%']
    );
    console.log(`Exact command query returned ${exactQuery.length} results:`, exactQuery.map(r => r.nickname));
    
  } catch (error) {
    console.error('❌ Error testing autocomplete:', error);
  } finally {
    process.exit(0);
  }
}

testAutocompleteLive(); 