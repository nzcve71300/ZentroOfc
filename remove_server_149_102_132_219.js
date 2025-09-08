const pool = require('./src/db');

async function removeServer149102132219() {
  try {
    console.log('🔍 Looking for server 149.102.132.219:30216 in database...');
    
    // First, let's see what servers exist with this IP
    const [allServers] = await pool.query(
      'SELECT id, nickname, ip, port, guild_id FROM rust_servers WHERE ip = ? AND port = ?',
      ['149.102.132.219', 30216]
    );
    
    if (allServers.length === 0) {
      console.log('❌ No server found with IP 149.102.132.219:30216');
      return;
    }
    
    console.log('\n📋 Found server(s) to remove:');
    allServers.forEach(server => {
      console.log(`   ID: ${server.id} | Name: ${server.nickname} | IP: ${server.ip}:${server.port} | Guild: ${server.guild_id}`);
    });
    
    // Remove each server found
    for (const server of allServers) {
      console.log(`\n🗑️ Removing server: ${server.nickname} (${server.id})`);
      
      try {
        // Start transaction for safe deletion
        await pool.query('START TRANSACTION');
        
        // Delete related data first (to respect foreign key constraints)
        console.log('   Deleting related data...');
        
        // Delete players
        const [playerResult] = await pool.query('DELETE FROM players WHERE server_id = ?', [server.id]);
        console.log(`   ✅ Deleted ${playerResult.affectedRows} players`);
        
        // Delete economy games
        const [ecoResult] = await pool.query('DELETE FROM eco_games WHERE server_id = ?', [server.id]);
        console.log(`   ✅ Deleted ${ecoResult.affectedRows} economy games`);
        
        // Delete zones
        const [zoneResult] = await pool.query('DELETE FROM zones WHERE server_id = ?', [server.id]);
        console.log(`   ✅ Deleted ${zoneResult.affectedRows} zones`);
        
        // Delete shop categories and items
        const [categoryResult] = await pool.query('DELETE FROM shop_categories WHERE server_id = ?', [server.id]);
        console.log(`   ✅ Deleted ${categoryResult.affectedRows} shop categories`);
        
        // Delete position coordinates
        const [posResult] = await pool.query('DELETE FROM position_coordinates WHERE server_id = ?', [server.id]);
        console.log(`   ✅ Deleted ${posResult.affectedRows} position coordinates`);
        
        // Delete link requests
        const [linkResult] = await pool.query('DELETE FROM link_requests WHERE server_id = ?', [server.id]);
        console.log(`   ✅ Deleted ${linkResult.affectedRows} link requests`);
        
        // Finally, delete the server itself
        const [serverResult] = await pool.query('DELETE FROM rust_servers WHERE id = ?', [server.id]);
        console.log(`   ✅ Deleted server configuration (${serverResult.affectedRows} record)`);
        
        // Commit transaction
        await pool.query('COMMIT');
        
        console.log(`✅ Successfully removed ${server.nickname} and all related data`);
        
      } catch (error) {
        // Rollback on error
        await pool.query('ROLLBACK');
        console.log(`❌ Failed to remove ${server.nickname}: ${error.message}`);
        throw error;
      }
    }
    
    console.log('\n🎉 Server removal completed!');
    console.log('📍 Removed server: 149.102.132.219:30216');
    console.log('🔑 Password was: JPMGiS0u');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart your bot to stop RCON connection attempts:');
    console.log('      pm2 restart zentro-bot');
    console.log('   2. The server is now completely removed from your system');
    console.log('   3. All related data (players, zones, economy, etc.) has been cleaned up');
    
  } catch (error) {
    console.error('❌ Error removing server:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
removeServer149102132219();
