const pool = require('./src/db');

// Rollback configuration
const OLD_GUILD_ID = '1376431874699825216';
const NEW_GUILD_ID = '1413335350742614067';

async function rollbackMigration() {
  console.log('🔄 Starting Migration Rollback');
  console.log(`📤 From: ${NEW_GUILD_ID}`);
  console.log(`📥 Back to: ${OLD_GUILD_ID}`);
  console.log('=' .repeat(60));

  try {
    // Step 1: Verify both guilds exist
    console.log('\n🔍 Step 1: Verifying guild records...');
    const [oldGuild] = await pool.query('SELECT * FROM guilds WHERE discord_id = ?', [OLD_GUILD_ID]);
    const [newGuild] = await pool.query('SELECT * FROM guilds WHERE discord_id = ?', [NEW_GUILD_ID]);

    if (oldGuild.length === 0) {
      throw new Error(`Old guild ${OLD_GUILD_ID} not found in database`);
    }
    if (newGuild.length === 0) {
      throw new Error(`New guild ${NEW_GUILD_ID} not found in database`);
    }

    console.log(`✅ Found old guild: ${oldGuild[0].name || 'Unknown'}`);
    console.log(`✅ Found new guild: ${newGuild[0].name || 'Unknown'}`);

    const oldGuildId = oldGuild[0].id;
    const newGuildId = newGuild[0].id;

    // Step 2: Rollback core data
    console.log('\n📦 Step 2: Rolling back core data...');
    await rollbackCoreData(oldGuildId, newGuildId);

    // Step 3: Rollback additional features
    console.log('\n🎮 Step 3: Rolling back additional features...');
    await rollbackAdditionalFeatures(oldGuildId, newGuildId);

    // Step 4: Verify rollback
    console.log('\n✅ Step 4: Verifying rollback...');
    await verifyRollback();

    console.log('\n🎉 Rollback completed successfully!');
    console.log('📝 All data has been moved back to the original Discord server');

  } catch (error) {
    console.error('\n❌ Rollback failed:', error.message);
    throw error;
  }
}

async function rollbackCoreData(oldGuildId, newGuildId) {
  // Rollback rust_servers
  console.log('   🔧 Rolling back rust servers...');
  await pool.query(
    'UPDATE rust_servers SET guild_id = ? WHERE guild_id = ?',
    [oldGuildId, newGuildId]
  );

  // Rollback players
  console.log('   👥 Rolling back players...');
  await pool.query(
    'UPDATE players SET guild_id = ? WHERE guild_id = ?',
    [oldGuildId, newGuildId]
  );

  // Rollback transactions
  console.log('   📊 Rolling back transactions...');
  await pool.query(`
    UPDATE transactions t 
    JOIN players p ON t.player_id = p.id 
    SET t.guild_id = ? 
    WHERE p.guild_id = ?
  `, [oldGuildId, oldGuildId]);

  // Rollback shop categories (shop_categories don't have guild_id, they're linked via server_id)
  console.log('   🛒 Shop categories will be rolled back automatically via server rollback');

  // Rollback shop items (shop_items don't have guild_id, they're linked via category_id)
  console.log('   🛍️  Shop items will be rolled back automatically via category rollback');

  // Rollback shop kits (shop_kits don't have guild_id, they're linked via category_id)
  console.log('   🎒 Shop kits will be rolled back automatically via category rollback');

  // Rollback autokits (autokits don't have guild_id, they're linked via server_id)
  console.log('   ⚡ Autokits will be rolled back automatically via server rollback');

  // Rollback kit_auth (kit_auth don't have guild_id, they're linked via server_id)
  console.log('   🔐 Kit auth will be rolled back automatically via server rollback');

  // Rollback link_blocks and link_requests
  console.log('   🔗 Rolling back link blocks and requests...');
  await pool.query(
    'UPDATE link_blocks SET guild_id = ? WHERE guild_id = ?',
    [oldGuildId, newGuildId]
  );
  await pool.query(
    'UPDATE link_requests SET guild_id = ? WHERE guild_id = ?',
    [oldGuildId, newGuildId]
  );

  console.log('   ✅ Core data rollback completed');
}

