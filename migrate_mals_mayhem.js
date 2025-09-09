const pool = require('./src/db');

async function migrateMalsMayhem() {
  const oldDiscordId = '541';  // Mals Mayhem
  const newDiscordId = '1414692371144376395';  // New Discord server
  
  try {
    console.log('🔄 Starting Mals Mayhem migration to new Discord...');
    console.log(`📤 Source Discord: ${oldDiscordId} (Mals Mayhem)`);
    console.log(`📥 Target Discord: ${newDiscordId}\n`);
    
    // Step 1: Find the server data for the old Discord ID
    console.log('🔍 Step 1: Finding server data...');
    const [servers] = await pool.query(
      'SELECT * FROM rust_servers WHERE guild_id = ?',
      [oldDiscordId]
    );
    
    if (servers.length === 0) {
      console.log('❌ No servers found for Discord ID:', oldDiscordId);
      return;
    }
    
    console.log(`✅ Found ${servers.length} server(s) to migrate:`);
    servers.forEach(server => {
      console.log(`   - ${server.nickname} (${server.ip}:${server.port})`);
    });
    
    // Step 2: Check if new Discord already has servers
    console.log('\n🔍 Step 2: Checking target Discord...');
    const [existingNewServers] = await pool.query(
      'SELECT * FROM rust_servers WHERE guild_id = ?',
      [newDiscordId]
    );
    
    if (existingNewServers.length > 0) {
      console.log('⚠️  Target Discord already has servers:');
      existingNewServers.forEach(server => {
        console.log(`   - ${server.nickname} (${server.ip}:${server.port})`);
      });
      console.log('⚠️  This migration will ADD to existing servers, not replace them.');
    } else {
      console.log('✅ Target Discord is clean - no existing servers');
    }
    
    // Step 3: Check if guild exists in database
    console.log('\n🔍 Step 3: Checking guild records...');
    const [oldGuild] = await pool.query(
      'SELECT * FROM guilds WHERE id = ?',
      [oldDiscordId]
    );
    
    const [newGuild] = await pool.query(
      'SELECT * FROM guilds WHERE id = ?',
      [newDiscordId]
    );
    
    if (oldGuild.length === 0) {
      console.log('❌ Old guild not found in database');
      return;
    }
    
    console.log('✅ Old guild found:', oldGuild[0].name);
    
    if (newGuild.length === 0) {
      console.log('⚠️  New guild not found - will need to be created');
    } else {
      console.log('✅ New guild found:', newGuild[0].name);
    }
    
    // Step 4: Show data that will be migrated
    console.log('\n📊 Step 4: Analyzing data to migrate...');
    
    for (const server of servers) {
      console.log(`\n📋 Server: ${server.nickname}`);
      
      // Count players
      const [playerCount] = await pool.query(
        'SELECT COUNT(*) as count FROM players WHERE server_id = ?',
        [server.id]
      );
      console.log(`   - Players: ${playerCount[0].count}`);
      
      // Count economy games
      const [ecoCount] = await pool.query(
        'SELECT COUNT(*) as count FROM eco_games WHERE server_id = ?',
        [server.id]
      );
      console.log(`   - Economy games: ${ecoCount[0].count}`);
      
      // Count zones
      const [zoneCount] = await pool.query(
        'SELECT COUNT(*) as count FROM zones WHERE server_id = ?',
        [server.id]
      );
      console.log(`   - Zones: ${zoneCount[0].count}`);
      
      // Count shop categories
      const [shopCount] = await pool.query(
        'SELECT COUNT(*) as count FROM shop_categories WHERE server_id = ?',
        [server.id]
      );
      console.log(`   - Shop categories: ${shopCount[0].count}`);
      
      // Count position coordinates
      const [posCount] = await pool.query(
        'SELECT COUNT(*) as count FROM position_coordinates WHERE server_id = ?',
        [server.id]
      );
      console.log(`   - Position coordinates: ${posCount[0].count}`);
    }
    
    // Step 5: Confirm migration
    console.log('\n⚠️  MIGRATION SUMMARY:');
    console.log(`   📤 Source Discord: ${oldDiscordId} (Mals Mayhem)`);
    console.log(`   📥 Target Discord: ${newDiscordId}`);
    console.log(`   🖥️  Servers to migrate: ${servers.length}`);
    console.log(`   🔄 This will update all server records to use the new Discord ID`);
    console.log(`   📊 All related data (players, zones, economy, etc.) will be preserved`);
    console.log(`   🗑️  The old Discord ID will be completely removed from the system`);
    
    console.log('\n🚀 Ready to proceed with migration!');
    console.log('💡 Run this script again with --confirm flag to execute the migration');
    
  } catch (error) {
    console.error('❌ Error during migration analysis:', error);
  } finally {
    await pool.end();
  }
}

