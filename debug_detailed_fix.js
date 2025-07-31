const pool = require('./src/db');

async function debugDetailedFix() {
  console.log('🔍 Detailed Debug - Post Fix');
  console.log('==============================\n');

  try {
    // Check current state
    console.log('📋 Current Database State:');
    const [servers] = await pool.execute('SELECT * FROM rust_servers');
    const [guilds] = await pool.execute('SELECT * FROM guilds');
    
    console.log(`- Servers: ${servers.length}`);
    console.log(`- Guilds: ${guilds.length}\n`);
    
    for (const server of servers) {
      console.log(`Server: "${server.nickname}"`);
      console.log(`  - ID: ${server.id}`);
      console.log(`  - Guild ID: ${server.guild_id}`);
      console.log(`  - IP: ${server.ip}:${server.port}`);
    }
    
    for (const guild of guilds) {
      console.log(`Guild: "${guild.name}"`);
      console.log(`  - ID: ${guild.id}`);
      console.log(`  - Discord ID: ${guild.discord_id}`);
    }

    // Test the verification query step by step
    console.log('\n🔍 Testing Verification Query:');
    
    if (servers.length > 0 && guilds.length > 0) {
      const server = servers[0];
      const guild = guilds[0];
      
      console.log(`Testing with server ID: ${server.id}, guild ID: ${guild.id}`);
      
      // Test 1: Check if server exists
      const [serverCheck] = await pool.execute(
        'SELECT * FROM rust_servers WHERE id = ?',
        [server.id]
      );
      console.log(`Server exists: ${serverCheck.length > 0}`);
      
      // Test 2: Check if guild exists
      const [guildCheck] = await pool.execute(
        'SELECT * FROM guilds WHERE id = ?',
        [guild.id]
      );
      console.log(`Guild exists: ${guildCheck.length > 0}`);
      
      // Test 3: Check the JOIN query
      const [joinCheck] = await pool.execute(
        'SELECT rs.id, rs.nickname, rs.guild_id, g.discord_id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE rs.id = ?',
        [server.id]
      );
      console.log(`JOIN query result: ${joinCheck.length} rows`);
      
      if (joinCheck.length > 0) {
        console.log(`  - Server: "${joinCheck[0].nickname}"`);
        console.log(`  - Guild ID: ${joinCheck[0].guild_id}`);
        console.log(`  - Discord ID: ${joinCheck[0].discord_id}`);
      }
      
      // Test 4: Check the autokit query
      console.log('\n🧪 Testing Autokit Query:');
      const [autokitCheck] = await pool.execute(
        'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
        ['1391149977434329300', server.nickname]
      );
      console.log(`Autokit query result: ${autokitCheck.length} rows`);
      
      if (autokitCheck.length > 0) {
        console.log(`  - Server ID: ${autokitCheck[0].id}`);
      }
      
      // Test 5: Check the subquery separately
      console.log('\n🔍 Testing Subquery:');
      const [subqueryCheck] = await pool.execute(
        'SELECT id FROM guilds WHERE discord_id = ?',
        ['1391149977434329300']
      );
      console.log(`Subquery result: ${subqueryCheck.length} rows`);
      
      if (subqueryCheck.length > 0) {
        console.log(`  - Guild ID: ${subqueryCheck[0].id}`);
        
        // Test 6: Check if server exists with this guild_id
        const [serverWithGuild] = await pool.execute(
          'SELECT id FROM rust_servers WHERE guild_id = ? AND nickname = ?',
          [subqueryCheck[0].id, server.nickname]
        );
        console.log(`Server with guild_id check: ${serverWithGuild.length} rows`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugDetailedFix(); 