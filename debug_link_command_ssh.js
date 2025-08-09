const pool = require('./src/db');

async function debugLinkCommand() {
  try {
    console.log('🔍 SSH: Debugging /link Command Issue...');

    // Test with each guild ID to see what happens
    const testGuildIds = [
      '1342235198175182921', // Emperor 3x
      '1391149977434329230', // Rise 3x
      '1379533411009560626', // Snowy Billiards 2x
      '1391209638308872254'  // Shadows 3x
    ];

    console.log('\n🧪 Testing /link query for each guild...');
    
    for (const guildId of testGuildIds) {
      console.log(`\n--- Testing Guild ID: ${guildId} ---`);
      
      try {
        // This is the exact query from the /link command
        const [servers] = await pool.query(
          'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
          [guildId]
        );
        
        console.log(`✅ Query executed successfully`);
        console.log(`📊 Found ${servers.length} server(s):`);
        
        if (servers.length === 0) {
          console.log(`❌ NO SERVERS FOUND - This would cause "No Server Found" error`);
          
          // Let's debug why no servers were found
          console.log(`🔍 Debugging why no servers found for guild ${guildId}:`);
          
          // Check if guild exists
          const [guild] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [guildId]);
          if (guild.length === 0) {
            console.log(`   ❌ Guild ${guildId} does NOT exist in guilds table`);
          } else {
            console.log(`   ✅ Guild ${guildId} exists with internal ID: ${guild[0].id}`);
            
            // Check servers with this guild_id
            const [serversWithGuildId] = await pool.query('SELECT id, nickname, guild_id FROM rust_servers WHERE guild_id = ?', [guild[0].id]);
            console.log(`   📊 Servers with guild_id ${guild[0].id}:`);
            serversWithGuildId.forEach(server => {
              console.log(`     - ${server.nickname} (ID: ${server.id})`);
            });
          }
        } else {
          console.log(`✅ SERVERS FOUND - /link should work:`);
          servers.forEach(server => {
            console.log(`   - ${server.nickname} (ID: ${server.id})`);
          });
        }
        
      } catch (error) {
        console.error(`❌ Query failed for guild ${guildId}:`, error.message);
      }
    }

    // Let's also check the current state of all data
    console.log('\n📋 Current Database State Summary:');
    
    const [allGuilds] = await pool.query('SELECT id, discord_id, name FROM guilds ORDER BY id');
    console.log(`\n🏰 Guilds (${allGuilds.length}):`);
    allGuilds.forEach(guild => {
      console.log(`   ID: ${guild.id}, Discord: ${guild.discord_id}, Name: ${guild.name}`);
    });
    
    const [allServers] = await pool.query(`
      SELECT rs.id, rs.nickname, rs.guild_id, g.discord_id 
      FROM rust_servers rs 
      LEFT JOIN guilds g ON rs.guild_id = g.id 
      ORDER BY rs.nickname
    `);
    console.log(`\n🖥️  Servers (${allServers.length}):`);
    allServers.forEach(server => {
      console.log(`   ${server.nickname}:`);
      console.log(`     Server ID: ${server.id}`);
      console.log(`     Guild ID (internal): ${server.guild_id}`);
      console.log(`     Discord ID: ${server.discord_id}`);
    });

    // Test the exact /link logic step by step
    console.log('\n🧪 Testing exact /link command logic:');
    const testDiscordId = '1252993829007528086'; // From the logs
    const testGuildId = '1379533411009560626'; // Snowy Billiards 2x
    const testIgn = 'nzcve7130'; // From the logs
    
    console.log(`\n--- Simulating /link for user ${testDiscordId} in guild ${testGuildId} with IGN "${testIgn}" ---`);
    
    // Step 1: Get servers
    const [linkServers] = await pool.query(
      'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
      [testGuildId]
    );
    
    console.log(`Step 1 - Get servers: Found ${linkServers.length} servers`);
    if (linkServers.length === 0) {
      console.log(`❌ This is where the "No Server Found" error occurs!`);
      
      // Debug the subquery
      const [guildCheck] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [testGuildId]);
      console.log(`Guild lookup result:`, guildCheck);
      
      if (guildCheck.length > 0) {
        const [serverCheck] = await pool.query('SELECT id, nickname FROM rust_servers WHERE guild_id = ?', [guildCheck[0].id]);
        console.log(`Servers with guild_id ${guildCheck[0].id}:`, serverCheck);
      }
    } else {
      console.log(`✅ Servers found, /link should proceed normally`);
    }

    console.log('\n🎯 Conclusion:');
    if (linkServers.length === 0) {
      console.log('❌ The /link command fails because the server lookup query returns no results.');
      console.log('💡 This suggests either:');
      console.log('   1. Guild ID mismatch between Discord and database');
      console.log('   2. Server guild_id references wrong internal guild ID');
      console.log('   3. Guild does not exist in guilds table');
    } else {
      console.log('✅ The database should be working correctly for /link command');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
debugLinkCommand().catch(console.error);