async function rollbackAdditionalFeatures(oldGuildId, newGuildId) {
  // Rollback channel settings (channel_settings don't have guild_id, they're linked via server_id)
  console.log('   📺 Channel settings will be rolled back automatically via server rollback');

  // Rollback position coordinates (position_coordinates don't have guild_id, they're linked via server_id)
  console.log('   📍 Position coordinates will be rolled back automatically via server rollback');

  // Rollback zones (zones don't have guild_id, they're linked via server_id)
  console.log('   🗺️  Zones will be rolled back automatically via server rollback');

  // Rollback killfeed configs (killfeed_configs don't have guild_id, they're linked via server_id)
  console.log('   💀 Killfeed configs will be rolled back automatically via server rollback');

  // Rollback player stats (player_stats don't have guild_id, they're linked via player_id)
  console.log('   📈 Player stats will be rolled back automatically via player rollback');

  // Rollback home teleport data
  console.log('   🏠 Rolling back home teleport data...');
  await pool.query(
    'UPDATE player_homes SET guild_id = ? WHERE guild_id = ?',
    [oldGuildId, newGuildId]
  );
  await pool.query(
    'UPDATE player_whitelists SET guild_id = ? WHERE guild_id = ?',
    [oldGuildId, newGuildId]
  );

  // Rollback ZORP data (zorp_defaults don't have guild_id, they're linked via server_id)
  console.log('   🎯 ZORP data will be rolled back automatically via server rollback');

  // Rollback bounty system data (if bounties table exists and has guild_id)
  console.log('   🎯 Checking for bounty system data...');
  try {
    const [bountyCheck] = await pool.query('SHOW TABLES LIKE "bounties"');
    if (bountyCheck.length > 0) {
      const [bountyColumns] = await pool.query('SHOW COLUMNS FROM bounties LIKE "guild_id"');
      if (bountyColumns.length > 0) {
        await pool.query('UPDATE bounties SET guild_id = ? WHERE guild_id = ?', [oldGuildId, newGuildId]);
        console.log('   ✅ Bounty system data rolled back');
      } else {
        console.log('   ℹ️  Bounty system data linked via other tables');
      }
    } else {
      console.log('   ℹ️  Bounty system table not found');
    }
  } catch (error) {
    console.log('   ℹ️  Bounty system not available');
  }

  // Rollback prison system data (if prison_system table exists and has guild_id)
  console.log('   🏛️  Checking for prison system data...');
  try {
    const [prisonCheck] = await pool.query('SHOW TABLES LIKE "prison_system"');
    if (prisonCheck.length > 0) {
      const [prisonColumns] = await pool.query('SHOW COLUMNS FROM prison_system LIKE "guild_id"');
      if (prisonColumns.length > 0) {
        await pool.query('UPDATE prison_system SET guild_id = ? WHERE guild_id = ?', [oldGuildId, newGuildId]);
        console.log('   ✅ Prison system data rolled back');
      } else {
        console.log('   ℹ️  Prison system data linked via other tables');
      }
    } else {
      console.log('   ℹ️  Prison system table not found');
    }
  } catch (error) {
    console.log('   ℹ️  Prison system not available');
  }

  // Rollback rider config data (if rider_configs table exists and has guild_id)
  console.log('   🚗 Checking for rider config data...');
  try {
    const [riderCheck] = await pool.query('SHOW TABLES LIKE "rider_configs"');
    if (riderCheck.length > 0) {
      const [riderColumns] = await pool.query('SHOW COLUMNS FROM rider_configs LIKE "guild_id"');
      if (riderColumns.length > 0) {
        await pool.query('UPDATE rider_configs SET guild_id = ? WHERE guild_id = ?', [oldGuildId, newGuildId]);
        console.log('   ✅ Rider config data rolled back');
      } else {
        console.log('   ℹ️  Rider config data linked via other tables');
      }
    } else {
      console.log('   ℹ️  Rider config table not found');
    }
  } catch (error) {
    console.log('   ℹ️  Rider config not available');
  }

  // Rollback Nivaro store data (if nivaro_store table exists and has guild_id)
  console.log('   🏪 Checking for Nivaro store data...');
  try {
    const [nivaroCheck] = await pool.query('SHOW TABLES LIKE "nivaro_store"');
    if (nivaroCheck.length > 0) {
      const [nivaroColumns] = await pool.query('SHOW COLUMNS FROM nivaro_store LIKE "guild_id"');
      if (nivaroColumns.length > 0) {
        await pool.query('UPDATE nivaro_store SET guild_id = ? WHERE guild_id = ?', [oldGuildId, newGuildId]);
        console.log('   ✅ Nivaro store data rolled back');
      } else {
        console.log('   ℹ️  Nivaro store data linked via other tables');
      }
    } else {
      console.log('   ℹ️  Nivaro store table not found');
    }
  } catch (error) {
    console.log('   ℹ️  Nivaro store not available');
  }

  console.log('   ✅ Additional features rollback completed');
}

async function verifyRollback() {
  const [oldServers] = await pool.query(`
    SELECT rs.* FROM rust_servers rs 
    JOIN guilds g ON rs.guild_id = g.id 
    WHERE g.discord_id = ?
  `, [OLD_GUILD_ID]);
  const [oldPlayers] = await pool.query(`
    SELECT p.* FROM players p 
    JOIN guilds g ON p.guild_id = g.id 
    WHERE g.discord_id = ?
  `, [OLD_GUILD_ID]);

  const [newServers] = await pool.query(`
    SELECT rs.* FROM rust_servers rs 
    JOIN guilds g ON rs.guild_id = g.id 
    WHERE g.discord_id = ?
  `, [NEW_GUILD_ID]);
  const [newPlayers] = await pool.query(`
    SELECT p.* FROM players p 
    JOIN guilds g ON p.guild_id = g.id 
    WHERE g.discord_id = ?
  `, [NEW_GUILD_ID]);

  console.log(`📊 Rollback verification:`);
  console.log(`   - Old guild servers: ${oldServers.length}`);
  console.log(`   - Old guild players: ${oldPlayers.length}`);
  console.log(`   - New guild servers: ${newServers.length}`);
  console.log(`   - New guild players: ${newPlayers.length}`);

  if (newServers.length > 0 || newPlayers.length > 0) {
    console.log(`⚠️  Warning: Some data still exists in the new guild`);
  }

  console.log('✅ Rollback verification completed');
}

// Run the rollback
if (require.main === module) {
  rollbackMigration()
    .then(() => {
      console.log('\n🎉 Rollback completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Rollback failed:', error);
      process.exit(1);
    });
}

module.exports = { rollbackMigration };
