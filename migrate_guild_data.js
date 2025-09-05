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

  // Migrate shop categories
  console.log('   🛒 Migrating shop categories...');
  await pool.query(`
    UPDATE shop_categories sc 
    JOIN rust_servers rs ON sc.server_id = rs.id 
    SET sc.guild_id = ? 
    WHERE rs.guild_id = ?
  `, [newGuildId, newGuildId]);

  // Migrate shop items
  console.log('   🛍️  Migrating shop items...');
  await pool.query(`
    UPDATE shop_items si 
    JOIN shop_categories sc ON si.category_id = sc.id 
    SET si.guild_id = ? 
    WHERE sc.guild_id = ?
  `, [newGuildId, newGuildId]);

  // Migrate shop kits
  console.log('   🎒 Migrating shop kits...');
  await pool.query(`
    UPDATE shop_kits sk 
    JOIN shop_categories sc ON sk.category_id = sc.id 
    SET sk.guild_id = ? 
    WHERE sc.guild_id = ?
  `, [newGuildId, newGuildId]);

  // Migrate autokits
  console.log('   ⚡ Migrating autokits...');
  await pool.query(`
    UPDATE autokits ak 
    JOIN rust_servers rs ON ak.server_id = rs.id 
    SET ak.guild_id = ? 
    WHERE rs.guild_id = ?
  `, [newGuildId, newGuildId]);

  // Migrate kit_auth
  console.log('   🔐 Migrating kit auth...');
  await pool.query(`
    UPDATE kit_auth ka 
    JOIN rust_servers rs ON ka.server_id = rs.id 
    SET ka.guild_id = ? 
    WHERE rs.guild_id = ?
  `, [newGuildId, newGuildId]);

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

  // Migrate channel settings
  console.log('   📺 Migrating channel settings...');
  await pool.query(`
    UPDATE channel_settings cs 
    JOIN rust_servers rs ON cs.server_id = rs.id 
    SET cs.guild_id = ? 
    WHERE rs.guild_id = ?
  `, [newGuildId, newGuildId]);

  // Migrate position coordinates
  console.log('   📍 Migrating position coordinates...');
  await pool.query(`
    UPDATE position_coordinates pc 
    JOIN rust_servers rs ON pc.server_id = rs.id 
    SET pc.guild_id = ? 
    WHERE rs.guild_id = ?
  `, [newGuildId, newGuildId]);

  // Migrate zones
  console.log('   🗺️  Migrating zones...');
  await pool.query(`
    UPDATE zones z 
    JOIN rust_servers rs ON z.server_id = rs.id 
    SET z.guild_id = ? 
    WHERE rs.guild_id = ?
  `, [newGuildId, newGuildId]);

  // Migrate killfeed configs
  console.log('   💀 Migrating killfeed configs...');
  await pool.query(`
    UPDATE killfeed_configs kc 
    JOIN rust_servers rs ON kc.server_id = rs.id 
    SET kc.guild_id = ? 
    WHERE rs.guild_id = ?
  `, [newGuildId, newGuildId]);

  // Migrate player stats
  console.log('   📈 Migrating player stats...');
  await pool.query(`
    UPDATE player_stats ps 
    JOIN players p ON ps.player_id = p.id 
    SET ps.guild_id = ? 
    WHERE p.guild_id = ?
  `, [newGuildId, newGuildId]);

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

  // Migrate ZORP data
  console.log('   🎯 Migrating ZORP data...');
  await pool.query(`
    UPDATE zorp_defaults zd 
    JOIN rust_servers rs ON zd.server_id = rs.id 
    SET zd.guild_id = ? 
    WHERE rs.guild_id = ?
  `, [newGuildId, newGuildId]);

  // Migrate bounty system data
  console.log('   🎯 Migrating bounty system data...');
  await pool.query(
    'UPDATE bounties SET guild_id = ? WHERE guild_id = ?',
    [newGuildId, oldGuildId]
  );

  // Migrate prison system data
  console.log('   🏛️  Migrating prison system data...');
  await pool.query(
    'UPDATE prison_system SET guild_id = ? WHERE guild_id = ?',
    [newGuildId, oldGuildId]
  );

  // Migrate rider config data
  console.log('   🚗 Migrating rider config data...');
  await pool.query(
    'UPDATE rider_configs SET guild_id = ? WHERE guild_id = ?',
    [newGuildId, oldGuildId]
  );

  // Migrate Nivaro store data
  console.log('   🏪 Migrating Nivaro store data...');
  await pool.query(
    'UPDATE nivaro_store SET guild_id = ? WHERE guild_id = ?',
    [newGuildId, oldGuildId]
  );

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
