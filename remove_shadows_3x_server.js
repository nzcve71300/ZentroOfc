const pool = require('./src/db');

async function removeShadows3xServer() {
  try {
    console.log('🗑️ Removing SHADOWS 3X server...');
    
    // First, find the server
    const [servers] = await pool.query(
      'SELECT * FROM rust_servers WHERE nickname = ?',
      ['SHADOWS 3X']
    );
    
    if (servers.length === 0) {
      console.log('❌ SHADOWS 3X server not found in database');
      return;
    }
    
    const server = servers[0];
    console.log(`📋 Found server: ${server.nickname} (ID: ${server.id})`);
    console.log(`   IP: ${server.ip}:${server.port}`);
    console.log(`   Guild ID: ${server.guild_id}`);
    
    // Start transaction for safety
    await pool.query('START TRANSACTION');
    
    try {
      // Remove all related data first (due to foreign key constraints)
      console.log('\n🧹 Cleaning up related data...');
      
      // Remove transactions (through players)
      const [transactionsResult] = await pool.query(`
        DELETE t FROM transactions t 
        JOIN players p ON t.player_id = p.id 
        WHERE p.server_id = ?
      `, [server.id]);
      console.log(`   ✅ Removed ${transactionsResult.affectedRows} transaction records`);
      
      // Remove economy records (through players)
      const [economyResult] = await pool.query(`
        DELETE e FROM economy e 
        JOIN players p ON e.player_id = p.id 
        WHERE p.server_id = ?
      `, [server.id]);
      console.log(`   ✅ Removed ${economyResult.affectedRows} economy records`);
      
      // Remove players
      const [playersResult] = await pool.query('DELETE FROM players WHERE server_id = ?', [server.id]);
      console.log(`   ✅ Removed ${playersResult.affectedRows} player records`);
      
      // Remove shop items (through categories)
      const [shopItemsResult] = await pool.query(`
        DELETE si FROM shop_items si 
        JOIN shop_categories sc ON si.category_id = sc.id 
        WHERE sc.server_id = ?
      `, [server.id]);
      console.log(`   ✅ Removed ${shopItemsResult.affectedRows} shop items`);
      
      // Remove shop kits (through categories)
      const [shopKitsResult] = await pool.query(`
        DELETE sk FROM shop_kits sk 
        JOIN shop_categories sc ON sk.category_id = sc.id 
        WHERE sc.server_id = ?
      `, [server.id]);
      console.log(`   ✅ Removed ${shopKitsResult.affectedRows} shop kits`);
      
      // Remove shop categories
      const [shopCategoriesResult] = await pool.query('DELETE FROM shop_categories WHERE server_id = ?', [server.id]);
      console.log(`   ✅ Removed ${shopCategoriesResult.affectedRows} shop categories`);
      
      // Remove zones
      const [zonesResult] = await pool.query('DELETE FROM zones WHERE server_id = ?', [server.id]);
      console.log(`   ✅ Removed ${zonesResult.affectedRows} zones`);
      
      // Remove zorp zones
      const [zorpZonesResult] = await pool.query('DELETE FROM zorp_zones WHERE server_id = ?', [server.id]);
      console.log(`   ✅ Removed ${zorpZonesResult.affectedRows} zorp zones`);
      
      // Remove channel settings
      const [channelSettingsResult] = await pool.query('DELETE FROM channel_settings WHERE server_id = ?', [server.id]);
      console.log(`   ✅ Removed ${channelSettingsResult.affectedRows} channel settings`);
      
      // Remove position coordinates
      const [positionResult] = await pool.query('DELETE FROM position_coordinates WHERE server_id = ?', [server.id]);
      console.log(`   ✅ Removed ${positionResult.affectedRows} position coordinates`);
      
      // Remove link requests
      const [linkRequestsResult] = await pool.query('DELETE FROM link_requests WHERE server_id = ?', [server.id]);
      console.log(`   ✅ Removed ${linkRequestsResult.affectedRows} link requests`);
      
      // Remove killfeed configs (if table exists and has server_id column)
      try {
        const [killfeedResult] = await pool.query('DELETE FROM killfeed_configs WHERE server_id = ?', [server.id]);
        console.log(`   ✅ Removed ${killfeedResult.affectedRows} killfeed configs`);
      } catch (error) {
        console.log(`   ℹ️  No killfeed_configs table or no server_id column found`);
      }
      
      // Remove player stats (if table exists and has server_id column)
      try {
        const [playerStatsResult] = await pool.query('DELETE FROM player_stats WHERE server_id = ?', [server.id]);
        console.log(`   ✅ Removed ${playerStatsResult.affectedRows} player stats`);
      } catch (error) {
        console.log(`   ℹ️  No player_stats table or no server_id column found`);
      }
      
      // Remove zorp defaults (if table exists and has server_id column)
      try {
        const [zorpDefaultsResult] = await pool.query('DELETE FROM zorp_defaults WHERE server_id = ?', [server.id]);
        console.log(`   ✅ Removed ${zorpDefaultsResult.affectedRows} zorp defaults`);
      } catch (error) {
        console.log(`   ℹ️  No zorp_defaults table or no server_id column found`);
      }
      
      // Remove eco games (if table exists and has server_id column)
      try {
        const [ecoGamesResult] = await pool.query('DELETE FROM eco_games WHERE server_id = ?', [server.id]);
        console.log(`   ✅ Removed ${ecoGamesResult.affectedRows} eco games records`);
      } catch (error) {
        console.log(`   ℹ️  No eco_games table or no server_id column found`);
      }
      
      // Remove eco games config (if table exists and has server_id column)
      try {
        const [ecoConfigResult] = await pool.query('DELETE FROM eco_games_config WHERE server_id = ?', [server.id]);
        console.log(`   ✅ Removed ${ecoConfigResult.affectedRows} eco games config records`);
      } catch (error) {
        console.log(`   ℹ️  No eco_games_config table or no server_id column found`);
      }
      
      // Remove autokits (if table exists and has server_id column)
      try {
        const [autokitsResult] = await pool.query('DELETE FROM autokits WHERE server_id = ?', [server.id]);
        console.log(`   ✅ Removed ${autokitsResult.affectedRows} autokits`);
      } catch (error) {
        console.log(`   ℹ️  No autokits table or no server_id column found`);
      }
      
      // Remove kit auth (if table exists and has server_id column)
      try {
        const [kitAuthResult] = await pool.query('DELETE FROM kit_auth WHERE server_id = ?', [server.id]);
        console.log(`   ✅ Removed ${kitAuthResult.affectedRows} kit auth records`);
      } catch (error) {
        console.log(`   ℹ️  No kit_auth table or no server_id column found`);
      }
      
      // Remove bounties (if table exists)
      try {
        const [bountiesResult] = await pool.query('DELETE FROM bounties WHERE server_id = ?', [server.id]);
        console.log(`   ✅ Removed ${bountiesResult.affectedRows} bounty records`);
      } catch (error) {
        console.log(`   ℹ️  No bounties table or no records found`);
      }
      
      // Remove prison system (if table exists)
      try {
        const [prisonResult] = await pool.query('DELETE FROM prison_system WHERE server_id = ?', [server.id]);
        console.log(`   ✅ Removed ${prisonResult.affectedRows} prison records`);
      } catch (error) {
        console.log(`   ℹ️  No prison_system table or no records found`);
      }
      
      // Remove rider configs (if table exists)
      try {
        const [riderResult] = await pool.query('DELETE FROM rider_configs WHERE server_id = ?', [server.id]);
        console.log(`   ✅ Removed ${riderResult.affectedRows} rider config records`);
      } catch (error) {
        console.log(`   ℹ️  No rider_configs table or no records found`);
      }
      
      // Remove nivaro store (if table exists)
      try {
        const [nivaroResult] = await pool.query('DELETE FROM nivaro_store WHERE server_id = ?', [server.id]);
        console.log(`   ✅ Removed ${nivaroResult.affectedRows} nivaro store records`);
      } catch (error) {
        console.log(`   ℹ️  No nivaro_store table or no records found`);
      }
      
      // Remove home teleport configs (if table exists)
      try {
        const [homeConfigResult] = await pool.query('DELETE FROM home_teleport_configs WHERE server_id = ?', [server.id]);
        console.log(`   ✅ Removed ${homeConfigResult.affectedRows} home teleport config records`);
      } catch (error) {
        console.log(`   ℹ️  No home_teleport_configs table or no records found`);
      }
      
      // Remove player homes (if table exists)
      try {
        const [playerHomesResult] = await pool.query('DELETE FROM player_homes WHERE server_id = ?', [server.id]);
        console.log(`   ✅ Removed ${playerHomesResult.affectedRows} player home records`);
      } catch (error) {
        console.log(`   ℹ️  No player_homes table or no records found`);
      }
      
      // Remove player whitelists (if table exists)
      try {
        const [whitelistResult] = await pool.query('DELETE FROM player_whitelists WHERE server_id = ?', [server.id]);
        console.log(`   ✅ Removed ${whitelistResult.affectedRows} player whitelist records`);
      } catch (error) {
        console.log(`   ℹ️  No player_whitelists table or no records found`);
      }
      
      // Finally, remove the server itself
      const [serverResult] = await pool.query('DELETE FROM rust_servers WHERE id = ?', [server.id]);
      console.log(`   ✅ Removed ${serverResult.affectedRows} server configuration`);
      
      // Commit transaction
      await pool.query('COMMIT');
      
      console.log('\n🎉 SHADOWS 3X server successfully removed!');
      console.log(`   Server "${server.nickname}" (${server.ip}:${server.port}) has been completely removed from the database.`);
      console.log('\n📝 Summary:');
      console.log(`   - Server ID: ${server.id}`);
      console.log(`   - Guild ID: ${server.guild_id}`);
      console.log(`   - All related data has been cleaned up`);
      console.log('\n✅ The server will no longer appear in your bot logs or cause connection errors.');
      
    } catch (error) {
      // Rollback on error
      await pool.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error removing SHADOWS 3X server:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
removeShadows3xServer();
