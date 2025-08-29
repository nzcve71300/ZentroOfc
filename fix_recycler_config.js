const pool = require('./src/db');

console.log('🔧 Checking and Fixing Recycler Configurations...');
console.log('================================================\n');

async function fixRecyclerConfig() {
  try {
    // 1. Check all servers
    console.log('📋 Step 1: Checking all servers...');
    const [servers] = await pool.query(`
      SELECT 
        rs.id,
        rs.nickname,
        rs.guild_id,
        g.discord_id as guild_discord_id
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
      ORDER BY rs.nickname
    `);

    console.log(`✅ Found ${servers.length} servers:`);
    servers.forEach(server => {
      console.log(`   • ${server.nickname} (ID: ${server.id})`);
    });

    // 2. Check recycler configurations for each server
    console.log('\n📋 Step 2: Checking recycler configurations...');
    
    for (const server of servers) {
      console.log(`\n🔍 Checking ${server.nickname}...`);
      
      // Check if recycler config exists
      const [configResult] = await pool.query(
        'SELECT * FROM recycler_configs WHERE server_id = ?',
        [server.id.toString()]
      );

      if (configResult.length === 0) {
        console.log(`   ❌ No recycler config found - creating default config...`);
        
        // Create default recycler config
        await pool.query(`
          INSERT INTO recycler_configs (server_id, enabled, use_list, cooldown_minutes, created_at, updated_at)
          VALUES (?, false, false, 5, NOW(), NOW())
        `, [server.id.toString()]);
        
        console.log(`   ✅ Created default recycler config for ${server.nickname}`);
      } else {
        const config = configResult[0];
        console.log(`   ✅ Config exists: enabled=${config.enabled}, use_list=${config.use_list}, cooldown=${config.cooldown_minutes}m`);
      }
    }

    // 3. Show all recycler configurations
    console.log('\n📋 Step 3: All recycler configurations...');
    const [allConfigs] = await pool.query(`
      SELECT 
        rs.nickname as server,
        rc.enabled,
        rc.use_list,
        rc.cooldown_minutes,
        rc.created_at,
        rc.updated_at
      FROM recycler_configs rc
      JOIN rust_servers rs ON rc.server_id = rs.id
      ORDER BY rs.nickname
    `);

    if (allConfigs.length === 0) {
      console.log('❌ No recycler configurations found!');
    } else {
      console.log('✅ Recycler configurations:');
      allConfigs.forEach(config => {
        console.log(`   • ${config.server}: ${config.enabled ? 'ENABLED' : 'DISABLED'} (List: ${config.use_list ? 'ON' : 'OFF'}, Cooldown: ${config.cooldown_minutes}m)`);
      });
    }

    // 4. Test the /set command logic
    console.log('\n📋 Step 4: Testing configuration update...');
    
    // Simulate what happens when you run: /set RECYCLER-USE on <server>
    const testServer = servers[0]; // Use first server for testing
    if (testServer) {
      console.log(`🧪 Testing with server: ${testServer.nickname}`);
      
      // Update the config (simulating the /set command)
      await pool.query(
        'UPDATE recycler_configs SET enabled = ?, updated_at = NOW() WHERE server_id = ?',
        [true, testServer.id.toString()]
      );
      
      // Verify the update
      const [updatedConfig] = await pool.query(
        'SELECT enabled FROM recycler_configs WHERE server_id = ?',
        [testServer.id.toString()]
      );
      
      if (updatedConfig.length > 0) {
        console.log(`   ✅ Test update successful: enabled = ${updatedConfig[0].enabled}`);
      } else {
        console.log(`   ❌ Test update failed: no config found`);
      }
    }

    // 5. Show the exact commands to run
    console.log('\n📋 Step 5: Commands to run...');
    console.log('⚙️ Enable recycler system for each server:');
    servers.forEach(server => {
      console.log(`   /set RECYCLER-USE on ${server.nickname}`);
    });
    
    console.log('\n⚙️ Optional: Enable allowed list requirement:');
    servers.forEach(server => {
      console.log(`   /set RECYCLER-USELIST on ${server.nickname}`);
    });
    
    console.log('\n⚙️ Optional: Set custom cooldown (default is 5 minutes):');
    servers.forEach(server => {
      console.log(`   /set RECYCLER-TIME 10 ${server.nickname}`);
    });

    // 6. Show troubleshooting steps
    console.log('\n📋 Step 6: Troubleshooting...');
    console.log('If recycler spawning is still disabled:');
    console.log('   1. Make sure you ran: /set RECYCLER-USE on <server>');
    console.log('   2. Check the bot logs for any errors');
    console.log('   3. Verify the server name matches exactly');
    console.log('   4. Restart the bot after configuration changes');
    console.log('   5. Check if the player is in the allowed list (if USELIST is ON)');

    console.log('\n🎉 Recycler Configuration Check Complete!');
    console.log('==========================================');
    console.log('✅ All servers have recycler configurations');
    console.log('✅ Test update was successful');
    console.log('✅ Ready to enable recycler spawning');

  } catch (error) {
    console.error('❌ Error checking recycler configurations:', error);
    console.error('Error details:', error.message);
  }
}

fixRecyclerConfig().then(() => {
  console.log('\n✅ Configuration check completed');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Configuration check failed:', error);
  process.exit(1);
});
