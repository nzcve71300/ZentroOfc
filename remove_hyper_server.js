const pool = require('./src/db');

async function removeHyperServer() {
  try {
    console.log('🗑️ Removing Hyper 18x RCE server...');
    
    // Step 1: Find the Hyper 18x RCE server
    console.log('\n📋 Step 1: Finding Hyper 18x RCE server...');
    const [servers] = await pool.query(`
      SELECT * FROM rust_servers 
      WHERE nickname LIKE '%Hyper%' OR nickname LIKE '%hyper%' OR ip = '176.57.160.193'
    `);
    
    if (servers.length === 0) {
      console.log('❌ No Hyper server found in database');
      
      // Show all servers to help identify
      const [allServers] = await pool.query('SELECT id, nickname, ip, port FROM rust_servers LIMIT 10');
      console.log('\n📋 First 10 servers in database:');
      allServers.forEach(server => {
        console.log(`   ID: ${server.id} | Name: ${server.nickname} | IP: ${server.ip}:${server.port}`);
      });
      return;
    }
    
    console.log(`\n🎯 Found ${servers.length} Hyper server(s):`);
    servers.forEach((server, index) => {
      console.log(`   ${index + 1}. ${server.nickname} (ID: ${server.id})`);
      console.log(`      IP: ${server.ip}:${server.port}`);
      console.log(`      Guild ID: ${server.guild_id}`);
    });
    
    // Remove all Hyper servers
    for (const server of servers) {
      console.log(`\n🗑️ Removing server: ${server.nickname} (${server.id})`);
      
      // Clean up related data first
      console.log('   🧹 Cleaning up related data...');
      
      // Remove eco games records
      try {
        const [ecoGamesResult] = await pool.query(
          'DELETE FROM eco_games WHERE server_id = ?',
          [server.id]
        );
        console.log(`      Removed ${ecoGamesResult.affectedRows} eco games records`);
      } catch (error) {
        console.log(`      ⚠️ No eco_games table or no records found`);
      }
      
      // Remove eco games config records
      try {
        const [ecoConfigResult] = await pool.query(
          'DELETE FROM eco_games_config WHERE server_id = ?',
          [server.id]
        );
        console.log(`      Removed ${ecoConfigResult.affectedRows} eco games config records`);
      } catch (error) {
        console.log(`      ⚠️ No eco_games_config table or no records found`);
      }
      
      // Remove player records
      try {
        const [playersResult] = await pool.query(
          'DELETE FROM players WHERE server_id = ?',
          [server.id]
        );
        console.log(`      Removed ${playersResult.affectedRows} player records`);
      } catch (error) {
        console.log(`      ⚠️ Error removing player records:`, error.message);
      }
      
      // Remove economy records
      try {
        const [economyResult] = await pool.query(
          'DELETE FROM economy WHERE player_id IN (SELECT id FROM players WHERE server_id = ?)',
          [server.id]
        );
        console.log(`      Removed ${economyResult.affectedRows} economy records`);
      } catch (error) {
        console.log(`      ⚠️ Error removing economy records:`, error.message);
      }
      
      // Remove transactions
      try {
        const [transactionsResult] = await pool.query(
          'DELETE FROM transactions WHERE player_id IN (SELECT id FROM players WHERE server_id = ?)',
          [server.id]
        );
        console.log(`      Removed ${transactionsResult.affectedRows} transaction records`);
      } catch (error) {
        console.log(`      ⚠️ Error removing transaction records:`, error.message);
      }
      
      // Remove rider config
      try {
        const [riderConfigResult] = await pool.query(
          'DELETE FROM rider_config WHERE server_id = ?',
          [server.id]
        );
        console.log(`      Removed ${riderConfigResult.affectedRows} rider config records`);
      } catch (error) {
        console.log(`      ⚠️ Error removing rider config:`, error.message);
      }
      
      // Remove rider cooldowns
      try {
        const [riderCooldownsResult] = await pool.query(
          'DELETE FROM rider_cooldowns WHERE server_id = ?',
          [server.id]
        );
        console.log(`      Removed ${riderCooldownsResult.affectedRows} rider cooldown records`);
      } catch (error) {
        console.log(`      ⚠️ Error removing rider cooldowns:`, error.message);
      }
      
      // Remove ZORP zones
      try {
        const [zorpZonesResult] = await pool.query(
          'DELETE FROM zorp_zones WHERE server_id = ?',
          [server.id]
        );
        console.log(`      Removed ${zorpZonesResult.affectedRows} ZORP zone records`);
      } catch (error) {
        console.log(`      ⚠️ Error removing ZORP zones:`, error.message);
      }
      
      // Remove ZORP defaults
      try {
        const [zorpDefaultsResult] = await pool.query(
          'DELETE FROM zorp_defaults WHERE server_id = ?',
          [server.id]
        );
        console.log(`      Removed ${zorpDefaultsResult.affectedRows} ZORP default records`);
      } catch (error) {
        console.log(`      ⚠️ Error removing ZORP defaults:`, error.message);
      }
      
      // Finally, delete the server itself
      const [result] = await pool.query('DELETE FROM rust_servers WHERE id = ?', [server.id]);
      
      if (result.affectedRows > 0) {
        console.log(`   ✅ Successfully removed ${server.nickname}`);
      } else {
        console.log(`   ❌ Failed to remove ${server.nickname}`);
      }
    }
    
    console.log('\n✅ Hyper server removal completed!');
    console.log('🔄 Please restart your bot to stop the connection spam:');
    console.log('   pm2 restart zentro-bot');
    
  } catch (error) {
    console.error('❌ Error removing Hyper server:', error);
  } finally {
    await pool.end();
  }
}

removeHyperServer();
