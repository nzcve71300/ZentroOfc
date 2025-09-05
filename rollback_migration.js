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

  // Rollback shop categories
  console.log('   🛒 Rolling back shop categories...');
  await pool.query(`
    UPDATE shop_categories sc 
    JOIN rust_servers rs ON sc.server_id = rs.id 
    SET sc.guild_id = ? 
    WHERE rs.guild_id = ?
  `, [oldGuildId, oldGuildId]);

  // Rollback shop items
  console.log('   🛍️  Rolling back shop items...');
  await pool.query(`
    UPDATE shop_items si 
    JOIN shop_categories sc ON si.category_id = sc.id 
    SET si.guild_id = ? 
    WHERE sc.guild_id = ?
  `, [oldGuildId, oldGuildId]);

  // Rollback shop kits
  console.log('   🎒 Rolling back shop kits...');
  await pool.query(`
    UPDATE shop_kits sk 
    JOIN shop_categories sc ON sk.category_id = sc.id 
    SET sk.guild_id = ? 
    WHERE sc.guild_id = ?
  `, [oldGuildId, oldGuildId]);

  // Rollback autokits
  console.log('   ⚡ Rolling back autokits...');
  await pool.query(`
    UPDATE autokits ak 
    JOIN rust_servers rs ON ak.server_id = rs.id 
    SET ak.guild_id = ? 
    WHERE rs.guild_id = ?
  `, [oldGuildId, oldGuildId]);

  // Rollback kit_auth
  console.log('   🔐 Rolling back kit auth...');
  await pool.query(`
    UPDATE kit_auth ka 
    JOIN rust_servers rs ON ka.server_id = rs.id 
    SET ka.guild_id = ? 
    WHERE rs.guild_id = ?
  `, [oldGuildId, oldGuildId]);

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
  // Rollback channel settings
  console.log('   📺 Rolling back channel settings...');
  await pool.query(`
    UPDATE channel_settings cs 
    JOIN rust_servers rs ON cs.server_id = rs.id 
    SET cs.guild_id = ? 
    WHERE rs.guild_id = ?
  `, [oldGuildId, oldGuildId]);

  // Rollback position coordinates
  console.log('   📍 Rolling back position coordinates...');
  await pool.query(`
    UPDATE position_coordinates pc 
    JOIN rust_servers rs ON pc.server_id = rs.id 
    SET pc.guild_id = ? 
    WHERE rs.guild_id = ?
  `, [oldGuildId, oldGuildId]);

  // Rollback zones
  console.log('   🗺️  Rolling back zones...');
  await pool.query(`
    UPDATE zones z 
    JOIN rust_servers rs ON z.server_id = rs.id 
    SET z.guild_id = ? 
    WHERE rs.guild_id = ?
  `, [oldGuildId, oldGuildId]);

  // Rollback killfeed configs
  console.log('   💀 Rolling back killfeed configs...');
  await pool.query(`
    UPDATE killfeed_configs kc 
    JOIN rust_servers rs ON kc.server_id = rs.id 
    SET kc.guild_id = ? 
    WHERE rs.guild_id = ?
  `, [oldGuildId, oldGuildId]);

  // Rollback player stats
  console.log('   📈 Rolling back player stats...');
  await pool.query(`
    UPDATE player_stats ps 
    JOIN players p ON ps.player_id = p.id 
    SET ps.guild_id = ? 
    WHERE p.guild_id = ?
  `, [oldGuildId, oldGuildId]);

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

  // Rollback ZORP data
  console.log('   🎯 Rolling back ZORP data...');
  await pool.query(`
    UPDATE zorp_defaults zd 
    JOIN rust_servers rs ON zd.server_id = rs.id 
    SET zd.guild_id = ? 
    WHERE rs.guild_id = ?
  `, [oldGuildId, oldGuildId]);

  // Rollback bounty system data
  console.log('   🎯 Rolling back bounty system data...');
  await pool.query(
    'UPDATE bounties SET guild_id = ? WHERE guild_id = ?',
    [oldGuildId, newGuildId]
  );

  // Rollback prison system data
  console.log('   🏛️  Rolling back prison system data...');
  await pool.query(
    'UPDATE prison_system SET guild_id = ? WHERE guild_id = ?',
    [oldGuildId, newGuildId]
  );

  // Rollback rider config data
  console.log('   🚗 Rolling back rider config data...');
  await pool.query(
    'UPDATE rider_configs SET guild_id = ? WHERE guild_id = ?',
    [oldGuildId, newGuildId]
  );

  // Rollback Nivaro store data
  console.log('   🏪 Rolling back Nivaro store data...');
  await pool.query(
    'UPDATE nivaro_store SET guild_id = ? WHERE guild_id = ?',
    [oldGuildId, newGuildId]
  );

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
