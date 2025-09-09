const pool = require('./src/db');

async function migrateMalsMayhemFresh() {
  const oldDiscordId = '541';  // Mals Mayhem
  const newDiscordId = '1414692371144376395';  // New Discord server
  
  try {
    console.log('🔄 Starting FRESH Mals Mayhem migration...');
    console.log(`📤 Source Discord: ${oldDiscordId} (Mals Mayhem)`);
    console.log(`📥 Target Discord: ${newDiscordId}`);
    console.log('🗑️  All player data will be WIPED - only server config will be moved\n`);
    
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
    } else {
      console.log('✅ Target Discord is clean - no existing servers');
    }
    
    // Step 3: Show what will be migrated
    console.log('\n📊 Step 3: Migration plan...');
    console.log('✅ WILL MOVE:');
    console.log('   - Server configuration (IP, port, password)');
    console.log('   - Server nickname');
    console.log('   - All server settings and configurations');
    console.log('\n🗑️  WILL DELETE:');
    console.log('   - All player data (63 players)');
    console.log('   - All player homes (6 homes)');
    console.log('   - All whitelist records (2 records)');
    console.log('   - All shop categories (7 categories)');
    console.log('   - All position coordinates (4 coordinates)');
    console.log('   - All economy data');
    console.log('   - All other player-related data');
    
    console.log('\n⚠️  FRESH START MIGRATION SUMMARY:');
    console.log(`   📤 Source Discord: ${oldDiscordId} (Mals Mayhem)`);
    console.log(`   📥 Target Discord: ${newDiscordId}`);
    console.log(`   🖥️  Servers to migrate: ${servers.length}`);
    console.log(`   🔄 Server config will be moved to new Discord`);
    console.log(`   🗑️  ALL player data will be deleted for a fresh start`);
    console.log(`   🗑️  The old Discord ID will be completely removed`);
    
    console.log('\n🚀 Ready to proceed with FRESH migration!');
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
  console.log('🚀 CONFIRMED: Proceeding with FRESH Mals Mayhem migration...\n');
  executeFreshMigration();
} else {
  migrateMalsMayhemFresh();
}

async function executeFreshMigration() {
  const oldDiscordId = '541';  // Mals Mayhem
  const newDiscordId = '1414692371144376395';  // New Discord server
  
  try {
    console.log('🔄 EXECUTING FRESH MALS MAYHEM MIGRATION...\n');
    
    // Start transaction
    await pool.query('START TRANSACTION');
    
    // Step 1: Create new guild record
    console.log('📝 Step 1: Creating new guild record...');
    const [newGuild] = await pool.query(
      'INSERT INTO guilds (discord_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
      [newDiscordId, 'New Discord Server']
    );
    console.log(`✅ Created/updated guild record for ${newDiscordId}`);
    
    // Get the new guild's ID
    const [newGuildData] = await pool.query(
      'SELECT id FROM guilds WHERE discord_id = ?',
      [newDiscordId]
    );
    const newGuildId = newGuildData[0].id;
    console.log(`✅ New guild ID: ${newGuildId}`);
    
    // Step 2: Get server data to migrate
    console.log('\n📝 Step 2: Getting server configuration...');
    const [servers] = await pool.query(
      'SELECT * FROM rust_servers WHERE guild_id = ?',
      [oldDiscordId]
    );
    
    if (servers.length === 0) {
      throw new Error('No servers found to migrate');
    }
    
    const server = servers[0];
    console.log(`✅ Found server: ${server.nickname} (${server.ip}:${server.port})`);
    
    // Step 3: Delete all player data from old server
    console.log('\n🗑️  Step 3: Deleting all player data...');
    
    // Delete players
    const [playerDelete] = await pool.query('DELETE FROM players WHERE server_id = ?', [server.id]);
    console.log(`✅ Deleted ${playerDelete.affectedRows} players`);
    
    // Delete player homes
    const [homeDelete] = await pool.query('DELETE FROM player_homes WHERE server_id = ?', [server.id]);
    console.log(`✅ Deleted ${homeDelete.affectedRows} player homes`);
    
    // Delete whitelist records
    const [whitelistDelete] = await pool.query('DELETE FROM player_whitelists WHERE server_id = ?', [server.id]);
    console.log(`✅ Deleted ${whitelistDelete.affectedRows} whitelist records`);
    
    // Delete shop categories and items
    const [shopDelete] = await pool.query('DELETE FROM shop_categories WHERE server_id = ?', [server.id]);
    console.log(`✅ Deleted ${shopDelete.affectedRows} shop categories`);
    
    // Delete position coordinates
    const [posDelete] = await pool.query('DELETE FROM position_coordinates WHERE server_id = ?', [server.id]);
    console.log(`✅ Deleted ${posDelete.affectedRows} position coordinates`);
    
    // Delete economy games
    const [ecoDelete] = await pool.query('DELETE FROM eco_games WHERE server_id = ?', [server.id]);
    console.log(`✅ Deleted ${ecoDelete.affectedRows} economy games`);
    
    // Delete zones
    const [zoneDelete] = await pool.query('DELETE FROM zones WHERE server_id = ?', [server.id]);
    console.log(`✅ Deleted ${zoneDelete.affectedRows} zones`);
    
    // Step 4: Create new server record with same config but new guild
    console.log('\n📝 Step 4: Creating new server record...');
    const [newServer] = await pool.query(`
      INSERT INTO rust_servers (id, guild_id, nickname, ip, port, password, currency_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate new server ID
      newGuildId,
      server.nickname,
      server.ip,
      server.port,
      server.password,
      server.currency_name || 'coins'
    ]);
    console.log(`✅ Created new server record with ID: ${newServer.insertId}`);
    
    // Step 5: Delete old server record
    console.log('\n🗑️  Step 5: Deleting old server record...');
    const [oldServerDelete] = await pool.query('DELETE FROM rust_servers WHERE id = ?', [server.id]);
    console.log(`✅ Deleted old server record`);
    
    // Step 6: Delete old guild record
    console.log('\n🗑️  Step 6: Deleting old guild record...');
    const [guildDelete] = await pool.query('DELETE FROM guilds WHERE id = ?', [oldDiscordId]);
    console.log(`✅ Deleted old guild record`);
    
    // Commit transaction
    await pool.query('COMMIT');
    
    console.log('\n🎉 FRESH MALS MAYHEM MIGRATION COMPLETED SUCCESSFULLY!');
    console.log(`✅ Server configuration moved from Discord ${oldDiscordId} to ${newDiscordId}`);
    console.log(`✅ Server: ${server.nickname} (${server.ip}:${server.port})`);
    console.log(`✅ All player data has been wiped for a fresh start`);
    console.log('\n📝 Next steps:');
    console.log('   1. Restart the bot: pm2 restart zentro-bot');
    console.log('   2. The server owner should invite the bot to the new Discord server');
    console.log('   3. The server is now ready for a fresh start with no old player data');
    console.log('   4. The old Discord server can be removed from the bot');
    
  } catch (error) {
    // Rollback on error
    await pool.query('ROLLBACK');
    console.error('❌ Error during migration - transaction rolled back:', error);
  } finally {
    await pool.end();
  }
}
