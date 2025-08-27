const pool = require('./src/db');

async function testTeleportConfig() {
  try {
    console.log('🔍 Testing Teleport Configuration...');
    console.log('=====================================\n');

    // Test query to see all teleport configs
    console.log('1. All teleport configurations:');
    const [allConfigs] = await pool.query('SELECT * FROM teleport_configs');
    
    if (allConfigs.length === 0) {
      console.log('   No teleport configurations found in database');
    } else {
      allConfigs.forEach(config => {
        console.log(`   - Server: ${config.server_id}, Teleport: ${config.teleport_name}`);
        console.log(`     Enabled: ${config.enabled}, Use List: ${config.use_list}`);
        console.log(`     Cooldown: ${config.cooldown_minutes}min, Delay: ${config.delay_minutes}min`);
        console.log('');
      });
    }

    // Test all teleport configurations
    console.log('2. All teleport configurations by type:');
    const teleportTypes = ['default', 'tpn', 'tpne', 'tpe', 'tpse', 'tps', 'tpsw', 'tpw', 'tpnw'];
    
    for (const teleportType of teleportTypes) {
      const [configs] = await pool.query(
        'SELECT * FROM teleport_configs WHERE teleport_name = ?',
        [teleportType]
      );

      if (configs.length === 0) {
        console.log(`   ${teleportType.toUpperCase()}: No configurations found`);
      } else {
        configs.forEach(config => {
          console.log(`   ${teleportType.toUpperCase()}:`);
          console.log(`     Server: ${config.server_id}`);
          console.log(`     Enabled: ${config.enabled}`);
          console.log(`     Use List: ${config.use_list}`);
          console.log(`     Cooldown: ${config.cooldown_minutes}min`);
          console.log(`     Delay: ${config.delay_minutes}min`);
          console.log(`     Display Name: ${config.display_name}`);
          console.log('');
        });
      }
    }

    // Test teleport usage tracking
    console.log('3. Teleport usage tracking:');
    const [usageData] = await pool.query(
      'SELECT teleport_name, COUNT(*) as usage_count FROM teleport_usage GROUP BY teleport_name ORDER BY usage_count DESC'
    );

    if (usageData.length === 0) {
      console.log('   No teleport usage data found');
    } else {
      usageData.forEach(usage => {
        console.log(`   ${usage.teleport_name.toUpperCase()}: ${usage.usage_count} uses`);
      });
    }

    console.log('✅ Teleport configuration test complete!');

  } catch (error) {
    console.error('❌ Error testing teleport config:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testTeleportConfig();
