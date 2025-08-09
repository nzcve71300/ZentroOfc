const pool = require('./src/db');

async function checkSNB1Config() {
  try {
    console.log('🔍 Checking SNB1 server configuration...\n');
    
    // Check SNB1 server details
    const [servers] = await pool.query(`
      SELECT rs.*, g.discord_id, g.name as guild_name
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
      WHERE rs.nickname = 'SNB1'
    `);
    
    if (servers.length === 0) {
      console.log('❌ SNB1 server not found in database');
      return;
    }
    
    const server = servers[0];
    console.log('📊 SNB1 Server Configuration:');
    console.log(`   Guild: ${server.guild_name} (${server.discord_id})`);
    console.log(`   Nickname: ${server.nickname}`);
    console.log(`   IP: ${server.ip}`);
    console.log(`   Port: ${server.port}`);
    console.log(`   Password: ${server.password}`);
    console.log(`   Created: ${server.created_at}`);
    console.log(`   Updated: ${server.updated_at}`);
    
    // Check if this matches the failing connection
    console.log(`\n🔍 Analysis:`);
    if (server.ip === '81.0.247.39' && server.port === 29816) {
      console.log('✅ Configuration matches the failing connection in logs');
      console.log('❌ Issue: Server is returning HTTP 501 "Not Implemented"');
      console.log('');
      console.log('💡 Possible causes:');
      console.log('   1. RCON is disabled on the Rust server');
      console.log('   2. Wrong RCON password');
      console.log('   3. Server is down/restarting');
      console.log('   4. Firewall blocking RCON connections');
      console.log('   5. RCON port changed on the server');
      console.log('');
      console.log('🔧 Solutions to try:');
      console.log('   1. Check if the Rust server is online and accessible');
      console.log('   2. Verify RCON is enabled in server.cfg: rcon.web 1');
      console.log('   3. Verify RCON password matches server.cfg: rcon.password');
      console.log('   4. Check RCON port matches server.cfg: rcon.port');
      console.log('   5. Test RCON connection manually with a tool like RustAdmin');
    } else {
      console.log('❌ Configuration mismatch - database shows different IP/port');
    }
    
  } catch (error) {
    console.error('❌ Error checking SNB1 config:', error);
  } finally {
    await pool.end();
  }
}

checkSNB1Config();