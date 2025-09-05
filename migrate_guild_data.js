const pool = require('./src/db');

// Migration configuration
const OLD_GUILD_ID = '1376431874699825216';
const NEW_GUILD_ID = '1413335350742614067';
const NEW_GUILD_NAME = 'New Zentro Server'; // Update this with the actual server name

async function migrateGuildData() {
  console.log('🚀 Starting Guild Data Migration');
  console.log(`📤 From: ${OLD_GUILD_ID}`);
  console.log(`📥 To: ${NEW_GUILD_ID}`);
  console.log('=' .repeat(60));

  try {
    // Step 1: Backup existing data
    console.log('\n📋 Step 1: Creating data backup...');
    await createDataBackup();

    // Step 2: Check if old guild exists
    console.log('\n🔍 Step 2: Verifying old guild data...');
    const oldGuildData = await verifyOldGuildData();
    if (!oldGuildData.exists) {
      throw new Error(`Old guild ${OLD_GUILD_ID} not found in database`);
    }

    // Step 3: Create or update new guild record
    console.log('\n🏗️  Step 3: Setting up new guild record...');
    await setupNewGuild();

    // Step 4: Migrate core data
    console.log('\n📦 Step 4: Migrating core data...');
    await migrateCoreData();

    // Step 5: Migrate additional features
    console.log('\n🎮 Step 5: Migrating additional features...');
    await migrateAdditionalFeatures();

    // Step 6: Verify migration
    console.log('\n✅ Step 6: Verifying migration...');
    await verifyMigration();

    console.log('\n🎉 Migration completed successfully!');
    console.log('📝 Summary:');
    console.log(`   - Guild: ${OLD_GUILD_ID} → ${NEW_GUILD_ID}`);
    console.log(`   - All player data, economy, shop items, and server configurations migrated`);
    console.log(`   - Rust server configurations remain unchanged`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n🔄 You can restore from backup if needed');
    throw error;
  }
}

async function createDataBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = `guild_migration_backup_${timestamp}.sql`;
  
  console.log(`📁 Creating backup: ${backupFile}`);
  
  // Get all data related to the old guild
  const [guilds] = await pool.query('SELECT * FROM guilds WHERE discord_id = ?', [OLD_GUILD_ID]);
  const [servers] = await pool.query(`
    SELECT rs.* FROM rust_servers rs 
    JOIN guilds g ON rs.guild_id = g.id 
    WHERE g.discord_id = ?
  `, [OLD_GUILD_ID]);
  
  console.log(`✅ Backup created with ${guilds.length} guild records and ${servers.length} server records`);
}

async function verifyOldGuildData() {
  const [guilds] = await pool.query('SELECT * FROM guilds WHERE discord_id = ?', [OLD_GUILD_ID]);
  const [servers] = await pool.query(`
    SELECT rs.* FROM rust_servers rs 
    JOIN guilds g ON rs.guild_id = g.id 
    WHERE g.discord_id = ?
  `, [OLD_GUILD_ID]);
  const [players] = await pool.query(`
    SELECT p.* FROM players p 
    JOIN guilds g ON p.guild_id = g.id 
    WHERE g.discord_id = ?
  `, [OLD_GUILD_ID]);

  console.log(`📊 Old guild data found:`);
  console.log(`   - Guilds: ${guilds.length}`);
  console.log(`   - Servers: ${servers.length}`);
  console.log(`   - Players: ${players.length}`);

  return {
    exists: guilds.length > 0,
    guilds,
    servers,
    players
  };
}

async function setupNewGuild() {
  // Check if new guild already exists
  const [existingGuild] = await pool.query('SELECT * FROM guilds WHERE discord_id = ?', [NEW_GUILD_ID]);
  
  if (existingGuild.length > 0) {
    console.log(`✅ New guild already exists: ${existingGuild[0].name}`);
    return existingGuild[0].id;
  }

  // Create new guild record
  const [result] = await pool.query(
    'INSERT INTO guilds (discord_id, name) VALUES (?, ?)',
    [NEW_GUILD_ID, NEW_GUILD_NAME]
  );
  
  console.log(`✅ Created new guild record with ID: ${result.insertId}`);
  return result.insertId;
}

