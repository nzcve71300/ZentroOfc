const pool = require('./src/db');

async function debugRiderSystem() {
  try {
    console.log('🔍 SSH: Debugging Rider System...');

    // Check if rider_config table exists
    console.log('\n📋 Checking rider_config table...');
    try {
      const [configs] = await pool.query('SELECT * FROM rider_config');
      console.log(`✅ rider_config table exists with ${configs.length} records`);
      configs.forEach((config, index) => {
        console.log(`   ${index + 1}. Server: ${config.server_id}, Enabled: ${config.enabled}, Cooldown: ${config.cooldown}`);
      });
    } catch (configError) {
      console.log('❌ rider_config table does not exist:', configError.message);
    }

    // Check if rider_cooldowns table exists
    console.log('\n📋 Checking rider_cooldowns table...');
    try {
      const [cooldowns] = await pool.query('SELECT * FROM rider_cooldowns');
      console.log(`✅ rider_cooldowns table exists with ${cooldowns.length} records`);
      cooldowns.forEach((cooldown, index) => {
        console.log(`   ${index + 1}. Player: ${cooldown.player_name}, Vehicle: ${cooldown.vehicle_type}, Server: ${cooldown.server_id}`);
      });
    } catch (cooldownError) {
      console.log('❌ rider_cooldowns table does not exist:', cooldownError.message);
    }

    // Check server configuration for Emperor 3x
    console.log('\n🏰 Checking Emperor 3x server configuration...');
    const [emperorServer] = await pool.query(`
      SELECT rs.id, rs.nickname, g.discord_id, rc.enabled, rc.cooldown
      FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id 
      LEFT JOIN rider_config rc ON rs.id = rc.server_id
      WHERE rs.nickname = 'Emperor 3x'
    `);

    if (emperorServer.length === 0) {
      console.log('❌ Emperor 3x server not found');
    } else {
      const server = emperorServer[0];
      console.log('✅ Emperor 3x server found:');
      console.log(`   Server ID: ${server.id}`);
      console.log(`   Guild Discord ID: ${server.discord_id}`);
      console.log(`   Rider Enabled: ${server.enabled !== null ? (server.enabled ? 'Yes' : 'No') : 'No config'}`);
      console.log(`   Rider Cooldown: ${server.cooldown || 'Default (300s)'}`);
    }

    // Test the query that Book-a-Ride uses
    console.log('\n🧪 Testing Book-a-Ride server query...');
    const guildId = '1342235198175182921'; // Emperor 3x guild ID
    const serverName = 'Emperor 3x';
    
    const [testResult] = await pool.query(
      'SELECT rs.id, rc.enabled, rc.cooldown FROM rust_servers rs LEFT JOIN rider_config rc ON rs.id = rc.server_id WHERE rs.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND rs.nickname = ?',
      [guildId, serverName]
    );

    if (testResult.length === 0) {
      console.log('❌ Book-a-Ride query returned no results');
      
      // Debug the guild lookup
      const [guildCheck] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [guildId]);
      if (guildCheck.length === 0) {
        console.log('❌ Guild not found with Discord ID:', guildId);
      } else {
        console.log('✅ Guild found with ID:', guildCheck[0].id);
        
        // Debug the server lookup
        const [serverCheck] = await pool.query('SELECT id, nickname FROM rust_servers WHERE guild_id = ?', [guildCheck[0].id]);
        console.log(`📊 Servers for this guild: ${serverCheck.length} found`);
        serverCheck.forEach((srv, index) => {
          console.log(`   ${index + 1}. "${srv.nickname}" (ID: ${srv.id})`);
        });
      }
    } else {
      console.log('✅ Book-a-Ride query successful:');
      const result = testResult[0];
      console.log(`   Server ID: ${result.id}`);
      console.log(`   Enabled: ${result.enabled !== null ? (result.enabled ? 'Yes' : 'No') : 'No config (default enabled)'}`);
      console.log(`   Cooldown: ${result.cooldown || 'Default (300s)'}`);
    }

    console.log('\n💡 Recommendations:');
    console.log('1. If tables don\'t exist, run: node setup_rider_config_ssh.js');
    console.log('2. If server query fails, check guild/server configuration');
    console.log('3. If everything looks good, the issue might be in the position response handling');

  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
debugRiderSystem().catch(console.error);