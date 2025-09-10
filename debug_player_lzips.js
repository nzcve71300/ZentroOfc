const { pool } = require('./src/db');

async function debugPlayerLzips() {
  try {
    console.log('🔍 Investigating player: lZips-');
    console.log('=====================================\n');
    
    // 1. Check all player entries
    console.log('1. 📊 ALL PLAYER ENTRIES:');
    const [allPlayers] = await pool.query(
      'SELECT * FROM players WHERE ign LIKE ? OR ign LIKE ?',
      ['%lZips%', '%lzips%']
    );
    
    if (allPlayers.length === 0) {
      console.log('❌ No player entries found for lZips-');
    } else {
      console.log(`✅ Found ${allPlayers.length} player entries:`);
      allPlayers.forEach((player, index) => {
        console.log(`   ${index + 1}. ID: ${player.id}, IGN: "${player.ign}", Discord: ${player.discord_id}, Server: ${player.server_id}`);
      });
    }
    
    console.log('\n2. 💰 ECONOMY ENTRIES:');
    const [economyEntries] = await pool.query(
      'SELECT * FROM economy WHERE player_name LIKE ? OR player_name LIKE ?',
      ['%lZips%', '%lzips%']
    );
    
    if (economyEntries.length === 0) {
      console.log('❌ No economy entries found for lZips-');
    } else {
      console.log(`✅ Found ${economyEntries.length} economy entries:`);
      economyEntries.forEach((entry, index) => {
        console.log(`   ${index + 1}. Player: "${entry.player_name}", Balance: ${entry.balance}, Server: ${entry.server_id}, Guild: ${entry.guild_id}`);
      });
    }
    
    console.log('\n3. 🔗 PLAYER LINKS:');
    const [playerLinks] = await pool.query(
      'SELECT * FROM player_links WHERE ign LIKE ? OR ign LIKE ?',
      ['%lZips%', '%lzips%']
    );
    
    if (playerLinks.length === 0) {
      console.log('❌ No player links found for lZips-');
    } else {
      console.log(`✅ Found ${playerLinks.length} player links:`);
      playerLinks.forEach((link, index) => {
        console.log(`   ${index + 1}. IGN: "${link.ign}", Discord: ${link.discord_id}, Server: ${link.server_id}, Guild: ${link.guild_id}`);
      });
    }
    
    console.log('\n4. 🎯 EXACT MATCH SEARCH:');
    const [exactMatch] = await pool.query(
      'SELECT * FROM players WHERE ign = ?',
      ['lZips-']
    );
    
    if (exactMatch.length === 0) {
      console.log('❌ No exact match for "lZips-"');
    } else {
      console.log(`✅ Found ${exactMatch.length} exact matches:`);
      exactMatch.forEach((player, index) => {
        console.log(`   ${index + 1}. ID: ${player.id}, IGN: "${player.ign}", Discord: ${player.discord_id}, Server: ${player.server_id}`);
      });
    }
    
    console.log('\n5. 🔍 CASE-INSENSITIVE SEARCH:');
    const [caseInsensitive] = await pool.query(
      'SELECT * FROM players WHERE LOWER(ign) = LOWER(?)',
      ['lZips-']
    );
    
    if (caseInsensitive.length === 0) {
      console.log('❌ No case-insensitive matches for "lZips-"');
    } else {
      console.log(`✅ Found ${caseInsensitive.length} case-insensitive matches:`);
      caseInsensitive.forEach((player, index) => {
        console.log(`   ${index + 1}. ID: ${player.id}, IGN: "${player.ign}", Discord: ${player.discord_id}, Server: ${player.server_id}`);
      });
    }
    
    console.log('\n6. 📋 RECENT CURRENCY ADDITIONS:');
    const [recentAdditions] = await pool.query(
      'SELECT * FROM economy WHERE player_name LIKE ? ORDER BY updated_at DESC LIMIT 10',
      ['%lZips%']
    );
    
    if (recentAdditions.length === 0) {
      console.log('❌ No recent currency additions found');
    } else {
      console.log(`✅ Found ${recentAdditions.length} recent currency additions:`);
      recentAdditions.forEach((entry, index) => {
        console.log(`   ${index + 1}. Player: "${entry.player_name}", Balance: ${entry.balance}, Updated: ${entry.updated_at}, Server: ${entry.server_id}`);
      });
    }
    
    console.log('\n7. 🛠️ RECOMMENDED ACTIONS:');
    if (allPlayers.length > 1) {
      console.log('⚠️  DUPLICATE PLAYER ENTRIES DETECTED!');
      console.log('   - Multiple player records found');
      console.log('   - This can cause currency issues');
      console.log('   - Consider consolidating entries');
    }
    
    if (economyEntries.length > 1) {
      console.log('⚠️  DUPLICATE ECONOMY ENTRIES DETECTED!');
      console.log('   - Multiple economy records found');
      console.log('   - This explains why /balance shows wrong amount');
      console.log('   - Need to consolidate economy entries');
    }
    
    console.log('\n8. 🔧 FIX SUGGESTIONS:');
    console.log('   - Check for exact case sensitivity issues');
    console.log('   - Look for hidden characters in player name');
    console.log('   - Consolidate duplicate entries');
    console.log('   - Verify server_id matches between tables');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugPlayerLzips();
