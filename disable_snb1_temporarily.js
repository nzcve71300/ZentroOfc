const pool = require('./src/db');

async function disableSNB1Temporarily() {
  try {
    console.log('🔧 Temporarily disabling SNB1 RCON connections...\n');
    
    // Update SNB1 to use a placeholder IP to prevent connection attempts
    const [result] = await pool.query(`
      UPDATE rust_servers 
      SET ip = 'DISABLED_RCON' 
      WHERE nickname = 'SNB1' AND ip = '81.0.247.39'
    `);
    
    if (result.affectedRows > 0) {
      console.log('✅ SNB1 RCON temporarily disabled');
      console.log('   - Changed IP from 81.0.247.39 to DISABLED_RCON');
      console.log('   - This will stop the connection spam in logs');
      console.log('   - Bot will skip RCON connections for SNB1');
      console.log('');
      console.log('📋 To re-enable when server RCON is fixed:');
      console.log('   1. Contact SNB1 server owner to enable RCON:');
      console.log('      - Add to server.cfg: rcon.web 1');
      console.log('      - Add to server.cfg: rcon.port 29816');
      console.log('      - Add to server.cfg: rcon.password UNeyTVwW');
      console.log('   2. Test RCON connection manually');
      console.log('   3. Run: node enable_snb1.js');
      console.log('');
      console.log('🚀 Restart bot now to apply changes:');
      console.log('   pm2 restart zentro-bot');
    } else {
      console.log('❌ No SNB1 server found with IP 81.0.247.39');
    }
    
  } catch (error) {
    console.error('❌ Error disabling SNB1:', error);
  } finally {
    await pool.end();
  }
}

disableSNB1Temporarily();