const pool = require('./src/db');

async function enableSNB1() {
  try {
    console.log('🔧 Re-enabling SNB1 RCON connections...\n');
    
    // Restore SNB1 IP to enable connection attempts
    const [result] = await pool.query(`
      UPDATE rust_servers 
      SET ip = '81.0.247.39' 
      WHERE nickname = 'SNB1' AND ip = 'DISABLED_RCON'
    `);
    
    if (result.affectedRows > 0) {
      console.log('✅ SNB1 RCON re-enabled');
      console.log('   - Changed IP from DISABLED_RCON to 81.0.247.39');
      console.log('   - Bot will now attempt RCON connections to SNB1');
      console.log('');
      console.log('⚠️  Make sure SNB1 server RCON is properly configured:');
      console.log('   - rcon.web 1');
      console.log('   - rcon.port 29816');
      console.log('   - rcon.password UNeyTVwW');
      console.log('');
      console.log('🚀 Restart bot to apply changes:');
      console.log('   pm2 restart zentro-bot');
    } else {
      console.log('❌ No disabled SNB1 server found');
      console.log('💡 SNB1 might already be enabled or have a different configuration');
    }
    
  } catch (error) {
    console.error('❌ Error enabling SNB1:', error);
  } finally {
    await pool.end();
  }
}

enableSNB1();