const pool = require('./src/db');

const OLD_GUILD_ID = '1376431874699825216';
const NEW_GUILD_ID = '1413335350742614067';

async function checkPlayerLinks() {
  console.log('🔍 Checking Player Links Migration');
  console.log('==================================\n');

  try {
    // Step 1: Get guild information
    console.log('📋 Step 1: Getting guild information...');
    const [oldGuild] = await pool.query('SELECT * FROM guilds WHERE discord_id = ?', [OLD_GUILD_ID]);
    const [newGuild] = await pool.query('SELECT * FROM guilds WHERE discord_id = ?', [NEW_GUILD_ID]);
    
    if (oldGuild.length === 0 || newGuild.length === 0) {
      console.log('❌ Guild records not found');
      return;
    }

    const oldGuildId = oldGuild[0].id;
    const newGuildId = newGuild[0].id;

    console.log(`Old guild ID: ${oldGuildId}`);
    console.log(`New guild ID: ${newGuildId}`);

    // Step 2: Check players in old guild
    console.log('\n📋 Step 2: Checking players in old guild...');
    const [oldPlayers] = await pool.query(
      'SELECT * FROM players WHERE guild_id = ? AND is_active = true', 
      [oldGuildId]
    );
    
    console.log(`Players in old guild: ${oldPlayers.length}`);
    oldPlayers.forEach(player => {
      console.log(`   - ${player.ign} (Discord: ${player.discord_id})`);
    });

    // Step 3: Check players in new guild
    console.log('\n📋 Step 3: Checking players in new guild...');
    const [newPlayers] = await pool.query(
      'SELECT * FROM players WHERE guild_id = ? AND is_active = true', 
      [newGuildId]
    );
    
    console.log(`Players in new guild: ${newPlayers.length}`);
    newPlayers.forEach(player => {
      console.log(`   - ${player.ign} (Discord: ${player.discord_id})`);
    });

    // Step 4: Check economy data
    console.log('\n📋 Step 4: Checking economy data...');
    const [oldEconomy] = await pool.query(`
      SELECT e.*, p.ign, p.discord_id 
      FROM economy e 
      JOIN players p ON e.player_id = p.id 
      WHERE p.guild_id = ?
    `, [oldGuildId]);
    
    const [newEconomy] = await pool.query(`
      SELECT e.*, p.ign, p.discord_id 
      FROM economy e 
      JOIN players p ON e.player_id = p.id 
      WHERE p.guild_id = ?
    `, [newGuildId]);
    
    console.log(`Economy records in old guild: ${oldEconomy.length}`);
    oldEconomy.forEach(econ => {
      console.log(`   - ${econ.ign}: ${econ.balance} coins`);
    });
    
    console.log(`Economy records in new guild: ${newEconomy.length}`);
    newEconomy.forEach(econ => {
      console.log(`   - ${econ.ign}: ${econ.balance} coins`);
    });

    // Step 5: Check transactions
    console.log('\n📋 Step 5: Checking transactions...');
    const [oldTransactions] = await pool.query(`
      SELECT t.*, p.ign, p.discord_id 
      FROM transactions t 
      JOIN players p ON t.player_id = p.id 
      WHERE p.guild_id = ?
      ORDER BY t.timestamp DESC
      LIMIT 10
    `, [oldGuildId]);
    
    const [newTransactions] = await pool.query(`
      SELECT t.*, p.ign, p.discord_id 
      FROM transactions t 
      JOIN players p ON t.player_id = p.id 
      WHERE p.guild_id = ?
      ORDER BY t.timestamp DESC
      LIMIT 10
    `, [newGuildId]);
    
    console.log(`Recent transactions in old guild: ${oldTransactions.length}`);
    oldTransactions.forEach(trans => {
      console.log(`   - ${trans.ign}: ${trans.amount} ${trans.type} (${trans.timestamp})`);
    });
    
    console.log(`Recent transactions in new guild: ${newTransactions.length}`);
    newTransactions.forEach(trans => {
      console.log(`   - ${trans.ign}: ${trans.amount} ${trans.type} (${trans.timestamp})`);
    });

    // Step 6: Summary
    console.log('\n📋 Step 6: Migration Summary...');
    console.log(`✅ Players migrated: ${oldPlayers.length} → ${newPlayers.length}`);
    console.log(`✅ Economy records migrated: ${oldEconomy.length} → ${newEconomy.length}`);
    console.log(`✅ Transactions migrated: ${oldTransactions.length} → ${newTransactions.length}`);
    
    if (newPlayers.length > 0) {
      console.log('\n🎉 Player links appear to be working!');
      console.log('📝 Players should be able to use /link, /balance, /daily, etc. in the new Discord server');
    } else {
      console.log('\n❌ No players found in new guild - migration may have failed');
    }

  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

// Run the check
if (require.main === module) {
  checkPlayerLinks()
    .then(() => {
      console.log('\n✅ Player links check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Check failed:', error);
      process.exit(1);
    });
}

module.exports = { checkPlayerLinks };
