#!/usr/bin/env node

/**
 * Investigate Discord IDs Script
 * 
 * This script investigates the Discord ID mismatch issue for scott_T_BBK
 * and fixes any inconsistencies in the database.
 */

require('dotenv').config();
const pool = require('./src/db/index');

async function investigateDiscordIds() {
  try {
    console.log('🔍 Investigating Discord ID mismatch for scott_T_BBK...\n');
    
    const expectedDiscordId = '649701326795702273';
    const playerName = 'scott_T_BBK';
    
    // Find all entries for this player
    const [playerEntries] = await pool.query(`
      SELECT p.*, pb.balance, pb.total_spent, pb.last_transaction_at
      FROM players p
      LEFT JOIN player_balances pb ON p.id = pb.player_id
      WHERE p.ign = ? OR p.discord_id = ?
      ORDER BY p.id
    `, [playerName, expectedDiscordId]);
    
    console.log(`📊 Found ${playerEntries.length} entries for ${playerName}`);
    console.log(`🎯 Expected Discord ID: ${expectedDiscordId}\n`);
    
    // Show all entries
    playerEntries.forEach((entry, index) => {
      console.log(`Entry ${index + 1}:`);
      console.log(`   ID: ${entry.id}`);
      console.log(`   IGN: "${entry.ign}"`);
      console.log(`   Discord ID: ${entry.discord_id || 'NULL'}`);
      console.log(`   Server ID: ${entry.server_id}`);
      console.log(`   Balance: ${entry.balance || 0}`);
      console.log(`   Total Spent: ${entry.total_spent || 0}`);
      console.log(`   Last Transaction: ${entry.last_transaction_at || 'Never'}`);
      console.log('');
    });
    
    // Check if there are entries with different Discord IDs
    const entriesWithWrongDiscordId = playerEntries.filter(entry => 
      entry.discord_id && entry.discord_id !== expectedDiscordId
    );
    
    if (entriesWithWrongDiscordId.length > 0) {
      console.log(`⚠️ Found ${entriesWithWrongDiscordId.length} entries with incorrect Discord IDs:`);
      entriesWithWrongDiscordId.forEach((entry, index) => {
        console.log(`   ${index + 1}. ID=${entry.id}, Discord=${entry.discord_id}, Balance=${entry.balance || 0}`);
      });
      
      console.log('\n🔧 Fixing Discord IDs...');
      
      // Update all entries to use the correct Discord ID
      const [updateResult] = await pool.query(`
        UPDATE players 
        SET discord_id = ?
        WHERE ign = ?
      `, [expectedDiscordId, playerName]);
      
      console.log(`✅ Updated ${updateResult.affectedRows} player entries with correct Discord ID`);
      
      // Show updated entries
      const [updatedEntries] = await pool.query(`
        SELECT p.*, pb.balance, pb.total_spent
        FROM players p
        LEFT JOIN player_balances pb ON p.id = pb.player_id
        WHERE p.ign = ? OR p.discord_id = ?
        ORDER BY p.id
      `, [playerName, expectedDiscordId]);
      
      console.log('\n🔍 Updated entries:');
      updatedEntries.forEach((entry, index) => {
        console.log(`   ${index + 1}. ID=${entry.id}, IGN="${entry.ign}", Discord=${entry.discord_id}, Balance=${entry.balance || 0}`);
      });
      
    } else {
      console.log('✅ All entries already have the correct Discord ID');
    }
    
    // Check for duplicate entries that might need merging
    const entriesByServer = {};
    playerEntries.forEach(entry => {
      if (!entriesByServer[entry.server_id]) {
        entriesByServer[entry.server_id] = [];
      }
      entriesByServer[entry.server_id].push(entry);
    });
    
    console.log('\n📊 Entries by server:');
    Object.keys(entriesByServer).forEach(serverId => {
      const entries = entriesByServer[serverId];
      console.log(`   Server ${serverId}: ${entries.length} entries`);
      if (entries.length > 1) {
        console.log(`   ⚠️ Multiple entries found for this server - may need merging`);
        entries.forEach(entry => {
          console.log(`      ID=${entry.id}, Discord=${entry.discord_id}, Balance=${entry.balance || 0}`);
        });
      }
    });
    
    console.log('\n🎉 Investigation completed!');
    console.log('\n📋 Summary:');
    console.log('- All entries now have consistent Discord ID');
    console.log('- Player should now see correct balance in app');
    console.log('- Bot and app should use the same Discord ID');
    
  } catch (error) {
    console.error('❌ Error investigating Discord IDs:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the investigation
investigateDiscordIds();
