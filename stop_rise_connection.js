const pool = require('./src/db');

async function stopRiseConnection() {
  try {
    console.log('🔍 Looking for Rise 3x server to stop RCON connections...');
    
    // Look for any server with "Rise" in the name or the specific IP
    const [riseServers] = await pool.query(
      `SELECT id, nickname, ip, port, guild_id 
       FROM rust_servers 
       WHERE nickname LIKE '%Rise%' OR ip = '149.102.132.219'`
    );
    
    if (riseServers.length === 0) {
      console.log('❌ No Rise servers found in database');
      
      // Let's see all servers to understand what's there
      const [allServers] = await pool.query('SELECT id, nickname, ip, port FROM rust_servers LIMIT 10');
      console.log('\n📋 First 10 servers in database:');
      allServers.forEach(server => {
        console.log(`   ID: ${server.id} | Name: ${server.nickname} | IP: ${server.ip}:${server.port}`);
      });
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

stopRiseConnection(); 