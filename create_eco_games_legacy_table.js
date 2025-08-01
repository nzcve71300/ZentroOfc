const pool = require('./src/db');

async function createEcoGamesLegacyTable() {
  try {
    console.log('🔧 Creating legacy eco_games table...');
    
    // Create the legacy eco_games table that the blackjack command expects
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS eco_games (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        setup VARCHAR(50) NOT NULL,
        option VARCHAR(100) NOT NULL,
        option_value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_config (server_id, setup, option)
      )
    `;
    
    await pool.query(createTableSQL);
    console.log('✅ Legacy eco_games table created successfully!');
    
    // Verify the table exists
    const [result] = await pool.query('SHOW TABLES LIKE "eco_games"');
    
    if (result.length > 0) {
      console.log('✅ Table verification successful - eco_games table exists');
      
      // Show table structure
      const [structure] = await pool.query('DESCRIBE eco_games');
      console.log('📋 Table structure:');
      structure.forEach(row => {
        console.log(`   ${row.Field} - ${row.Type} - ${row.Null} - ${row.Key} - ${row.Default}`);
      });
      
      // Set up blackjack configuration in the legacy format
      const serverId = '1753965211295_c5pfupu9';
      
      console.log('🔧 Setting up blackjack configuration in legacy format...');
      
      const blackjackConfigs = [
        { setup: 'blackjack', option: 'min_max_bet', option_value: '1,10000' },
        { setup: 'blackjack', option: 'enabled', option_value: 'true' },
        { setup: 'slots', option: 'min_max_bet', option_value: '1,10000' },
        { setup: 'slots', option: 'enabled', option_value: 'true' },
        { setup: 'daily', option: 'reward_amount', option_value: '100' },
        { setup: 'daily', option: 'enabled', option_value: 'true' }
      ];
      
      for (const config of blackjackConfigs) {
        await pool.query(
          'INSERT INTO eco_games (server_id, setup, option, option_value) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE option_value = VALUES(option_value)',
          [serverId, config.setup, config.option, config.option_value]
        );
        console.log(`✅ Set ${config.setup}.${config.option} = ${config.option_value}`);
      }
      
      // Verify the configurations
      const [verifyResult] = await pool.query(
        'SELECT * FROM eco_games WHERE server_id = ?',
        [serverId]
      );
      
      console.log('\n📋 Eco games configurations:');
      verifyResult.forEach(config => {
        console.log(`   ${config.setup}.${config.option}: ${config.option_value}`);
      });
      
      console.log('\n🎉 Legacy eco_games table setup complete!');
      console.log('💡 The /blackjack command should now work properly');
      
    } else {
      console.log('❌ Table verification failed - eco_games table not found');
    }
    
  } catch (error) {
    console.error('❌ Error creating legacy eco_games table:', error);
  } finally {
    await pool.end();
  }
}

createEcoGamesLegacyTable(); 