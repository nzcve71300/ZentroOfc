const pool = require('./src/db');

async function removeEmp2ServerFinal() {
  try {
    console.log('🗑️ Removing EMP2 server...');
    
    // Step 1: Find the EMP2 server by IP and port
    console.log('\n📋 Step 1: Finding EMP2 server...');
    const [servers] = await pool.query(`
      SELECT * FROM rust_servers 
      WHERE ip = '81.0.247.39' AND port = 29816
    `);
    
    if (servers.length === 0) {
      console.log('❌ No EMP2 server found with IP 81.0.247.39:29816');
      
      // Try searching by nickname as backup
      console.log('\n📋 Trying to find by nickname...');
      const [nicknameServers] = await pool.query(`
        SELECT * FROM rust_servers 
        WHERE nickname LIKE '%EMP2%' OR nickname LIKE '%emp2%'
      `);
      
      if (nicknameServers.length === 0) {
        console.log('❌ No EMP2 server found by nickname either');
        return;
      } else {
        console.log(`Found ${nicknameServers.length} servers with EMP2 in name:`);
        nicknameServers.forEach((server, index) => {
          console.log(`   ${index + 1}. ${server.nickname} (${server.ip}:${server.port})`);
        });
        return;
      }
    }
    
    const server = servers[0];
    console.log(`📋 Found server: ${server.nickname} (ID: ${server.id})`);
    console.log(`   IP: ${server.ip}:${server.port}`);
    console.log(`   Guild ID: ${server.guild_id}`);
    
    // Step 2: Clean up related data
    console.log('\n🧹 Cleaning up related data...');
    
    // Remove eco games records
    try {
      const [ecoGamesResult] = await pool.query(
        'DELETE FROM eco_games WHERE server_id = ?',
        [server.id]
      );
      console.log(`   Removed ${ecoGamesResult.affectedRows} eco games records`);
    } catch (error) {
      console.log(`   ⚠️ No eco_games table or no records found`);
    }
    
    // Remove eco games config records
    try {
      const [ecoGamesConfigResult] = await pool.query(
        'DELETE FROM eco_games_config WHERE server_id = ?',
        [server.id]
      );
      console.log(`   Removed ${ecoGamesConfigResult.affectedRows} eco games config records`);
    } catch (error) {
      console.log(`   ⚠️ No eco_games_config table or no records found`);
    }
    
    // Remove player records
    try {
      const [playersResult] = await pool.query(
        'DELETE FROM players WHERE server_id = ?',
        [server.id]
      );
      console.log(`   Removed ${playersResult.affectedRows} player records`);
    } catch (error) {
      console.log(`   ⚠️ Error removing player records:`, error.message);
    }
    
    // Remove economy records
    try {
      const [economyResult] = await pool.query(
        'DELETE FROM economy WHERE server_id = ?',
        [server.id]
      );
      console.log(`   Removed ${economyResult.affectedRows} economy records`);
    } catch (error) {
      console.log(`   ⚠️ No economy table or no records found`);
    }
    
    // Remove transaction records
    try {
      const [transactionsResult] = await pool.query(
        'DELETE FROM transactions WHERE server_id = ?',
        [server.id]
      );
      console.log(`   Removed ${transactionsResult.affectedRows} transaction records`);
    } catch (error) {
      console.log(`   ⚠️ No transactions table or no records found`);
    }
    
    // Remove shop category records
    try {
      const [shopCategoriesResult] = await pool.query(
        'DELETE FROM shop_categories WHERE server_id = ?',
        [server.id]
      );
      console.log(`   Removed ${shopCategoriesResult.affectedRows} shop category records`);
    } catch (error) {
      console.log(`   ⚠️ No shop_categories table or no records found`);
    }
    
    // Remove shop item records
    try {
      const [shopItemsResult] = await pool.query(
        'DELETE FROM shop_items WHERE server_id = ?',
        [server.id]
      );
      console.log(`   Removed ${shopItemsResult.affectedRows} shop item records`);
    } catch (error) {
      console.log(`   ⚠️ No shop_items table or no records found`);
    }
    
    // Remove kit authorization records
    try {
      const [kitAuthResult] = await pool.query(
        'DELETE FROM kit_authorizations WHERE server_id = ?',
        [server.id]
      );
      console.log(`   Removed ${kitAuthResult.affectedRows} kit authorization records`);
    } catch (error) {
      console.log(`   ⚠️ No kit_authorizations table or no records found`);
    }
    
    // Remove autokit configuration records
    try {
      const [autokitResult] = await pool.query(
        'DELETE FROM autokit_configurations WHERE server_id = ?',
        [server.id]
      );
      console.log(`   Removed ${autokitResult.affectedRows} autokit configuration records`);
    } catch (error) {
      console.log(`   ⚠️ No autokit_configurations table or no records found`);
    }
    
    // Remove zone records
    try {
      const [zonesResult] = await pool.query(
        'DELETE FROM zones WHERE server_id = ?',
        [server.id]
      );
      console.log(`   Removed ${zonesResult.affectedRows} zone records`);
    } catch (error) {
      console.log(`   ⚠️ No zones table or no records found`);
    }
    
    // Step 3: Remove the server itself
    console.log('\n🗑️ Removing EMP2 server from rust_servers...');
    const [deleteResult] = await pool.query(
      'DELETE FROM rust_servers WHERE id = ?',
      [server.id]
    );
    
    if (deleteResult.affectedRows > 0) {
      console.log(`✅ Successfully removed EMP2 server: ${server.nickname}`);
      console.log('\n🎯 EMP2 SERVER REMOVAL COMPLETE!');
      console.log('🔄 Restart the bot with: pm2 restart zentro-bot');
      console.log('📡 The bot will no longer attempt to connect to this server');
    } else {
      console.log('❌ Failed to remove EMP2 server');
    }
    
  } catch (error) {
    console.error('❌ Error removing EMP2 server:', error);
  } finally {
    await pool.end();
  }
}

removeEmp2ServerFinal(); 