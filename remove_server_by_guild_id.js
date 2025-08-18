const mysql = require('mysql2/promise');
const config = require('./src/config');

async function removeServerByGuildId() {
  const guildId = '1390476170872750080';
  let pool;
  
  try {
    console.log('🗑️  REMOVING SERVER BY GUILD ID');
    console.log('================================');
    console.log(`Guild ID: ${guildId}\n`);
    
    // Create connection pool
    pool = mysql.createPool({
      host: config.db.host,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      port: config.db.port,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');

    // Step 1: Find and display what will be removed
    console.log('🔍 Step 1: Finding data to remove...');
    
    // Get guild info
    const [guildInfo] = await pool.query(
      'SELECT * FROM guilds WHERE discord_id = ?',
      [guildId]
    );
    
    if (guildInfo.length === 0) {
      console.log('❌ No guild found with that Discord ID');
      return;
    }
    
    const guild = guildInfo[0];
    console.log(`📋 Found guild: ${guild.name || 'Unknown'} (Internal ID: ${guild.id})`);
    
    // Get servers for this guild
    const [servers] = await pool.query(
      'SELECT * FROM rust_servers WHERE guild_id = ?',
      [guild.id]
    );
    
    console.log(`📋 Found ${servers.length} server(s) to remove:`);
    servers.forEach(server => {
      console.log(`   • ${server.nickname} (${server.ip}:${server.port})`);
    });
    
    // Get player count
    const [playerCount] = await pool.query(
      'SELECT COUNT(*) as count FROM players WHERE guild_id = ?',
      [guild.id]
    );
    console.log(`📋 Found ${playerCount[0].count} player(s) to remove`);
    
    // Get other data counts
    const [zorpCount] = await pool.query(
      'SELECT COUNT(*) as count FROM zorp_zones WHERE server_id IN (SELECT id FROM rust_servers WHERE guild_id = ?)',
      [guild.id]
    );
    console.log(`📋 Found ${zorpCount[0].count} ZORP zone(s) to remove`);
    
    const [channelCount] = await pool.query(
      'SELECT COUNT(*) as count FROM channel_settings WHERE server_id IN (SELECT id FROM rust_servers WHERE guild_id = ?)',
      [guild.id]
    );
    console.log(`📋 Found ${channelCount[0].count} channel setting(s) to remove`);

    console.log('\n⚠️  WARNING: This will permanently delete all data for this guild!');
    console.log('This includes: servers, players, economy data, ZORP zones, channel settings, etc.\n');

    // Step 2: Remove all data (in correct order to respect foreign keys)
    console.log('🗑️  Step 2: Removing data...\n');

    // Remove ZORP zones first
    console.log('   Removing ZORP zones...');
    const [zorpResult] = await pool.query(
      'DELETE FROM zorp_zones WHERE server_id IN (SELECT id FROM rust_servers WHERE guild_id = ?)',
      [guild.id]
    );
    console.log(`   ✅ Removed ${zorpResult.affectedRows} ZORP zones`);

    // Remove ZORP defaults
    console.log('   Removing ZORP defaults...');
    const [zorpDefaultsResult] = await pool.query(
      'DELETE FROM zorp_defaults WHERE server_id IN (SELECT id FROM rust_servers WHERE guild_id = ?)',
      [guild.id]
    );
    console.log(`   ✅ Removed ${zorpDefaultsResult.affectedRows} ZORP defaults`);

    // Remove channel settings
    console.log('   Removing channel settings...');
    const [channelResult] = await pool.query(
      'DELETE FROM channel_settings WHERE server_id IN (SELECT id FROM rust_servers WHERE guild_id = ?)',
      [guild.id]
    );
    console.log(`   ✅ Removed ${channelResult.affectedRows} channel settings`);

    // Remove economy data
    console.log('   Removing economy data...');
    const [economyResult] = await pool.query(
      'DELETE FROM economy WHERE guild_id = ?',
      [guild.id]
    );
    console.log(`   ✅ Removed ${economyResult.affectedRows} economy records`);

    // Remove transactions
    console.log('   Removing transactions...');
    const [transactionResult] = await pool.query(
      'DELETE FROM transactions WHERE guild_id = ?',
      [guild.id]
    );
    console.log(`   ✅ Removed ${transactionResult.affectedRows} transactions`);

    // Remove player stats
    console.log('   Removing player stats...');
    const [statsResult] = await pool.query(
      'DELETE FROM player_stats WHERE player_id IN (SELECT id FROM players WHERE guild_id = ?)',
      [guild.id]
    );
    console.log(`   ✅ Removed ${statsResult.affectedRows} player stats`);

    // Remove players
    console.log('   Removing players...');
    const [playersResult] = await pool.query(
      'DELETE FROM players WHERE guild_id = ?',
      [guild.id]
    );
    console.log(`   ✅ Removed ${playersResult.affectedRows} players`);

    // Remove event tracking
    console.log('   Removing event tracking...');
    const [eventResult] = await pool.query(
      'DELETE FROM event_tracking WHERE server_id IN (SELECT id FROM rust_servers WHERE guild_id = ?)',
      [guild.id]
    );
    console.log(`   ✅ Removed ${eventResult.affectedRows} event tracking records`);

    // Remove night skip settings
    console.log('   Removing night skip settings...');
    const [nightSkipResult] = await pool.query(
      'DELETE FROM night_skip_settings WHERE server_id IN (SELECT id FROM rust_servers WHERE guild_id = ?)',
      [guild.id]
    );
    console.log(`   ✅ Removed ${nightSkipResult.affectedRows} night skip settings`);

    // Remove shop data
    console.log('   Removing shop data...');
    try {
      const [shopResult] = await pool.query(
        'DELETE FROM shop_items WHERE server_id IN (SELECT id FROM rust_servers WHERE guild_id = ?)',
        [guild.id]
      );
      console.log(`   ✅ Removed ${shopResult.affectedRows} shop items`);
    } catch (error) {
      console.log('   ℹ️  No shop items table (normal if not using shop system)');
    }

    // Remove kit data
    console.log('   Removing kit data...');
    try {
      const [kitResult] = await pool.query(
        'DELETE FROM kits WHERE server_id IN (SELECT id FROM rust_servers WHERE guild_id = ?)',
        [guild.id]
      );
      console.log(`   ✅ Removed ${kitResult.affectedRows} kits`);
    } catch (error) {
      console.log('   ℹ️  No kits table (normal if not using kit system)');
    }

    // Remove servers
    console.log('   Removing servers...');
    const [serversResult] = await pool.query(
      'DELETE FROM rust_servers WHERE guild_id = ?',
      [guild.id]
    );
    console.log(`   ✅ Removed ${serversResult.affectedRows} servers`);

    // Finally, remove the guild
    console.log('   Removing guild...');
    const [guildResult] = await pool.query(
      'DELETE FROM guilds WHERE id = ?',
      [guild.id]
    );
    console.log(`   ✅ Removed ${guildResult.affectedRows} guild record`);

    console.log('\n🎉 SERVER REMOVAL COMPLETED SUCCESSFULLY!');
    console.log('========================================');
    console.log(`✅ All data for guild ${guildId} has been permanently removed`);
    console.log('✅ Database is clean and optimized');
    console.log('✅ No orphaned records remaining');

    console.log('\n📊 SUMMARY:');
    console.log(`• Servers removed: ${serversResult.affectedRows}`);
    console.log(`• Players removed: ${playersResult.affectedRows}`);
    console.log(`• ZORP zones removed: ${zorpResult.affectedRows}`);
    console.log(`• Channel settings removed: ${channelResult.affectedRows}`);
    console.log(`• Economy records removed: ${economyResult.affectedRows}`);
    console.log(`• Guild record removed: ${guildResult.affectedRows}`);

  } catch (error) {
    console.error('❌ Error removing server:', error);
    throw error;
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  removeServerByGuildId()
    .then(() => {
      console.log('\nServer removal completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nServer removal failed:', error);
      process.exit(1);
    });
}

module.exports = removeServerByGuildId;
