const pool = require('./src/db');

async function checkAndFixStartingBalance() {
  try {
    console.log('🔍 Checking starting balance configuration for all servers...');
    
    // Get all servers
    const [servers] = await pool.query('SELECT id, nickname FROM rust_servers');
    console.log(`📋 Found ${servers.length} servers:`);
    
    for (const server of servers) {
      console.log(`\n🔧 Checking server: ${server.nickname} (ID: ${server.id})`);
      
      // Check if starting_balance exists for this server
      const [configResult] = await pool.query(
        'SELECT setting_value FROM eco_games_config WHERE server_id = ? AND setting_name = ?',
        [server.id, 'starting_balance']
      );
      
      if (configResult.length === 0) {
        console.log(`❌ No starting_balance config found for ${server.nickname}`);
        console.log(`🔧 Adding default starting_balance of 500 for ${server.nickname}...`);
        
        await pool.query(
          'INSERT INTO eco_games_config (server_id, setting_name, setting_value) VALUES (?, ?, ?)',
          [server.id, 'starting_balance', '500']
        );
        
        console.log(`✅ Added starting_balance = 500 for ${server.nickname}`);
      } else {
        const currentValue = configResult[0].setting_value;
        console.log(`✅ starting_balance = ${currentValue} for ${server.nickname}`);
      }
      
      // Also check other important configs
      const configsToCheck = [
        { name: 'daily_amount', default: '100' },
        { name: 'coinflip_toggle', default: 'true' },
        { name: 'blackjack_toggle', default: 'true' }
      ];
      
      for (const config of configsToCheck) {
        const [result] = await pool.query(
          'SELECT setting_value FROM eco_games_config WHERE server_id = ? AND setting_name = ?',
          [server.id, config.name]
        );
        
        if (result.length === 0) {
          console.log(`⚠️ Missing ${config.name} config for ${server.nickname}, adding default: ${config.default}`);
          await pool.query(
            'INSERT INTO eco_games_config (server_id, setting_name, setting_value) VALUES (?, ?, ?)',
            [server.id, config.name, config.default]
          );
        }
      }
    }
    
    console.log('\n📋 Final configuration summary:');
    const [allConfigs] = await pool.query(`
      SELECT rs.nickname, egc.setting_name, egc.setting_value 
      FROM eco_games_config egc 
      JOIN rust_servers rs ON egc.server_id = rs.id 
      ORDER BY rs.nickname, egc.setting_name
    `);
    
    let currentServer = '';
    for (const config of allConfigs) {
      if (config.nickname !== currentServer) {
        console.log(`\n🎯 ${config.nickname}:`);
        currentServer = config.nickname;
      }
      console.log(`   ${config.setting_name}: ${config.setting_value}`);
    }
    
    console.log('\n🎉 Starting balance configuration check complete!');
    console.log('💡 Now when players use /link, they will get the configured starting balance.');
    
  } catch (error) {
    console.error('❌ Error checking starting balance configuration:', error);
  } finally {
    await pool.end();
  }
}

checkAndFixStartingBalance();
