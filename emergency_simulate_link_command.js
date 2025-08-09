const pool = require('./src/db'); // Use the EXACT same pool as the bot

async function emergencySimulateLinkCommand() {
  console.log('🚨 EMERGENCY: SIMULATE EXACT LINK COMMAND');
  console.log('==========================================\n');

  try {
    console.log('✅ Using the EXACT same database pool as the bot');

    // Test all known guild IDs
    const testGuilds = [
      { name: 'RISE 3X', id: '1391149977434329230' },
      { name: 'Snowy Billiards 2x', id: '1379533411009560626' },
      { name: 'Shadows 3x', id: '1391209638308872254' },
      { name: 'EMPEROR 3X', id: '1342235198175182921' }
    ];

    console.log('📋 TESTING LINK COMMAND FOR ALL GUILDS...\n');

    for (const guild of testGuilds) {
      console.log(`Testing ${guild.name} (${guild.id}):`);
      
      try {
        // This is the EXACT code from the link command
        const [servers] = await pool.query(
          'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
          [guild.id]
        );

        console.log(`   Result: ${servers.length} servers found`);
        
        if (servers.length === 0) {
          console.log('   ❌ LINK COMMAND WOULD FAIL HERE');
          console.log('   ❌ "No servers found in this guild" message');
        } else {
          console.log('   ✅ Link command should work');
          servers.forEach(server => {
            console.log(`      - ${server.nickname} (${server.id})`);
          });
        }
        
      } catch (queryError) {
        console.log(`   ❌ QUERY ERROR: ${queryError.message}`);
      }
      
      console.log(''); // Empty line
    }

    console.log('📋 TESTING DATABASE CONNECTION HEALTH...');
    
    // Test basic connection
    try {
      const [connectionTest] = await pool.query('SELECT 1 as test');
      console.log('✅ Basic database connection works');
    } catch (connError) {
      console.log('❌ Database connection failed:', connError.message);
    }

    // Test guilds table
    try {
      const [guildsTest] = await pool.query('SELECT COUNT(*) as count FROM guilds');
      console.log(`✅ Guilds table accessible: ${guildsTest[0].count} guilds`);
    } catch (guildsError) {
      console.log('❌ Guilds table error:', guildsError.message);
    }

    // Test rust_servers table
    try {
      const [serversTest] = await pool.query('SELECT COUNT(*) as count FROM rust_servers');
      console.log(`✅ Rust_servers table accessible: ${serversTest[0].count} servers`);
    } catch (serversError) {
      console.log('❌ Rust_servers table error:', serversError.message);
    }

    console.log('\n📋 CHECKING FOR RECENT DATABASE CHANGES...');
    
    // Check if our recent fixes broke something
    try {
      const [recentChanges] = await pool.query(`
        SELECT TABLE_NAME, UPDATE_TIME 
        FROM information_schema.tables 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME IN ('guilds', 'rust_servers', 'players') 
        ORDER BY UPDATE_TIME DESC
      `);
      
      console.log('Recent table changes:');
      recentChanges.forEach(change => {
        console.log(`   - ${change.TABLE_NAME}: ${change.UPDATE_TIME || 'No recent changes'}`);
      });
    } catch (metaError) {
      console.log('⚠️ Could not check table metadata:', metaError.message);
    }

    // Close the pool properly
    await pool.end();

    console.log('\n🎯 EMERGENCY SIMULATION COMPLETE!');
    console.log('\nIF ALL GUILDS SHOW 0 SERVERS:');
    console.log('❌ There is a critical database or bot code issue');
    console.log('❌ This explains why /link fails everywhere');
    
    console.log('\nIF SOME GUILDS WORK:');
    console.log('✅ Database is fine, Discord server issue');
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Check the results above');
    console.log('2. If all show 0 servers, we have a critical database issue');
    console.log('3. If some work, you\'re testing in wrong Discord servers');

  } catch (error) {
    console.error('❌ CRITICAL ERROR:', error.message);
    console.error(error);
    
    // Try to close pool anyway
    try {
      await pool.end();
    } catch (closeError) {
      console.error('❌ Could not close database pool:', closeError.message);
    }
  }
}

emergencySimulateLinkCommand();