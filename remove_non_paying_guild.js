const pool = require('./src/db');

async function removeNonPayingGuild() {
  const guildDiscordId = '1348735121481535548'; // BLOODRUST guild - stopped paying
  
  console.log('🗑️ Removing non-paying guild data...');
  console.log(`Target Guild Discord ID: ${guildDiscordId}`);
  console.log('='.repeat(50));
  
  try {
    // First, find the guild and its associated data
    console.log('\n📋 Step 1: Finding guild and associated data...');
    
    // Get the guild ID from discord_id
    const [guildResult] = await pool.query(
      'SELECT id, name FROM guilds WHERE discord_id = ?',
      [guildDiscordId]
    );
    
    if (guildResult.length === 0) {
      console.log('❌ Guild not found in database');
      return;
    }
    
    const guildId = guildResult[0].id;
    const guildName = guildResult[0].name;
    console.log(`✅ Found guild: "${guildName}" (ID: ${guildId})`);
    
    // Find all servers associated with this guild
    console.log('\n📡 Step 2: Finding associated servers...');
    const [servers] = await pool.query(
      'SELECT id, nickname, ip, port FROM rust_servers WHERE guild_id = ?',
      [guildId]
    );
    
    console.log(`Found ${servers.length} servers:`);
    servers.forEach((server, index) => {
      console.log(`   ${index + 1}. ${server.nickname} (${server.ip}:${server.port})`);
    });
    
    if (servers.length === 0) {
      console.log('No servers found for this guild');
    }
    
    // Find all players associated with these servers
    console.log('\n👥 Step 3: Finding associated players...');
    let totalPlayers = 0;
    for (const server of servers) {
      const [players] = await pool.query(
        'SELECT COUNT(*) as count FROM players WHERE server_id = ?',
        [server.id]
      );
      console.log(`   ${server.nickname}: ${players[0].count} players`);
      totalPlayers += players[0].count;
    }
    console.log(`Total players: ${totalPlayers}`);
    
    // Check for other associated data
    console.log('\n🔍 Step 4: Checking for other associated data...');
    
    // Check for economy data (eco_games uses server_id, not guild_id)
    let economyCount = 0;
    for (const server of servers) {
      const [ecoData] = await pool.query(
        'SELECT COUNT(*) as count FROM eco_games WHERE server_id = ?',
        [server.id]
      );
      economyCount += ecoData[0].count;
    }
    console.log(`Economy games: ${economyCount}`);
    
    // Check for leaderboard settings
    const [leaderboardData] = await pool.query(
      'SELECT COUNT(*) as count FROM leaderboard_settings WHERE guild_id = ?',
      [guildId]
    );
    console.log(`Leaderboard settings: ${leaderboardData[0].count}`);
    
    // Check for zones (zones uses server_id, not guild_id)
    let zonesCount = 0;
    for (const server of servers) {
      const [zoneData] = await pool.query(
        'SELECT COUNT(*) as count FROM zones WHERE server_id = ?',
        [server.id]
      );
      zonesCount += zoneData[0].count;
    }
    console.log(`Zones: ${zonesCount}`);
    
    // Check for subscriptions (uses guild discord_id, not internal guild_id)
    const [subscriptionData] = await pool.query(
      'SELECT COUNT(*) as count FROM subscriptions WHERE guild_id = ?',
      [guildDiscordId]
    );
    console.log(`Subscriptions: ${subscriptionData[0].count}`);
    
    // Confirm deletion
    console.log('\n⚠️  DELETION CONFIRMATION');
    console.log('This will permanently delete:');
    console.log(`- Guild: "${guildName}"`);
    console.log(`- ${servers.length} servers`);
    console.log(`- ${totalPlayers} player records`);
    console.log(`- ${economyCount} economy games`);
    console.log(`- ${leaderboardData[0].count} leaderboard settings`);
    console.log(`- ${zonesCount} zones`);
    console.log(`- ${subscriptionData[0].count} subscriptions`);
    
    // Perform the deletion
    console.log('\n🗑️ Step 5: Performing deletion...');
    
    // Delete in order to respect foreign key constraints
    console.log('Deleting players...');
    for (const server of servers) {
      const result = await pool.query('DELETE FROM players WHERE server_id = ?', [server.id]);
      console.log(`   Deleted ${result[0].affectedRows} players from ${server.nickname}`);
    }
    
    console.log('Deleting economy games...');
    let totalEcoDeleted = 0;
    for (const server of servers) {
      const ecoResult = await pool.query('DELETE FROM eco_games WHERE server_id = ?', [server.id]);
      totalEcoDeleted += ecoResult[0].affectedRows;
    }
    console.log(`   Deleted ${totalEcoDeleted} economy games`);
    
    console.log('Deleting leaderboard settings...');
    const leaderResult = await pool.query('DELETE FROM leaderboard_settings WHERE guild_id = ?', [guildId]);
    console.log(`   Deleted ${leaderResult[0].affectedRows} leaderboard settings`);
    
    console.log('Deleting zones...');
    let totalZonesDeleted = 0;
    for (const server of servers) {
      const zonesResult = await pool.query('DELETE FROM zones WHERE server_id = ?', [server.id]);
      totalZonesDeleted += zonesResult[0].affectedRows;
    }
    console.log(`   Deleted ${totalZonesDeleted} zones`);
    
    console.log('Deleting subscriptions...');
    const subResult = await pool.query('DELETE FROM subscriptions WHERE guild_id = ?', [guildDiscordId]);
    console.log(`   Deleted ${subResult[0].affectedRows} subscriptions`);
    
    console.log('Deleting servers...');
    const serverResult = await pool.query('DELETE FROM rust_servers WHERE guild_id = ?', [guildId]);
    console.log(`   Deleted ${serverResult[0].affectedRows} servers`);
    
    console.log('Deleting guild...');
    const guildDeleteResult = await pool.query('DELETE FROM guilds WHERE id = ?', [guildId]);
    console.log(`   Deleted ${guildDeleteResult[0].affectedRows} guild record`);
    
    console.log('✅ Deletion completed successfully!');
    
  } catch (error) {
    console.error('❌ Error removing guild data:', error);
  } finally {
    await pool.end();
  }
}

removeNonPayingGuild();
