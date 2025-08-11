const pool = require('./src/db');

async function removeRiseServer() {
  try {
    console.log('🔍 Looking for Rise 3x server in database...');
    
    // First, let's see what servers exist
    const [allServers] = await pool.query('SELECT id, nickname, ip, port FROM rust_servers');
    console.log('\n📋 All servers in database:');
    allServers.forEach(server => {
      console.log(`   ID: ${server.id} | Name: ${server.nickname} | IP: ${server.ip}:${server.port}`);
    });
    
    // Look for Rise 3x specifically
    const [riseServers] = await pool.query(
      'SELECT id, nickname, ip, port FROM rust_servers WHERE nickname LIKE ?',
      ['%Rise%']
    );
    
    if (riseServers.length === 0) {
      console.log('\n❌ No Rise servers found in database');
      return;
    }
    
    console.log('\n🎯 Found Rise servers:');
    riseServers.forEach(server => {
      console.log(`   ID: ${server.id} | Name: ${server.nickname} | IP: ${server.ip}:${server.port}`);
    });
    
    // Remove all Rise servers
    for (const server of riseServers) {
      console.log(`\n🗑️ Removing server: ${server.nickname} (${server.id})`);
      
      // Delete the server (this will cascade to related tables)
      const [result] = await pool.query('DELETE FROM rust_servers WHERE id = ?', [server.id]);
      
      if (result.affectedRows > 0) {
        console.log(`✅ Successfully removed ${server.nickname}`);
      } else {
        console.log(`❌ Failed to remove ${server.nickname}`);
      }
    }
    
    console.log('\n✅ Rise server removal completed!');
    console.log('🔄 Please restart your bot to stop the connection spam:');
    console.log('   pm2 restart zentro-bot');
    
  } catch (error) {
    console.error('❌ Error removing Rise server:', error);
  } finally {
    await pool.end();
  }
}

removeRiseServer(); 