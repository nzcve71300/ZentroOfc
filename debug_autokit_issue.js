const pool = require('./src/db');

async function debugAutokitIssue() {
  console.log('🔍 Debugging Autokit "Server Not Found" Issue');
  console.log('=============================================\n');

  try {
    // Step 1: Check all servers in database
    console.log('📋 Step 1: Checking all servers in database...');
    const [serversResult] = await pool.execute('SELECT * FROM rust_servers');
    console.log(`Found ${serversResult.length} servers:`);
    
    for (const server of serversResult) {
      console.log(`- ID: ${server.id}, Nickname: "${server.nickname}", Guild ID: ${server.guild_id}, IP: ${server.ip}:${server.port}`);
    }

    // Step 2: Check all guilds
    console.log('\n📋 Step 2: Checking all guilds...');
    const [guildsResult] = await pool.execute('SELECT * FROM guilds');
    console.log(`Found ${guildsResult.length} guilds:`);
    
    for (const guild of guildsResult) {
      console.log(`- ID: ${guild.id}, Discord ID: ${guild.discord_id}, Name: "${guild.name}"`);
    }

    // Step 3: Test the exact query that's failing
    console.log('\n📋 Step 3: Testing the exact query from handleKitClaim...');
    
    // Let's test with the first server we found
    if (serversResult.length > 0) {
      const testServer = serversResult[0];
      console.log(`Testing with server: "${testServer.nickname}" (Guild ID: ${testServer.guild_id})`);
      
      // Get the guild discord_id
      const [guildResult] = await pool.execute(
        'SELECT discord_id FROM guilds WHERE id = ?',
        [testServer.guild_id]
      );
      
      if (guildResult.length > 0) {
        const guildDiscordId = guildResult[0].discord_id;
        console.log(`Guild Discord ID: ${guildDiscordId}`);
        
        // Now test the exact query from handleKitClaim
        const [serverResult] = await pool.execute(
          'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
          [guildDiscordId, testServer.nickname]
        );
        
        console.log(`Query result: ${serverResult.length} rows found`);
        if (serverResult.length > 0) {
          console.log(`✅ Server found with ID: ${serverResult[0].id}`);
        } else {
          console.log(`❌ Server NOT found!`);
          
          // Let's debug why
          console.log('\n🔍 Debugging why server not found:');
          
          // Check if guild exists
          const [guildCheck] = await pool.execute(
            'SELECT id FROM guilds WHERE discord_id = ?',
            [guildDiscordId]
          );
          console.log(`Guild exists: ${guildCheck.length > 0}`);
          
          // Check if server exists with guild_id
          const [serverCheck] = await pool.execute(
            'SELECT id FROM rust_servers WHERE guild_id = ? AND nickname = ?',
            [testServer.guild_id, testServer.nickname]
          );
          console.log(`Server exists with guild_id: ${serverCheck.length > 0}`);
          
          // Check if server exists with nickname only
          const [nicknameCheck] = await pool.execute(
            'SELECT id, guild_id FROM rust_servers WHERE nickname = ?',
            [testServer.nickname]
          );
          console.log(`Server exists with nickname: ${nicknameCheck.length > 0}`);
          if (nicknameCheck.length > 0) {
            console.log(`Server guild_id: ${nicknameCheck[0].guild_id}, Expected guild_id: ${testServer.guild_id}`);
          }
        }
      } else {
        console.log(`❌ Guild not found for guild_id: ${testServer.guild_id}`);
      }
    }

    // Step 4: Check autokits for the first server
    if (serversResult.length > 0) {
      console.log('\n📋 Step 4: Checking autokits for first server...');
      const testServer = serversResult[0];
      
      const [autokitsResult] = await pool.execute(
        'SELECT * FROM autokits WHERE server_id = ?',
        [testServer.id]
      );
      
      console.log(`Found ${autokitsResult.length} autokits for server "${testServer.nickname}":`);
      for (const autokit of autokitsResult) {
        console.log(`- Kit: ${autokit.kit_name}, Enabled: ${autokit.enabled}, Cooldown: ${autokit.cooldown}, Game Name: "${autokit.game_name}"`);
      }
    }

  } catch (error) {
    console.error('❌ Error during debugging:', error);
  } finally {
    await pool.end();
  }
}

debugAutokitIssue(); 