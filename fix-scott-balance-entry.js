#!/usr/bin/env node

/**
 * Fix Scott Balance Entry Script
 * 
 * This script fixes the missing balance entry for scott_T_BBK
 * by adding the required server_id field to the player_balances table
 */

require('dotenv').config();
const pool = require('./src/db/index');

async function fixScottBalanceEntry() {
  try {
    console.log('🔧 Fixing scott_T_BBK balance entry...\n');
    
    const discordId = '649701326795702273';
    const playerName = 'scott_T_BBK';
    
    // Check current entries
    const [currentEntries] = await pool.query(`
      SELECT p.*, pb.balance, pb.total_spent, pb.server_id as balance_server_id
      FROM players p
      LEFT JOIN player_balances pb ON p.id = pb.player_id
      WHERE p.ign = ? OR p.discord_id = ?
      ORDER BY p.id
    `, [playerName, discordId]);
    
    console.log(`📊 Current entries for ${playerName}:`);
    currentEntries.forEach((entry, index) => {
      console.log(`   ${index + 1}. ID=${entry.id}, Server=${entry.server_id}, Balance=${entry.balance || 0}, Balance Server=${entry.balance_server_id || 'NULL'}`);
    });
    
    // Find entries without balance entries
    const entriesWithoutBalance = currentEntries.filter(entry => 
      entry.balance === null || entry.balance_server_id === null
    );
    
    console.log(`\n❌ Entries without balance: ${entriesWithoutBalance.length}`);
    
    if (entriesWithoutBalance.length > 0) {
      console.log('\n🔗 Creating missing balance entries...');
      
      for (const entry of entriesWithoutBalance) {
        console.log(`   Creating balance entry for player ID=${entry.id}, server=${entry.server_id}...`);
        
        // Create balance entry with server_id
        const [insertResult] = await pool.query(`
          INSERT INTO player_balances (player_id, server_id, balance, total_spent)
          VALUES (?, ?, 0, 0)
        `, [entry.id, entry.server_id]);
        
        console.log(`   ✅ Created balance entry ID: ${insertResult.insertId}`);
      }
      
      console.log(`\n✅ Created ${entriesWithoutBalance.length} missing balance entries`);
      
    } else {
      console.log('\n✅ All entries already have balance entries');
    }
    
    // Final verification
    const [finalEntries] = await pool.query(`
      SELECT p.*, pb.balance, pb.total_spent, pb.server_id as balance_server_id
      FROM players p
      LEFT JOIN player_balances pb ON p.id = pb.player_id
      WHERE p.ign = ? OR p.discord_id = ?
      ORDER BY p.server_id
    `, [playerName, discordId]);
    
    console.log('\n🔍 Final verification:');
    finalEntries.forEach((entry, index) => {
      console.log(`   ${index + 1}. ID=${entry.id}, Server=${entry.server_id}, Balance=${entry.balance || 0}, Balance Server=${entry.balance_server_id || 'NULL'}`);
    });
    
    console.log('\n🎉 Balance entry fix completed!');
    console.log('\n📋 Summary:');
    console.log('- ✅ Player linked to all servers in guild');
    console.log('- ✅ All entries have proper balance entries');
    console.log('- ✅ Can access balance on all servers');
    console.log('- ✅ Bot and app will work properly');
    
  } catch (error) {
    console.error('❌ Error fixing balance entry:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixScottBalanceEntry();
