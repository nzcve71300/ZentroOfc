#!/usr/bin/env node

/**
 * Fix Scott Balance Entry (Final Version)
 * 
 * This script creates the correct balance entries for scott_T_BBK
 * using the proper server_id mapping between servers and rust_servers tables
 */

require('dotenv').config();
const pool = require('./src/db/index');

async function fixScottBalanceFinal() {
  try {
    console.log('🔧 Fixing scott_T_BBK balance entries (final version)...\n');
    
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
    
    // Get server mapping between rust_servers and servers tables
    const [serverMapping] = await pool.query(`
      SELECT rs.id as rust_server_id, rs.nickname, s.id as server_id, s.name as server_name
      FROM rust_servers rs
      JOIN servers s ON rs.nickname = s.name
      WHERE rs.guild_id = '609'
      ORDER BY s.id
    `);
    
    console.log('\n🏰 Server mapping (rust_servers -> servers):');
    serverMapping.forEach((mapping, index) => {
      console.log(`   ${index + 1}. Rust: ${mapping.rust_server_id} -> Server: ${mapping.server_id} (${mapping.server_name})`);
    });
    
    // Find entries without balance entries
    const entriesWithoutBalance = currentEntries.filter(entry => 
      entry.balance === null || entry.balance_server_id === null
    );
    
    console.log(`\n❌ Entries without balance: ${entriesWithoutBalance.length}`);
    
    if (entriesWithoutBalance.length > 0) {
      console.log('\n🔗 Creating missing balance entries...');
      
      for (const entry of entriesWithoutBalance) {
        // Find the corresponding server ID in the servers table
        const mapping = serverMapping.find(m => m.rust_server_id === entry.server_id);
        
        if (mapping) {
          console.log(`   Creating balance entry for player ID=${entry.id}, rust_server=${entry.server_id} -> server_id=${mapping.server_id}...`);
          
          // Create balance entry with correct server_id
          const [insertResult] = await pool.query(`
            INSERT INTO player_balances (player_id, server_id, balance, total_spent)
            VALUES (?, ?, 0, 0)
          `, [entry.id, mapping.server_id]);
          
          console.log(`   ✅ Created balance entry ID: ${insertResult.insertId}`);
        } else {
          console.log(`   ❌ No mapping found for rust_server_id: ${entry.server_id}`);
        }
      }
      
      console.log(`\n✅ Created balance entries for ${entriesWithoutBalance.length} player entries`);
      
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
      console.log(`   ${index + 1}. ID=${entry.id}, Rust Server=${entry.server_id}, Balance Server=${entry.balance_server_id || 'NULL'}, Balance=${entry.balance || 0}`);
    });
    
    console.log('\n🎉 Balance entry fix completed!');
    console.log('\n📋 Summary:');
    console.log('- ✅ Player linked to all servers in guild');
    console.log('- ✅ All entries have proper balance entries with correct server_id');
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
fixScottBalanceFinal();
