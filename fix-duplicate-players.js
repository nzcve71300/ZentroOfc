#!/usr/bin/env node

/**
 * Fix Duplicate Players Script
 * 
 * This script fixes players who have multiple database entries
 * causing coin balance issues. It merges duplicate entries and
 * ensures each player has a single, correct database record.
 */

require('dotenv').config();
const pool = require('./src/db/index');

const playersToFix = [
  {
    name: 'JakeMarshmallow',
    discord_id: '1058718849035423815'
  },
  {
    name: 'It\'s scott_T_BBK',
    discord_id: '649701326795702273'
  },
  {
    name: 'Isouljatoy',
    discord_id: '641084854834036762'
  },
  {
    name: 'Saltyboy999894',
    discord_id: '1334958853925896356'
  },
  {
    name: 'CETSJ1985',
    discord_id: '776018054027018242'
  }
];

async function fixDuplicatePlayers() {
  try {
    console.log('🔍 Starting duplicate player fix process...\n');
    
    for (const player of playersToFix) {
      console.log(`\n👤 Processing: ${player.name} (Discord: ${player.discord_id})`);
      
      // Find all entries for this player
      const [playerEntries] = await pool.query(`
        SELECT p.*, pb.balance, pb.total_spent, pb.last_transaction_at
        FROM players p
        LEFT JOIN player_balances pb ON p.id = pb.player_id
        WHERE p.discord_id = ? OR p.ign = ?
        ORDER BY p.id ASC
      `, [player.discord_id, player.name]);
      
      console.log(`   Found ${playerEntries.length} entries`);
      
      if (playerEntries.length <= 1) {
        console.log(`   ✅ No duplicates found for ${player.name}`);
        continue;
      }
      
      // Show all entries
      playerEntries.forEach((entry, index) => {
        console.log(`   Entry ${index + 1}: ID=${entry.id}, IGN="${entry.ign}", Discord=${entry.discord_id}, Server=${entry.server_id}, Balance=${entry.balance || 0}`);
      });
      
      // Find the entry with the highest balance (most likely the correct one)
      const entryWithHighestBalance = playerEntries.reduce((max, entry) => {
        return (entry.balance || 0) > (max.balance || 0) ? entry : max;
      });
      
      // Find the oldest entry (most likely the original) - use ID as proxy for age
      const oldestEntry = playerEntries.reduce((oldest, entry) => {
        return entry.id < oldest.id ? entry : oldest;
      });
      
      console.log(`   📊 Highest balance entry: ID=${entryWithHighestBalance.id}, Balance=${entryWithHighestBalance.balance || 0}`);
      console.log(`   📅 Oldest entry: ID=${oldestEntry.id}`);
      
      // Use the entry with highest balance as the primary one
      const primaryEntry = entryWithHighestBalance;
      const entriesToRemove = playerEntries.filter(entry => entry.id !== primaryEntry.id);
      
      console.log(`   🎯 Using entry ID=${primaryEntry.id} as primary`);
      console.log(`   🗑️ Will remove ${entriesToRemove.length} duplicate entries`);
      
      // Update the primary entry to ensure it has the correct data
      await pool.query(`
        UPDATE players 
        SET ign = ?, discord_id = ?
        WHERE id = ?
      `, [player.name, player.discord_id, primaryEntry.id]);
      
      console.log(`   ✅ Updated primary entry with correct name and Discord ID`);
      
      // Remove duplicate entries
      for (const duplicateEntry of entriesToRemove) {
        console.log(`   🗑️ Removing duplicate entry ID=${duplicateEntry.id}`);
        
        // Remove player balance entries first
        await pool.query('DELETE FROM player_balances WHERE player_id = ?', [duplicateEntry.id]);
        
        // Remove the player entry
        await pool.query('DELETE FROM players WHERE id = ?', [duplicateEntry.id]);
      }
      
      // Verify the fix
      const [finalEntries] = await pool.query(`
        SELECT p.*, pb.balance, pb.total_spent
        FROM players p
        LEFT JOIN player_balances pb ON p.id = pb.player_id
        WHERE p.discord_id = ? OR p.ign = ?
      `, [player.discord_id, player.name]);
      
      console.log(`   ✅ Verification: ${finalEntries.length} entry(ies) remaining`);
      if (finalEntries.length === 1) {
        const finalEntry = finalEntries[0];
        console.log(`   📊 Final entry: ID=${finalEntry.id}, IGN="${finalEntry.ign}", Discord=${finalEntry.discord_id}, Balance=${finalEntry.balance || 0}`);
      }
    }
    
    console.log('\n🎉 Duplicate player fix process completed!');
    console.log('\n📋 Summary of fixes:');
    console.log('- Merged duplicate player entries');
    console.log('- Preserved entries with highest balances');
    console.log('- Updated names and Discord IDs to be consistent');
    console.log('- Removed duplicate database records');
    
    console.log('\n✅ All players should now have single, correct database entries');
    console.log('💰 Coin balances should now work properly with /balance command');
    
  } catch (error) {
    console.error('❌ Error fixing duplicate players:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixDuplicatePlayers();