// Check for confirmation flag
const args = process.argv.slice(2);
const shouldConfirm = args.includes('--confirm');

if (shouldConfirm) {
  console.log('🚀 CONFIRMED: Proceeding with Mals Mayhem migration...\n');
  executeMigration();
} else {
  migrateMalsMayhem();
}

async function executeMigration() {
  const oldDiscordId = '541';  // Mals Mayhem
  const newDiscordId = '1414692371144376395';  // New Discord server
  
  try {
    console.log('🔄 EXECUTING MALS MAYHEM MIGRATION...\n');
    
    // Start transaction
    await pool.query('START TRANSACTION');
    
    // Step 1: Update child records first (to avoid foreign key constraints)
    console.log('📝 Step 1: Updating player homes...');
    const [homeUpdate] = await pool.query(
      'UPDATE player_homes SET guild_id = ? WHERE guild_id = ?',
      [newDiscordId, oldDiscordId]
    );
    console.log(`✅ Updated ${homeUpdate.affectedRows} player home(s)`);
    
    // Step 2: Update whitelist records
    console.log('\n📝 Step 2: Updating whitelist records...');
    const [whitelistUpdate] = await pool.query(
      'UPDATE player_whitelists SET guild_id = ? WHERE guild_id = ?',
      [newDiscordId, oldDiscordId]
    );
    console.log(`✅ Updated ${whitelistUpdate.affectedRows} whitelist record(s)`);
    
    // Step 3: Update player records
    console.log('\n📝 Step 3: Updating player records...');
    const [playerUpdate] = await pool.query(
      'UPDATE players SET guild_id = ? WHERE guild_id = ?',
      [newDiscordId, oldDiscordId]
    );
    console.log(`✅ Updated ${playerUpdate.affectedRows} player record(s)`);
    
    // Step 4: Update economy game records
    console.log('\n📝 Step 4: Updating economy game records...');
    const [ecoUpdate] = await pool.query(
      'UPDATE eco_games SET guild_id = ? WHERE guild_id = ?',
      [newDiscordId, oldDiscordId]
    );
    console.log(`✅ Updated ${ecoUpdate.affectedRows} economy game record(s)`);
    
    // Step 5: Update leaderboard settings
    console.log('\n📝 Step 5: Updating leaderboard settings...');
    const [leaderUpdate] = await pool.query(
      'UPDATE leaderboard_settings SET guild_id = ? WHERE guild_id = ?',
      [newDiscordId, oldDiscordId]
    );
    console.log(`✅ Updated ${leaderUpdate.affectedRows} leaderboard setting(s)`);
    
    // Step 6: Update subscriptions
    console.log('\n📝 Step 6: Updating subscriptions...');
    const [subUpdate] = await pool.query(
      'UPDATE subscriptions SET guild_id = ? WHERE guild_id = ?',
      [newDiscordId, oldDiscordId]
    );
    console.log(`✅ Updated ${subUpdate.affectedRows} subscription(s)`);
    
    // Step 7: Update server records
    console.log('\n📝 Step 7: Updating server records...');
    const [serverUpdate] = await pool.query(
      'UPDATE rust_servers SET guild_id = ? WHERE guild_id = ?',
      [newDiscordId, oldDiscordId]
    );
    console.log(`✅ Updated ${serverUpdate.affectedRows} server record(s)`);
    
    // Step 8: Update guild record last (after all child records are updated)
    console.log('\n📝 Step 8: Updating guild record...');
    const [guildUpdate] = await pool.query(
      'UPDATE guilds SET id = ? WHERE id = ?',
      [newDiscordId, oldDiscordId]
    );
    console.log(`✅ Updated ${guildUpdate.affectedRows} guild record(s)`);
    
    // Commit transaction
    await pool.query('COMMIT');
    
    console.log('\n🎉 MALS MAYHEM MIGRATION COMPLETED SUCCESSFULLY!');
    console.log(`✅ All data has been moved from Discord ${oldDiscordId} to ${newDiscordId}`);
    console.log('\n📝 Next steps:');
    console.log('   1. The bot will need to be restarted: pm2 restart zentro-bot');
    console.log('   2. The server owner should invite the bot to the new Discord server');
    console.log('   3. All server configurations and data are now associated with the new Discord ID');
    console.log('   4. The old Discord server can be removed from the bot');
    
  } catch (error) {
    // Rollback on error
    await pool.query('ROLLBACK');
    console.error('❌ Error during migration - transaction rolled back:', error);
  } finally {
    await pool.end();
  }
}
