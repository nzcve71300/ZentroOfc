#!/usr/bin/env node

/**
 * Clear Scott Entries Script
 * 
 * This script completely clears all database entries for scott_T_BBK
 * so he can start fresh with /link command
 */

require('dotenv').config();
const pool = require('./src/db/index');

async function clearScottEntries() {
  try {
    console.log('🗑️ Clearing all scott_T_BBK database entries...\n');
    
    const discordId = '649701326795702273';
    const playerName = 'scott_T_BBK';
    
    // Find all entries for this player
    const [playerEntries] = await pool.query(`
      SELECT p.*, pb.balance
      FROM players p
      LEFT JOIN player_balances pb ON p.id = pb.player_id
      WHERE p.ign = ? OR p.discord_id = ?
      ORDER BY p.id
    `, [playerName, discordId]);
    
    console.log(`📊 Found ${playerEntries.length} entries to clear:`);
    playerEntries.forEach((entry, index) => {
      console.log(`   ${index + 1}. ID=${entry.id}, IGN="${entry.ign}", Discord=${entry.discord_id}, Server=${entry.server_id}, Balance=${entry.balance || 0}`);
    });
    
    if (playerEntries.length === 0) {
      console.log('✅ No entries found to clear');
      return;
    }
    
    console.log('\n🗑️ Clearing all entries...');
    
    // Delete all balance entries first
    for (const entry of playerEntries) {
      console.log(`   Deleting balance entry for player ID=${entry.id}...`);
      await pool.query('DELETE FROM player_balances WHERE player_id = ?', [entry.id]);
    }
    
    // Delete all player entries
    for (const entry of playerEntries) {
      console.log(`   Deleting player entry ID=${entry.id}...`);
      await pool.query('DELETE FROM players WHERE id = ?', [entry.id]);
    }
    
    console.log(`\n✅ Cleared ${playerEntries.length} entries`);
    
    // Verify everything is cleared
    const [remainingEntries] = await pool.query(`
      SELECT p.*, pb.balance
      FROM players p
      LEFT JOIN player_balances pb ON p.id = pb.player_id
      WHERE p.ign = ? OR p.discord_id = ?
      ORDER BY p.id
    `, [playerName, discordId]);
    
    console.log('\n🔍 Verification:');
    if (remainingEntries.length === 0) {
      console.log('✅ All entries successfully cleared');
    } else {
      console.log(`❌ ${remainingEntries.length} entries still remain`);
      remainingEntries.forEach((entry, index) => {
        console.log(`   ${index + 1}. ID=${entry.id}, IGN="${entry.ign}", Discord=${entry.discord_id}`);
      });
    }
    
    console.log('\n🎉 Database cleanup completed!');
    console.log('\n📋 Summary:');
    console.log('- ✅ All scott_T_BBK entries cleared from database');
    console.log('- ✅ Player can now use /link command fresh');
    console.log('- ✅ No duplicate or conflicting entries');
    console.log('- ✅ Clean slate for proper linking');
    
  } catch (error) {
    console.error('❌ Error clearing entries:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the cleanup
clearScottEntries();
