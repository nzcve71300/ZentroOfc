const pool = require('./src/db');

async function removeRiseQuick() {
  try {
    console.log('🔍 Looking for Rise 3x server...');
    
    // Remove by IP address (most reliable)
    const [result] = await pool.query(
      'DELETE FROM rust_servers WHERE ip = ?',
      ['149.102.132.219']
    );
    
    if (result.affectedRows > 0) {
      console.log(`✅ Removed ${result.affectedRows} server(s) with IP 149.102.132.219`);
    } else {
      console.log('❌ No servers found with that IP');
      
      // Try by name
      const [nameResult] = await pool.query(
        'DELETE FROM rust_servers WHERE nickname LIKE ?',
        ['%Rise%']
      );
      
      if (nameResult.affectedRows > 0) {
        console.log(`✅ Removed ${nameResult.affectedRows} server(s) with "Rise" in name`);
      } else {
        console.log('❌ No Rise servers found');
      }
    }
    
    console.log('\n🔄 Restart your bot: pm2 restart zentro-bot');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

removeRiseQuick(); 