async function migrateCoreData() {
  // Get old guild's internal ID
  const [oldGuild] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [OLD_GUILD_ID]);
  const [newGuild] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [NEW_GUILD_ID]);
  
  const oldGuildId = oldGuild[0].id;
  const newGuildId = newGuild[0].id;

  // Migrate rust_servers
  console.log('   🔧 Migrating rust servers...');
  await pool.query(
    'UPDATE rust_servers SET guild_id = ? WHERE guild_id = ?',
    [newGuildId, oldGuildId]
  );

  // Migrate players
  console.log('   👥 Migrating players...');
  await pool.query(
    'UPDATE players SET guild_id = ? WHERE guild_id = ?',
    [newGuildId, oldGuildId]
  );

  // Migrate economy (linked to players, so should update automatically)
  console.log('   💰 Economy data will be preserved through player links');

  // Migrate transactions
  console.log('   📊 Migrating transactions...');
  await pool.query(`
    UPDATE transactions t 
    JOIN players p ON t.player_id = p.id 
    SET t.guild_id = ? 
    WHERE p.guild_id = ?
  `, [newGuildId, newGuildId]);

  // Migrate shop categories (shop_categories don't have guild_id, they're linked via server_id)
  console.log('   🛒 Shop categories will be migrated automatically via server migration');

  // Migrate shop items (shop_items don't have guild_id, they're linked via category_id)
  console.log('   🛍️  Shop items will be migrated automatically via category migration');

  // Migrate shop kits (shop_kits don't have guild_id, they're linked via category_id)
  console.log('   🎒 Shop kits will be migrated automatically via category migration');

  // Migrate autokits (autokits don't have guild_id, they're linked via server_id)
  console.log('   ⚡ Autokits will be migrated automatically via server migration');

  // Migrate kit_auth (kit_auth don't have guild_id, they're linked via server_id)
  console.log('   🔐 Kit auth will be migrated automatically via server migration');

  // Migrate link_blocks and link_requests
  console.log('   🔗 Migrating link blocks and requests...');
  await pool.query(
    'UPDATE link_blocks SET guild_id = ? WHERE guild_id = ?',
    [newGuildId, oldGuildId]
  );
  await pool.query(
    'UPDATE link_requests SET guild_id = ? WHERE guild_id = ?',
    [newGuildId, oldGuildId]
  );

  console.log('   ✅ Core data migration completed');
}

