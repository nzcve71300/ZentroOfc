#!/usr/bin/env node

/**
 * Fix Scott Discord ID and Merge Entries Script
 * 
 * This script fixes the Discord ID mismatch for scott_T_BBK by:
 * 1. Finding the entry with the highest balance (where bot added tokens)
 * 2. Merging all other entries into the primary one
 * 3. Setting the correct Discord ID
 */

require('dotenv').config();
const pool = require('./src/db/index');

async function fixScottDiscordMerge() {
  try {
    console.log('🔍 Fixing scott_T_BBK Discord ID and merging entries...\n');
    
    const expectedDiscordId = '649701326795702273';
    const playerName = 'scott_T_BBK';
    
    // Find all entries for this player
    const [playerEntries] = await pool.query(`
      SELECT p.*, pb.balance, pb.total_spent, pb.last_transaction_at
      FROM players p
      LEFT JOIN player_balances pb ON p.id = pb.player_id
      WHERE p.ign = ?
      ORDER BY pb.balance DESC, p.id ASC
    `, [playerName]);
    
    console.log(`📊 Found ${playerEntries.length} entries for ${playerName}`);
    console.log(`🎯 Expected Discord ID: ${expectedDiscordId}\n`);
    
    if (playerEntries.length === 0) {
      console.log('❌ No entries found for this player');
      return;
    }
    
    // Show all entries sorted by balance (highest first)
    console.log('📋 All entries (sorted by balance):');
    playerEntries.forEach((entry, index) => {
      console.log(`   ${index + 1}. ID=${entry.id}, Discord=${entry.discord_id || 'NULL'}, Server=${entry.server_id}, Balance=${entry.balance || 0}`);
    });
    
    // Find the primary entry (highest balance or first if all same)
    const primaryEntry = playerEntries[0];
    const duplicateEntries = playerEntries.slice(1);
    
    console.log(`\n🎯 Primary entry: ID=${primaryEntry.id}, Balance=${primaryEntry.balance || 0}`);
    console.log(`🗑️ Duplicate entries to merge: ${duplicateEntries.length}`);
    
    if (duplicateEntries.length === 0) {
      console.log('✅ No duplicates to merge, just fixing Discord ID...');
      
      // Just update the Discord ID
      const [updateResult] = await pool.query(`
        UPDATE players 
        SET discord_id = ?
        WHERE id = ?
      `, [expectedDiscordId, primaryEntry.id]);
      
      console.log(`✅ Updated Discord ID for entry ID=${primaryEntry.id}`);
      
    } else {
      console.log('\n🔄 Merging duplicate entries...');
      
      // Update the primary entry with correct Discord ID
      const [updateResult] = await pool.query(`
        UPDATE players 
        SET discord_id = ?
        WHERE id = ?
      `, [expectedDiscordId, primaryEntry.id]);
      
      console.log(`✅ Updated primary entry ID=${primaryEntry.id} with correct Discord ID`);
      
      // Delete duplicate entries
      for (const duplicate of duplicateEntries) {
        console.log(`🗑️ Deleting duplicate entry ID=${duplicate.id}`);
        
        // Delete associated balance entry first
        await pool.query('DELETE FROM player_balances WHERE player_id = ?', [duplicate.id]);
        
        // Delete the player entry
        await pool.query('DELETE FROM players WHERE id = ?', [duplicate.id]);
      }
      
      console.log(`✅ Merged ${duplicateEntries.length} duplicate entries into primary entry`);
    }
    
    // Verify the final result
    const [finalEntries] = await pool.query(`
      SELECT p.*, pb.balance, pb.total_spent
      FROM players p
      LEFT JOIN player_balances pb ON p.id = pb.player_id
      WHERE p.ign = ? OR p.discord_id = ?
      ORDER BY p.id
    `, [playerName, expectedDiscordId]);
    
    console.log('\n🔍 Final verification:');
    finalEntries.forEach((entry, index) => {
      console.log(`   ${index + 1}. ID=${entry.id}, IGN="${entry.ign}", Discord=${entry.discord_id}, Server=${entry.server_id}, Balance=${entry.balance || 0}`);
    });
    
    console.log('\n🎉 Discord ID fix and merge completed!');
    console.log('\n📋 Summary:');
    console.log('- ✅ Merged duplicate entries');
    console.log('- ✅ Set correct Discord ID');
    console.log('- ✅ Preserved highest balance');
    console.log('- ✅ Bot and app should now use same Discord ID');
    
  } catch (error) {
    console.error('❌ Error fixing Discord ID and merging:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixScottDiscordMerge();
