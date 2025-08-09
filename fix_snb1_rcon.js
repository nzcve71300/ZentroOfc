const pool = require('./src/db');

async function fixSNB1Rcon() {
  console.log('🔧 Fix SNB1 RCON Configuration\n');
  
  try {
    // Show current configuration
    const [current] = await pool.query(`
      SELECT * FROM rust_servers WHERE nickname = 'SNB1'
    `);
    
    if (current.length === 0) {
      console.log('❌ SNB1 server not found in database');
      return;
    }
    
    console.log('📋 Current SNB1 Configuration:');
    console.log(`   IP: ${current[0].ip}`);
    console.log(`   Port: ${current[0].port}`);
    console.log(`   Password: ${current[0].password}\n`);
    
    // Prompt for new details
    console.log('🔧 Common fixes for RCON issues:');
    console.log('');
    console.log('1. Wrong RCON Port:');
    console.log('   - Most Rust servers use port 28016 for RCON');
    console.log('   - Your server might be using 28016 instead of 29816');
    console.log('');
    console.log('2. Wrong RCON Password:');
    console.log('   - Check server.cfg for: rcon.password "actual_password"');
    console.log('   - Password is case-sensitive');
    console.log('');
    console.log('3. Server IP Changed:');
    console.log('   - Verify 81.0.247.39 is still correct');
    console.log('   - Check if server moved to new IP');
    console.log('');
    
    // Try common port fix first
    console.log('🔄 Trying common fix: Change port from 29816 to 28016...');
    
    await pool.query(`
      UPDATE rust_servers 
      SET port = 28016 
      WHERE nickname = 'SNB1'
    `);
    
    console.log('✅ Updated SNB1 port to 28016 (most common RCON port)');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('1. Restart the bot: pm2 restart zentro-bot');
    console.log('2. Check logs: pm2 logs zentro-bot --lines 20');
    console.log('3. If still failing, run: node test_snb1_rcon.js');
    console.log('');
    console.log('💡 If port 28016 doesn\'t work, ask SNB1 server owner for:');
    console.log('   - Correct RCON port (check server.cfg: rcon.port)');
    console.log('   - Correct RCON password (check server.cfg: rcon.password)');
    console.log('   - Confirm server IP hasn\'t changed');
    
  } catch (error) {
    console.error('❌ Error fixing SNB1 RCON:', error);
  } finally {
    await pool.end();
  }
}

fixSNB1Rcon();