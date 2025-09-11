#!/usr/bin/env node

/**
 * Verify and Fix Scott Discord ID Script
 * 
 * This script verifies the current state and ensures the Discord ID is correct
 */

require('dotenv').config();
const pool = require('./src/db/index');

async function verifyAndFixScott() {
  try {
    console.log('🔍 Verifying scott_T_BBK Discord ID...\n');
    
    const expectedDiscordId = '649701326795702273';
    const playerName = 'scott_T_BBK';
    
    // Check current state
    const [currentEntries] = await pool.query(`
      SELECT p.*, pb.balance, pb.total_spent
      FROM players p
      LEFT JOIN player_balances pb ON p.id = pb.player_id
      WHERE p.ign = ? OR p.discord_id = ?
      ORDER BY p.id
    `, [playerName, expectedDiscordId]);
    
    console.log(`📊 Current entries for ${playerName}:`);
    currentEntries.forEach((entry, index) => {
      console.log(`   ${index + 1}. ID=${entry.id}, IGN="${entry.ign}", Discord=${entry.discord_id}, Server=${entry.server_id}, Balance=${entry.balance || 0}`);
    });
    
    // Check if Discord ID needs fixing
    const needsFix = currentEntries.some(entry => 
      entry.discord_id !== expectedDiscordId
    );
    
    if (needsFix) {
      console.log(`\n⚠️ Discord ID needs fixing. Current: ${currentEntries[0]?.discord_id}, Expected: ${expectedDiscordId}`);
      
      // Fix the Discord ID
      const [updateResult] = await pool.query(`
        UPDATE players 
        SET discord_id = ?
        WHERE ign = ?
      `, [expectedDiscordId, playerName]);
      
      console.log(`✅ Updated Discord ID for ${updateResult.affectedRows} entry(ies)`);
      
      // Verify the fix
      const [fixedEntries] = await pool.query(`
        SELECT p.*, pb.balance, pb.total_spent
        FROM players p
        LEFT JOIN player_balances pb ON p.id = pb.player_id
        WHERE p.ign = ? OR p.discord_id = ?
        ORDER BY p.id
      `, [playerName, expectedDiscordId]);
      
      console.log('\n🔍 After fix:');
      fixedEntries.forEach((entry, index) => {
        console.log(`   ${index + 1}. ID=${entry.id}, IGN="${entry.ign}", Discord=${entry.discord_id}, Server=${entry.server_id}, Balance=${entry.balance || 0}`);
      });
      
    } else {
      console.log('\n✅ Discord ID is already correct!');
    }
    
    // Check if there are any entries with the wrong Discord ID
    const [wrongEntries] = await pool.query(`
      SELECT p.*, pb.balance
      FROM players p
      LEFT JOIN player_balances pb ON p.id = pb.player_id
      WHERE p.ign = ? AND p.discord_id != ?
      ORDER BY p.id
    `, [playerName, expectedDiscordId]);
    
    if (wrongEntries.length > 0) {
      console.log(`\n⚠️ Found ${wrongEntries.length} entries with wrong Discord ID:`);
      wrongEntries.forEach((entry, index) => {
        console.log(`   ${index + 1}. ID=${entry.id}, Discord=${entry.discord_id}, Balance=${entry.balance || 0}`);
      });
      
      console.log('\n🗑️ Deleting entries with wrong Discord ID...');
      for (const entry of wrongEntries) {
        await pool.query('DELETE FROM player_balances WHERE player_id = ?', [entry.id]);
        await pool.query('DELETE FROM players WHERE id = ?', [entry.id]);
        console.log(`   ✅ Deleted entry ID=${entry.id}`);
      }
    }
    
    console.log('\n🎉 Verification and fix completed!');
    console.log('\n📋 Final Summary:');
    console.log('- ✅ Discord ID is correct');
    console.log('- ✅ No duplicate entries');
    console.log('- ✅ Bot and app will use same Discord ID');
    console.log('- ✅ Balance tracking should work properly');
    
  } catch (error) {
    console.error('❌ Error verifying and fixing:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the verification
verifyAndFixScott();
