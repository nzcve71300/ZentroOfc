const pool = require('./src/db');

async function cleanupInvalidServers() {
  try {
    console.log('🧹 Cleaning up invalid server entries...');
    
    // Find servers with invalid IP addresses
    const [invalidServers] = await pool.query(`
      SELECT id, nickname, ip, port, guild_id 
      FROM rust_servers 
      WHERE ip = '0.0.0.0' 
         OR ip = 'PLACEHOLDER_IP' 
         OR ip = 'localhost' 
         OR ip = '127.0.0.1'
         OR ip IS NULL
         OR port = 0
         OR port IS NULL
    `);
    
    if (invalidServers.length === 0) {
      console.log('✅ No invalid servers found');
      return;
    }
    
    console.log(`⚠️ Found ${invalidServers.length} invalid servers:`);
    invalidServers.forEach(server => {
      console.log(`   - ${server.nickname} (${server.ip}:${server.port})`);
    });
    
    // Ask for confirmation before deletion
    console.log('\n❓ Do you want to delete these invalid servers? (y/N)');
    console.log('   This will remove them from the database permanently.');
    console.log('   You can add them back later with correct IP/port information.');
    
    // For now, just log them - you can manually delete them
    console.log('\n📝 To manually delete these servers, run:');
    console.log('   DELETE FROM rust_servers WHERE id IN (' + invalidServers.map(s => `'${s.id}'`).join(',') + ');');
    
    // Also check for servers with invalid IP format
    const [formatInvalidServers] = await pool.query(`
      SELECT id, nickname, ip, port 
      FROM rust_servers 
      WHERE ip NOT REGEXP '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$'
         AND ip IS NOT NULL
         AND ip != '0.0.0.0'
         AND ip != 'PLACEHOLDER_IP'
         AND ip != 'localhost'
         AND ip != '127.0.0.1'
    `);
    
    if (formatInvalidServers.length > 0) {
      console.log(`\n⚠️ Found ${formatInvalidServers.length} servers with invalid IP format:`);
      formatInvalidServers.forEach(server => {
        console.log(`   - ${server.nickname} (${server.ip}:${server.port})`);
      });
    }
    
    console.log('\n✅ Cleanup analysis complete');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await pool.end();
  }
}

cleanupInvalidServers(); 