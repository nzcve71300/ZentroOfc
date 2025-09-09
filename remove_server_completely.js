const pool = require('./src/db');

async function removeServerCompletely(guildId) {
  try {
    console.log(`🗑️ Starting complete removal of server with guild ID: ${guildId}`);
    
    // First, let's see what we're dealing with
    console.log('\n📊 Checking what data exists for this guild...');
    
    // Get guild info
    const [guildResult] = await pool.query(
      'SELECT id, discord_id, name FROM guilds WHERE discord_id = ?',
      [guildId]
    );
    
    if (guildResult.length === 0) {
      console.log('❌ No guild found with that Discord ID');
      return;
    }
    
    const guild = guildResult[0];
    console.log(`🏠 Found guild: ${guild.name} (ID: ${guild.id})`);
    
    // Get all servers for this guild
    const [serversResult] = await pool.query(
      'SELECT id, nickname, ip, port FROM rust_servers WHERE guild_id = ?',
      [guild.id]
    );
    
    console.log(`\n🖥️ Found ${serversResult.length} server(s) for this guild:`);
    serversResult.forEach(server => {
      console.log(`   • ${server.nickname} (ID: ${server.id}) - ${server.ip}:${server.port}`);
    });
    
    if (serversResult.length === 0) {
      console.log('❌ No servers found for this guild');
      return;
    }
    
    // Confirm deletion
    console.log('\n⚠️  WARNING: This will permanently delete ALL data for this guild including:');
    console.log('   • All server configurations');
    console.log('   • All ZORP zones');
    console.log('   • All player data');
    console.log('   • All teleport configurations');
    console.log('   • All economy data');
    console.log('   • All clan data');
    console.log('   • All channel settings');
    console.log('   • All event configurations');
    console.log('   • All kit delivery data');
    console.log('   • All bounty data');
    console.log('   • All leaderboard data');
    console.log('   • Everything else associated with this guild');
    
    console.log('\n🔄 Starting deletion process...');
    
    // Start transaction for atomic deletion
    await pool.query('START TRANSACTION');
    
    try {
      // Delete in order to respect foreign key constraints
      
      // 1. Delete ZORP zones
      console.log('\n🗑️ Deleting ZORP zones...');
      for (const server of serversResult) {
        const [zorpResult] = await pool.query(
          'DELETE FROM zorp_zones WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${zorpResult.affectedRows} ZORP zones from ${server.nickname}`);
      }
      
      // 2. Delete ZORP allowed/banned users
      console.log('\n🗑️ Deleting ZORP user lists...');
      for (const server of serversResult) {
        const [allowedResult] = await pool.query(
          'DELETE FROM zorp_allowed_users WHERE server_id = ?',
          [server.id]
        );
        const [bannedResult] = await pool.query(
          'DELETE FROM zorp_banned_users WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${allowedResult.affectedRows} allowed users and ${bannedResult.affectedRows} banned users from ${server.nickname}`);
      }
      
      // 3. Delete ZORP defaults
      console.log('\n🗑️ Deleting ZORP defaults...');
      for (const server of serversResult) {
        const [defaultsResult] = await pool.query(
          'DELETE FROM zorp_defaults WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${defaultsResult.affectedRows} ZORP defaults from ${server.nickname}`);
      }
      
      // 4. Delete BAR allowed/banned users
      console.log('\n🗑️ Deleting BAR user lists...');
      for (const server of serversResult) {
        const [allowedResult] = await pool.query(
          'DELETE FROM bar_allowed_users WHERE server_id = ?',
          [server.id]
        );
        const [bannedResult] = await pool.query(
          'DELETE FROM bar_banned_users WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${allowedResult.affectedRows} allowed users and ${bannedResult.affectedRows} banned users from ${server.nickname}`);
      }
      
      // 5. Delete rider configs (BAR)
      console.log('\n🗑️ Deleting BAR configurations...');
      for (const server of serversResult) {
        const [riderResult] = await pool.query(
          'DELETE FROM rider_config WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${riderResult.affectedRows} BAR configurations from ${server.nickname}`);
      }
      
      // 6. Delete rider cooldowns
      console.log('\n🗑️ Deleting BAR cooldowns...');
      for (const server of serversResult) {
        const [cooldownResult] = await pool.query(
          'DELETE FROM rider_cooldowns WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${cooldownResult.affectedRows} BAR cooldowns from ${server.nickname}`);
      }
      
      // 7. Delete teleport configurations
      console.log('\n🗑️ Deleting teleport configurations...');
      for (const server of serversResult) {
        const [teleportResult] = await pool.query(
          'DELETE FROM teleport_configs WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${teleportResult.affectedRows} teleport configurations from ${server.nickname}`);
      }
      
      // 8. Delete teleport allowed/banned users
      console.log('\n🗑️ Deleting teleport user lists...');
      for (const server of serversResult) {
        const [allowedResult] = await pool.query(
          'DELETE FROM teleport_allowed_users WHERE server_id = ?',
          [server.id]
        );
        const [bannedResult] = await pool.query(
          'DELETE FROM teleport_banned_users WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${allowedResult.affectedRows} allowed users and ${bannedResult.affectedRows} banned users from ${server.nickname}`);
      }
      
      // 9. Delete position configurations
      console.log('\n🗑️ Deleting position configurations...');
      for (const server of serversResult) {
        const [positionResult] = await pool.query(
          'DELETE FROM position_configs WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${positionResult.affectedRows} position configurations from ${server.nickname}`);
      }
      
      // 10. Delete position coordinates
      console.log('\n🗑️ Deleting position coordinates...');
      for (const server of serversResult) {
        const [coordResult] = await pool.query(
          'DELETE FROM position_coordinates WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${coordResult.affectedRows} position coordinates from ${server.nickname}`);
      }
      
      // 11. Delete home teleport configurations
      console.log('\n🗑️ Deleting home teleport configurations...');
      for (const server of serversResult) {
        const [hometpResult] = await pool.query(
          'DELETE FROM home_teleport_configs WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${hometpResult.affectedRows} home teleport configurations from ${server.nickname}`);
      }
      
      // 12. Delete home teleport allowed/banned users
      console.log('\n🗑️ Deleting home teleport user lists...');
      for (const server of serversResult) {
        const [allowedResult] = await pool.query(
          'DELETE FROM home_teleport_allowed_users WHERE server_id = ?',
          [server.id]
        );
        const [bannedResult] = await pool.query(
          'DELETE FROM home_teleport_banned_users WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${allowedResult.affectedRows} allowed users and ${bannedResult.affectedRows} banned users from ${server.nickname}`);
      }
      
      // 13. Delete recycler configurations
      console.log('\n🗑️ Deleting recycler configurations...');
      for (const server of serversResult) {
        const [recyclerResult] = await pool.query(
          'DELETE FROM recycler_configs WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${recyclerResult.affectedRows} recycler configurations from ${server.nickname}`);
      }
      
      // 14. Delete recycler allowed users
      console.log('\n🗑️ Deleting recycler user lists...');
      for (const server of serversResult) {
        const [allowedResult] = await pool.query(
          'DELETE FROM recycler_allowed_users WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${allowedResult.affectedRows} recycler allowed users from ${server.nickname}`);
      }
      
      // 15. Delete event configurations
      console.log('\n🗑️ Deleting event configurations...');
      for (const server of serversResult) {
        const [eventResult] = await pool.query(
          'DELETE FROM event_configs WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${eventResult.affectedRows} event configurations from ${server.nickname}`);
      }
      
      // 16. Delete crate event configurations
      console.log('\n🗑️ Deleting crate event configurations...');
      for (const server of serversResult) {
        const [crateResult] = await pool.query(
          'DELETE FROM crate_event_configs WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${crateResult.affectedRows} crate event configurations from ${server.nickname}`);
      }
      
      // 17. Delete players
      console.log('\n🗑️ Deleting players...');
      for (const server of serversResult) {
        const [playerResult] = await pool.query(
          'DELETE FROM players WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${playerResult.affectedRows} players from ${server.nickname}`);
      }
      
      // 18. Delete clans
      console.log('\n🗑️ Deleting clans...');
      for (const server of serversResult) {
        const [clanResult] = await pool.query(
          'DELETE FROM clans WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${clanResult.affectedRows} clans from ${server.nickname}`);
      }
      
      // 19. Delete clan members (via clan_id)
      console.log('\n🗑️ Deleting clan members...');
      for (const server of serversResult) {
        // First get all clan IDs for this server
        const [clanIds] = await pool.query(
          'SELECT id FROM clans WHERE server_id = ?',
          [server.id]
        );
        
        if (clanIds.length > 0) {
          const clanIdList = clanIds.map(clan => clan.id);
          const placeholders = clanIdList.map(() => '?').join(',');
          const [memberResult] = await pool.query(
            `DELETE FROM clan_members WHERE clan_id IN (${placeholders})`,
            clanIdList
          );
          console.log(`   • Deleted ${memberResult.affectedRows} clan members from ${server.nickname}`);
        } else {
          console.log(`   • Deleted 0 clan members from ${server.nickname} (no clans found)`);
        }
      }
      
      // 20. Delete economy data
      console.log('\n🗑️ Deleting economy data...');
      for (const server of serversResult) {
        const [economyResult] = await pool.query(
          'DELETE FROM economy WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${economyResult.affectedRows} economy records from ${server.nickname}`);
      }
      
      // 21. Delete shop items
      console.log('\n🗑️ Deleting shop items...');
      for (const server of serversResult) {
        const [shopResult] = await pool.query(
          'DELETE FROM shop_items WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${shopResult.affectedRows} shop items from ${server.nickname}`);
      }
      
      // 22. Delete kit delivery queue
      console.log('\n🗑️ Deleting kit delivery queue...');
      for (const server of serversResult) {
        const [kitResult] = await pool.query(
          'DELETE FROM kit_delivery_queue WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${kitResult.affectedRows} kit delivery records from ${server.nickname}`);
      }
      
      // 23. Delete bounty data
      console.log('\n🗑️ Deleting bounty data...');
      for (const server of serversResult) {
        const [bountyResult] = await pool.query(
          'DELETE FROM bounty_data WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${bountyResult.affectedRows} bounty records from ${server.nickname}`);
      }
      
      // 24. Delete leaderboard data
      console.log('\n🗑️ Deleting leaderboard data...');
      for (const server of serversResult) {
        const [leaderboardResult] = await pool.query(
          'DELETE FROM leaderboard WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${leaderboardResult.affectedRows} leaderboard records from ${server.nickname}`);
      }
      
      // 25. Delete channel settings
      console.log('\n🗑️ Deleting channel settings...');
      for (const server of serversResult) {
        const [channelResult] = await pool.query(
          'DELETE FROM channel_settings WHERE server_id = ?',
          [server.id]
        );
        console.log(`   • Deleted ${channelResult.affectedRows} channel settings from ${server.nickname}`);
      }
      
      // 26. Delete servers
      console.log('\n🗑️ Deleting servers...');
      for (const server of serversResult) {
        const [serverDeleteResult] = await pool.query(
          'DELETE FROM rust_servers WHERE id = ?',
          [server.id]
        );
        console.log(`   • Deleted server: ${server.nickname} (${server.ip}:${server.port})`);
      }
      
      // 27. Delete guild
      console.log('\n🗑️ Deleting guild...');
      const [guildDeleteResult] = await pool.query(
        'DELETE FROM guilds WHERE id = ?',
        [guild.id]
      );
      console.log(`   • Deleted guild: ${guild.name}`);
      
      // Commit the transaction
      await pool.query('COMMIT');
      
      console.log('\n✅ SUCCESS: Server and all associated data have been completely removed!');
      console.log(`\n📊 Summary:`);
      console.log(`   • Guild: ${guild.name} (${guildId})`);
      console.log(`   • Servers removed: ${serversResult.length}`);
      serversResult.forEach(server => {
        console.log(`     - ${server.nickname} (${server.ip}:${server.port})`);
      });
      console.log(`   • All data types: ZORP, BAR, Teleports, Players, Clans, Economy, etc.`);
      
    } catch (error) {
      // Rollback on error
      await pool.query('ROLLBACK');
      console.error('❌ Error during deletion, transaction rolled back:', error);
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error removing server:', error);
  } finally {
    await pool.end();
  }
}

// Run the deletion
const guildId = '1414692371144376395';
removeServerCompletely(guildId);
