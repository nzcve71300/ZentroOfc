const pool = require('./src/db');

async function removeShadowsServer() {
  try {
    console.log('🗑️ Removing Shadows 3x server...');
    
    // First, find the server
    const [servers] = await pool.query(
      'SELECT * FROM rust_servers WHERE nickname = ?',
      ['Shadows 3x']
    );
    
    if (servers.length === 0) {
      console.log('❌ Shadows 3x server not found in database');
      return;
    }
    
    const server = servers[0];
    console.log(`📋 Found server: ${server.nickname} (ID: ${server.id})`);
    console.log(`   IP: ${server.ip}:${server.port}`);
    console.log(`   Guild ID: ${server.guild_id}`);
    
    // Remove all related data first
    console.log('\n🧹 Cleaning up related data...');
    
    // Remove eco games
    const [ecoGamesResult] = await pool.query(
      'DELETE FROM eco_games WHERE server_id = ?',
      [server.id]
    );
    console.log(`   Removed ${ecoGamesResult.affectedRows} eco games records`);
    
    // Remove eco games config
    const [ecoConfigResult] = await pool.query(
      'DELETE FROM eco_games_config WHERE server_id = ?',
      [server.id]
    );
    console.log(`   Removed ${ecoConfigResult.affectedRows} eco games config records`);
    
    // Remove players
    const [playersResult] = await pool.query(
      'DELETE FROM players WHERE server_id = ?',
      [server.id]
    );
    console.log(`   Removed ${playersResult.affectedRows} player records`);
    
    // Remove economy records for players on this server
    const [economyResult] = await pool.query(
      'DELETE FROM economy WHERE player_id IN (SELECT id FROM players WHERE server_id = ?)',
      [server.id]
    );
    console.log(`   Removed ${economyResult.affectedRows} economy records`);
    
    // Remove transactions for players on this server
    const [transactionsResult] = await pool.query(
      'DELETE FROM transactions WHERE player_id IN (SELECT id FROM players WHERE server_id = ?)',
      [server.id]
    );
    console.log(`   Removed ${transactionsResult.affectedRows} transaction records`);
    
    // Remove shop categories
    const [shopCategoriesResult] = await pool.query(
      'DELETE FROM shop_categories WHERE server_id = ?',
      [server.id]
    );
    console.log(`   Removed ${shopCategoriesResult.affectedRows} shop category records`);
    
    // Remove shop items
    const [shopItemsResult] = await pool.query(
      'DELETE FROM shop_items WHERE server_id = ?',
      [server.id]
    );
    console.log(`   Removed ${shopItemsResult.affectedRows} shop item records`);
    
    // Remove kit authorizations
    const [kitAuthResult] = await pool.query(
      'DELETE FROM kit_authorizations WHERE server_id = ?',
      [server.id]
    );
    console.log(`   Removed ${kitAuthResult.affectedRows} kit authorization records`);
    
    // Remove autokit configurations
    const [autokitResult] = await pool.query(
      'DELETE FROM autokit_configurations WHERE server_id = ?',
      [server.id]
    );
    console.log(`   Removed ${autokitResult.affectedRows} autokit configuration records`);
    
    // Remove zones
    const [zonesResult] = await pool.query(
      'DELETE FROM zones WHERE server_id = ?',
      [server.id]
    );
    console.log(`   Removed ${zonesResult.affectedRows} zone records`);
    
    // Finally, remove the server itself
    const [serverResult] = await pool.query(
      'DELETE FROM rust_servers WHERE id = ?',
      [server.id]
    );
    console.log(`   Removed ${serverResult.affectedRows} server record`);
    
    console.log('\n✅ Shadows 3x server removed successfully!');
    console.log('🔄 Restart the bot with: pm2 restart zentro-bot');
    
  } catch (error) {
    console.error('❌ Error removing Shadows 3x server:', error);
  } finally {
    await pool.end();
  }
}

removeShadowsServer(); 