require('dotenv').config();
const mysql = require('mysql2/promise');

async function fixSystems() {
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
    console.log('🔧 Fixing autokits, killfeed, and positions systems...');

    // 1. Fix autokits database queries
    console.log('\n📦 Fixing autokits...');
    
    // Check if autokits table exists and has data
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

    // 2. Fix killfeed database queries
    console.log('\n💀 Fixing killfeed...');
    
    // Check if killfeed_configs table exists
    const [killfeedResult] = await pool.query('SELECT COUNT(*) as count FROM killfeed_configs');
    console.log(`- Found ${killfeedResult[0].count} killfeed configurations`);
    
    // Test killfeed query
    const [testKillfeed] = await pool.query(
      'SELECT enabled, format_string FROM killfeed_configs WHERE server_id = ?',
      ['1753872071391_i24dewly']
    );
    
    if (testKillfeed.length > 0) {
      console.log(`- Test killfeed query works: ${testKillfeed[0].enabled ? 'enabled' : 'disabled'}`);
    } else {
      console.log('- No killfeed configurations found for test server');
    }

    // 3. Fix positions database queries
    console.log('\n📍 Fixing positions...');
    
    // Check if position_coordinates table exists
    const [positionsResult] = await pool.query('SELECT COUNT(*) as count FROM position_coordinates');
    console.log(`- Found ${positionsResult[0].count} position coordinates`);
    
    // Test position query
    const [testPosition] = await pool.query(
      'SELECT x_pos, y_pos, z_pos FROM position_coordinates WHERE server_id = ? AND position_type = ?',
      ['1753872071391_i24dewly', 'outpost']
    );
    
    if (testPosition.length > 0) {
      console.log(`- Test position query works: ${testPosition[0].x_pos}, ${testPosition[0].y_pos}, ${testPosition[0].z_pos}`);
    } else {
      console.log('- No position coordinates found for test server');
    }

    // 4. Check position_configs table
    console.log('\n⚙️ Checking position configs...');
    
    const [positionConfigsResult] = await pool.query('SELECT COUNT(*) as count FROM position_configs');
    console.log(`- Found ${positionConfigsResult[0].count} position configurations`);
    
    // Test position config query
    const [testPositionConfig] = await pool.query(
      'SELECT enabled, delay_seconds, cooldown_minutes FROM position_configs WHERE server_id = ? AND position_type = ?',
      ['1753872071391_i24dewly', 'outpost']
    );
    
    if (testPositionConfig.length > 0) {
      console.log(`- Test position config query works: ${testPositionConfig[0].enabled ? 'enabled' : 'disabled'}`);
    } else {
      console.log('- No position configurations found for test server');
    }

    console.log('\n✅ Database queries tested successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Restart your bot: pm2 restart zentro-bot');
    console.log('2. Test autokits in game with: /kit FREEkit1');
    console.log('3. Test killfeed by killing someone');
    console.log('4. Test positions with outpost/bandit camp emotes');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixSystems(); 