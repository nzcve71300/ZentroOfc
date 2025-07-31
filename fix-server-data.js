const pool = require('./src/db');

async function fixServerData() {
  try {
    console.log('🔧 Fixing server data...');
    
    // Get the current server
    const [servers] = await pool.query('SELECT * FROM rust_servers WHERE nickname = "Unknown Server"');
    
    if (servers.length === 0) {
      console.log('❌ No "Unknown Server" found to update');
      return;
    }
    
    const server = servers[0];
    console.log(`Found server: ${server.nickname} (ID: ${server.id})`);
    
    // Ask user for server details
    console.log('\n📝 Please provide the correct server information:');
    console.log('Current data:');
    console.log(`  Nickname: ${server.nickname}`);
    console.log(`  IP: ${server.ip}`);
    console.log(`  Port: ${server.port}`);
    console.log(`  Password: ${server.password ? 'SET' : 'NOT SET'}`);
    
    console.log('\nTo fix this, you need to:');
    console.log('1. Use the /setup-server command in Discord to add a proper server');
    console.log('2. Or manually update the database with correct server information');
    
    console.log('\nExample /setup-server usage:');
    console.log('/setup-server server_name: "RISE 3X" ip: "your.server.ip" port: 28016 password: "your_rcon_password"');
    
    // Option to delete the placeholder server
    console.log('\nOr you can delete the placeholder server and add a new one:');
    console.log('DELETE FROM rust_servers WHERE nickname = "Unknown Server";');
    
  } catch (error) {
    console.error('❌ Error fixing server data:', error);
  } finally {
    process.exit(0);
  }
}

fixServerData(); 