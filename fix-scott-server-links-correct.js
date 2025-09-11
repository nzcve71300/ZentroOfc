#!/usr/bin/env node

/**
 * Fix Scott Server Links (Correct Version)
 * 
 * This script fixes the server links for scott_T_BBK using the correct
 * rust_servers table instead of the servers table
 */

require('dotenv').config();
const pool = require('./src/db/index');

async function fixScottServerLinks() {
  try {
    console.log('🔧 Fixing scott_T_BBK server links (correct version)...\n');
    
    const discordId = '649701326795702273';
    const playerName = 'scott_T_BBK';
    const guildId = '609'; // DeadOps guild ID
    
    // Check current entries
    const [currentEntries] = await pool.query(`
      SELECT p.*, pb.balance, pb.total_spent
      FROM players p
      LEFT JOIN player_balances pb ON p.id = pb.player_id
      WHERE p.ign = ? OR p.discord_id = ?
      ORDER BY p.id
    `, [playerName, discordId]);
    
    console.log(`📊 Current entries for ${playerName}:`);
    currentEntries.forEach((entry, index) => {
      console.log(`   ${index + 1}. ID=${entry.id}, Server=${entry.server_id}, Balance=${entry.balance || 0}`);
    });
    
    // Get all rust servers in the DeadOps guild
    const [guildRustServers] = await pool.query(`
      SELECT id, nickname, guild_id
      FROM rust_servers 
      WHERE guild_id = ?
      ORDER BY nickname
    `, [guildId]);
    
    console.log(`\n🏰 Rust servers in guild ${guildId}:`);
    guildRustServers.forEach((server, index) => {
      console.log(`   ${index + 1}. ID=${server.id}, Name="${server.nickname}"`);
    });
    
    // Check which servers the player is missing
    const linkedServerIds = currentEntries.map(entry => entry.server_id);
    const missingServers = guildRustServers.filter(server => 
      !linkedServerIds.includes(server.id)
    );
    
    console.log(`\n❌ Missing server links: ${missingServers.length}`);
    missingServers.forEach((server, index) => {
      console.log(`   ${index + 1}. ${server.nickname} (ID: ${server.id})`);
    });
    
    if (missingServers.length > 0) {
      console.log('\n🔗 Creating missing server links...');
      
      for (const server of missingServers) {
        console.log(`   Creating entry for ${server.nickname}...`);
        
        // Create player entry using rust_servers.id
        const [insertResult] = await pool.query(`
          INSERT INTO players (server_id, discord_id, ign, guild_id, is_active)
          VALUES (?, ?, ?, ?, true)
        `, [server.id, discordId, playerName, guildId]);
        
        const newPlayerId = insertResult.insertId;
        console.log(`   ✅ Created player entry ID: ${newPlayerId}`);
        
        // Create balance entry
        await pool.query(`
          INSERT INTO player_balances (player_id, balance, total_spent)
          VALUES (?, 0, 0)
        `, [newPlayerId]);
        
        console.log(`   ✅ Created balance entry`);
      }
      
      console.log(`\n✅ Restored ${missingServers.length} missing server links`);
      
    } else {
      console.log('\n✅ Player is already linked to all servers in the guild');
    }
    
    // Final verification
    const [finalEntries] = await pool.query(`
      SELECT p.*, pb.balance, pb.total_spent
      FROM players p
      LEFT JOIN player_balances pb ON p.id = pb.player_id
      WHERE p.ign = ? OR p.discord_id = ?
      ORDER BY p.server_id
    `, [playerName, discordId]);
    
    console.log('\n🔍 Final verification:');
    finalEntries.forEach((entry, index) => {
      console.log(`   ${index + 1}. ID=${entry.id}, Server=${entry.server_id}, Balance=${entry.balance || 0}`);
    });
    
    console.log('\n🎉 Server link restoration completed!');
    console.log('\n📋 Summary:');
    console.log('- ✅ Player linked to all rust servers in guild');
    console.log('- ✅ Can access balance on all servers');
    console.log('- ✅ Bot and app will work properly');
    
  } catch (error) {
    console.error('❌ Error restoring server link:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the restoration
fixScottServerLinks();
