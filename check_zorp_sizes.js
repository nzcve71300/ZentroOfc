const pool = require('./src/db');

async function checkZorpSizes() {
  try {
    console.log('🔍 Checking current ZORP size settings...');
    
    const [result] = await pool.query(`
      SELECT rs.nickname, zd.size, zd.color_online, zd.color_offline
      FROM zorp_defaults zd
      JOIN rust_servers rs ON zd.server_id = rs.id
      ORDER BY rs.nickname
    `);
    
    console.log('\n📊 Current ZORP Settings:');
    result.forEach(server => {
      console.log(`🏠 Server: ${server.nickname}`);
      console.log(`   Size: ${server.size} (this is the RADIUS, so diameter = ${server.size * 2})`);
      console.log(`   Online Color: ${server.color_online}`);
      console.log(`   Offline Color: ${server.color_offline}`);
      console.log('');
    });
    
    console.log('💡 The Issue:');
    console.log('• The size value is used as RADIUS in the zones.createcustomzone command');
    console.log('• So if you set size to 25, the zone has radius 25 and diameter 50');
    console.log('• This makes zones appear much larger than expected');
    console.log('');
    console.log('🔧 Solutions:');
    console.log('1. Divide the size by 2 when creating zones (convert diameter to radius)');
    console.log('2. Update the UI to show "Radius" instead of "Size"');
    console.log('3. Update the UI to show both radius and diameter');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking ZORP sizes:', error);
    process.exit(1);
  }
}

checkZorpSizes();