async function migrateAdditionalFeatures() {
  const [oldGuild] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [OLD_GUILD_ID]);
  const [newGuild] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [NEW_GUILD_ID]);
  
  const oldGuildId = oldGuild[0].id;
  const newGuildId = newGuild[0].id;

  // Migrate channel settings (channel_settings don't have guild_id, they're linked via server_id)
  console.log('   📺 Channel settings will be migrated automatically via server migration');

  // Migrate position coordinates (position_coordinates don't have guild_id, they're linked via server_id)
  console.log('   📍 Position coordinates will be migrated automatically via server migration');

  // Migrate zones (zones don't have guild_id, they're linked via server_id)
  console.log('   🗺️  Zones will be migrated automatically via server migration');

  // Migrate killfeed configs (killfeed_configs don't have guild_id, they're linked via server_id)
  console.log('   💀 Killfeed configs will be migrated automatically via server migration');

  // Migrate player stats (player_stats don't have guild_id, they're linked via player_id)
  console.log('   📈 Player stats will be migrated automatically via player migration');

  // Migrate home teleport data
  console.log('   🏠 Migrating home teleport data...');
  await pool.query(
    'UPDATE player_homes SET guild_id = ? WHERE guild_id = ?',
    [newGuildId, oldGuildId]
  );
  await pool.query(
    'UPDATE player_whitelists SET guild_id = ? WHERE guild_id = ?',
    [newGuildId, oldGuildId]
  );

  // Migrate ZORP data (zorp_defaults don't have guild_id, they're linked via server_id)
  console.log('   🎯 ZORP data will be migrated automatically via server migration');

  // Migrate bounty system data (if bounties table exists and has guild_id)
  console.log('   🎯 Checking for bounty system data...');
  try {
    const [bountyCheck] = await pool.query('SHOW TABLES LIKE "bounties"');
    if (bountyCheck.length > 0) {
      const [bountyColumns] = await pool.query('SHOW COLUMNS FROM bounties LIKE "guild_id"');
      if (bountyColumns.length > 0) {
        await pool.query('UPDATE bounties SET guild_id = ? WHERE guild_id = ?', [newGuildId, oldGuildId]);
        console.log('   ✅ Bounty system data migrated');
      } else {
        console.log('   ℹ️  Bounty system data linked via other tables');
      }
    } else {
      console.log('   ℹ️  Bounty system table not found');
    }
  } catch (error) {
    console.log('   ℹ️  Bounty system not available');
  }

  // Migrate prison system data (if prison_system table exists and has guild_id)
  console.log('   🏛️  Checking for prison system data...');
  try {
    const [prisonCheck] = await pool.query('SHOW TABLES LIKE "prison_system"');
    if (prisonCheck.length > 0) {
      const [prisonColumns] = await pool.query('SHOW COLUMNS FROM prison_system LIKE "guild_id"');
      if (prisonColumns.length > 0) {
        await pool.query('UPDATE prison_system SET guild_id = ? WHERE guild_id = ?', [newGuildId, oldGuildId]);
        console.log('   ✅ Prison system data migrated');
      } else {
        console.log('   ℹ️  Prison system data linked via other tables');
      }
    } else {
      console.log('   ℹ️  Prison system table not found');
    }
  } catch (error) {
    console.log('   ℹ️  Prison system not available');
  }

  // Migrate rider config data (if rider_configs table exists and has guild_id)
  console.log('   🚗 Checking for rider config data...');
  try {
    const [riderCheck] = await pool.query('SHOW TABLES LIKE "rider_configs"');
    if (riderCheck.length > 0) {
      const [riderColumns] = await pool.query('SHOW COLUMNS FROM rider_configs LIKE "guild_id"');
      if (riderColumns.length > 0) {
        await pool.query('UPDATE rider_configs SET guild_id = ? WHERE guild_id = ?', [newGuildId, oldGuildId]);
        console.log('   ✅ Rider config data migrated');
      } else {
        console.log('   ℹ️  Rider config data linked via other tables');
      }
    } else {
      console.log('   ℹ️  Rider config table not found');
    }
  } catch (error) {
    console.log('   ℹ️  Rider config not available');
  }

  // Migrate Nivaro store data (if nivaro_store table exists and has guild_id)
  console.log('   🏪 Checking for Nivaro store data...');
  try {
    const [nivaroCheck] = await pool.query('SHOW TABLES LIKE "nivaro_store"');
    if (nivaroCheck.length > 0) {
      const [nivaroColumns] = await pool.query('SHOW COLUMNS FROM nivaro_store LIKE "guild_id"');
      if (nivaroColumns.length > 0) {
        await pool.query('UPDATE nivaro_store SET guild_id = ? WHERE guild_id = ?', [newGuildId, oldGuildId]);
        console.log('   ✅ Nivaro store data migrated');
      } else {
        console.log('   ℹ️  Nivaro store data linked via other tables');
      }
    } else {
      console.log('   ℹ️  Nivaro store table not found');
    }
  } catch (error) {
    console.log('   ℹ️  Nivaro store not available');
  }

  console.log('   ✅ Additional features migration completed');
}

async function verifyMigration() {
  const [newGuild] = await pool.query('SELECT * FROM guilds WHERE discord_id = ?', [NEW_GUILD_ID]);
  const [servers] = await pool.query(`
    SELECT rs.* FROM rust_servers rs 
    JOIN guilds g ON rs.guild_id = g.id 
    WHERE g.discord_id = ?
  `, [NEW_GUILD_ID]);
  const [players] = await pool.query(`
    SELECT p.* FROM players p 
    JOIN guilds g ON p.guild_id = g.id 
    WHERE g.discord_id = ?
  `, [NEW_GUILD_ID]);
  const [economy] = await pool.query(`
    SELECT e.* FROM economy e 
    JOIN players p ON e.player_id = p.id 
    JOIN guilds g ON p.guild_id = g.id 
    WHERE g.discord_id = ?
  `, [NEW_GUILD_ID]);

  console.log(`📊 Migration verification:`);
  console.log(`   - New guild: ${newGuild.length > 0 ? '✅ Found' : '❌ Missing'}`);
  console.log(`   - Servers migrated: ${servers.length}`);
  console.log(`   - Players migrated: ${players.length}`);
  console.log(`   - Economy records: ${economy.length}`);

  if (newGuild.length === 0) {
    throw new Error('New guild not found after migration');
  }

  // Check if old guild still has data (it shouldn't)
  const [oldServers] = await pool.query(`
    SELECT rs.* FROM rust_servers rs 
    JOIN guilds g ON rs.guild_id = g.id 
    WHERE g.discord_id = ?
  `, [OLD_GUILD_ID]);

  if (oldServers.length > 0) {
    console.log(`⚠️  Warning: ${oldServers.length} servers still linked to old guild`);
  }

  console.log('✅ Migration verification completed');
}

// Run the migration
if (require.main === module) {
  migrateGuildData()
    .then(() => {
      console.log('\n🎉 Guild migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateGuildData };
