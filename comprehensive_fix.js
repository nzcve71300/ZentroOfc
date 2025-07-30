require('dotenv').config();
const mysql = require('mysql2/promise');

async function comprehensiveFix() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    console.log('🔧 Comprehensive fix for channels, autokits, killfeed, and positions...');
    
    // Step 1: Fix channel settings
    console.log('\n📺 Step 1: Fixing channel settings...');
    
    // Delete all existing channel settings for this server
    await pool.query(
      'DELETE FROM channel_settings WHERE server_id = ?',
      ['1753872071391_i24dewly']
    );
    
    // Insert fresh channel settings with correct IDs
    const channelSettings = [
      ['1753872071391_i24dewly', 'adminfeed', 1400098668123783268],
      ['1753872071391_i24dewly', 'admin_feed', 1400098668123783268],
      ['1753872071391_i24dewly', 'playercount', 1400098489311953007],
      ['1753872071391_i24dewly', 'playerfeed', 1396872848748052581],
      ['1753872071391_i24dewly', 'notefeed', 1397975202184429618],
      ['1753872071391_i24dewly', 'eventfeed', 1397975202184429618],
      ['1753872071391_i24dewly', 'killfeed', 1397975202184429618]
    ];
    
    for (const [serverId, channelType, channelId] of channelSettings) {
      await pool.query(
        'INSERT INTO channel_settings (server_id, channel_type, channel_id, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [serverId, channelType, channelId]
      );
    }
    
    console.log('✅ Channel settings updated');
    
    // Step 2: Verify channel settings
    console.log('\n🔍 Step 2: Verifying channel settings...');
    const [verifyResult] = await pool.query(
      `SELECT cs.channel_type, cs.channel_id 
       FROM channel_settings cs 
       JOIN rust_servers rs ON cs.server_id = rs.id 
       JOIN guilds g ON rs.guild_id = g.id 
       WHERE g.discord_id = '1391149977434329230' AND rs.nickname = 'RISE 3X'`
    );
    
    console.log('📋 Current channel settings:');
    verifyResult.forEach(channel => {
      console.log(`- ${channel.channel_type}: ${channel.channel_id}`);
    });
    
    // Step 3: Check autokits configuration
    console.log('\n📦 Step 3: Checking autokits...');
    const [autokitsResult] = await pool.query('SELECT COUNT(*) as count FROM autokits');
    console.log(`- Found ${autokitsResult[0].count} autokit configurations`);
    
    // Test autokit query
    const [testAutokit] = await pool.query(
      'SELECT enabled, cooldown, game_name FROM autokits WHERE server_id = ? AND kit_name = ?',
      ['1753872071391_i24dewly', 'FREEkit1']
    );
    
    if (testAutokit.length > 0) {
      console.log(`- Test autokit query works: ${testAutokit[0].enabled ? 'enabled' : 'disabled'}`);
    } else {
      console.log('- No autokit configurations found for test server');
    }
    
    // Step 4: Check killfeed configuration
    console.log('\n💀 Step 4: Checking killfeed...');
    const [killfeedResult] = await pool.query('SELECT COUNT(*) as count FROM killfeed_configs');
    console.log(`- Found ${killfeedResult[0].count} killfeed configurations`);
    
    const [testKillfeed] = await pool.query(
      'SELECT enabled, format_string FROM killfeed_configs WHERE server_id = ?',
      ['1753872071391_i24dewly']
    );
    
    if (testKillfeed.length > 0) {
      console.log(`- Test killfeed query works: ${testKillfeed[0].enabled ? 'enabled' : 'disabled'}`);
    } else {
      console.log('- No killfeed configurations found for test server');
    }
    
    // Step 5: Check positions configuration
    console.log('\n📍 Step 5: Checking positions...');
    const [positionsResult] = await pool.query('SELECT COUNT(*) as count FROM position_coordinates');
    console.log(`- Found ${positionsResult[0].count} position coordinates`);
    
    const [testPosition] = await pool.query(
      'SELECT x_pos, y_pos, z_pos FROM position_coordinates WHERE server_id = ? AND position_type = ?',
      ['1753872071391_i24dewly', 'outpost']
    );
    
    if (testPosition.length > 0) {
      console.log(`- Test position query works: ${testPosition[0].x_pos}, ${testPosition[0].y_pos}, ${testPosition[0].z_pos}`);
    } else {
      console.log('- No position coordinates found for test server');
    }
    
    // Check position configs
    const [positionConfigsResult] = await pool.query('SELECT COUNT(*) as count FROM position_configs');
    console.log(`- Found ${positionConfigsResult[0].count} position configurations`);
    
    const [testPositionConfig] = await pool.query(
      'SELECT enabled, delay_seconds, cooldown_minutes FROM position_configs WHERE server_id = ? AND position_type = ?',
      ['1753872071391_i24dewly', 'outpost']
    );
    
    if (testPositionConfig.length > 0) {
      console.log(`- Test position config query works: ${testPositionConfig[0].enabled ? 'enabled' : 'disabled'}`);
    } else {
      console.log('- No position configurations found for test server');
    }
    
    console.log('\n✅ Comprehensive fix completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Restart your bot: pm2 restart zentro-bot');
    console.log('2. Test admin spawn messages in your Rust server');
    console.log('3. Test autokits: /kit FREEkit1');
    console.log('4. Test killfeed by killing someone');
    console.log('5. Test positions with outpost/bandit camp emotes');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

comprehensiveFix(); 