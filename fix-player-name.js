#!/usr/bin/env node

/**
 * Fix Player Name Script
 * 
 * This script fixes the player name for scott_T_BBK
 * Changes from "It's scott_T_BBK" to "scott_T_BBK"
 */

require('dotenv').config();
const pool = require('./src/db/index');

async function fixPlayerName() {
  try {
    console.log('🔍 Fixing player name for scott_T_BBK...\n');
    
    const discordId = '649701326795702273';
    const oldName = 'It\'s scott_T_BBK';
    const newName = 'scott_T_BBK';
    
    // Find all entries for this player
    const [playerEntries] = await pool.query(`
      SELECT p.*, pb.balance, pb.total_spent
      FROM players p
      LEFT JOIN player_balances pb ON p.id = pb.player_id
      WHERE p.discord_id = ? OR p.ign = ? OR p.ign = ?
    `, [discordId, oldName, newName]);
    
    console.log(`📊 Found ${playerEntries.length} entries for this player`);
    
    if (playerEntries.length === 0) {
      console.log('❌ No entries found for this player');
      return;
    }
    
    // Show current entries
    playerEntries.forEach((entry, index) => {
      console.log(`   Entry ${index + 1}: ID=${entry.id}, IGN="${entry.ign}", Discord=${entry.discord_id}, Server=${entry.server_id}`);
    });
    
    // Update all entries with the correct name
    const [updateResult] = await pool.query(`
      UPDATE players 
      SET ign = ?
      WHERE discord_id = ? OR ign = ? OR ign = ?
    `, [newName, discordId, oldName, newName]);
    
    console.log(`✅ Updated ${updateResult.affectedRows} player entries`);
    console.log(`📝 Changed name from "${oldName}" to "${newName}"`);
    
    // Verify the fix
    const [finalEntries] = await pool.query(`
      SELECT p.*, pb.balance
      FROM players p
      LEFT JOIN player_balances pb ON p.id = pb.player_id
      WHERE p.discord_id = ? OR p.ign = ?
    `, [discordId, newName]);
    
    console.log('\n🔍 Verification:');
    finalEntries.forEach((entry, index) => {
      console.log(`   Entry ${index + 1}: ID=${entry.id}, IGN="${entry.ign}", Discord=${entry.discord_id}, Balance=${entry.balance || 0}`);
    });
    
    console.log('\n🎉 Player name fix completed!');
    console.log(`✅ All entries now show correct name: "${newName}"`);
    
  } catch (error) {
    console.error('❌ Error fixing player name:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixPlayerName();
