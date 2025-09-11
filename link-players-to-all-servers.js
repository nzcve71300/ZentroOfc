#!/usr/bin/env node

/**
 * Link Players to All Servers Script
 * 
 * This script ensures that players are properly linked to ALL servers
 * in their guild, not just one server. This fixes the issue where
 * players were only linked to one server instead of all servers in the guild.
 */

require('dotenv').config();
const pool = require('./src/db/index');

const playersToLink = [
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

async function linkPlayersToAllServers() {
  try {
    console.log('🔍 Starting player-to-all-servers linking process...\n');
    
    // First, get all guilds and their servers
    const [guilds] = await pool.query(`
      SELECT DISTINCT guild_id 
      FROM rust_servers 
      ORDER BY guild_id
    `);
    
    console.log(`📊 Found ${guilds.length} guilds with servers`);
    
    for (const guild of guilds) {
      console.log(`\n🏰 Processing Guild: ${guild.guild_id}`);
      
      // Get all servers for this guild
      const [servers] = await pool.query(`
        SELECT id, nickname, guild_id 
        FROM rust_servers 
        WHERE guild_id = ?
        ORDER BY nickname
      `, [guild.guild_id]);
      
      console.log(`   📋 Found ${servers.length} servers:`, servers.map(s => s.nickname).join(', '));
      
      if (servers.length < 2) {
        console.log(`   ⚠️ Guild has only ${servers.length} server(s), skipping`);
        continue;
      }
      
      // Process each player
      for (const player of playersToLink) {
        console.log(`\n   👤 Processing: ${player.name} (Discord: ${player.discord_id})`);
        
        // Check if player exists in this guild
        const [existingPlayers] = await pool.query(`
          SELECT p.*, pb.balance, pb.total_spent
          FROM players p
          LEFT JOIN player_balances pb ON p.id = pb.player_id
          WHERE p.discord_id = ? OR p.ign = ?
          AND p.server_id IN (${servers.map(() => '?').join(',')})
        `, [player.discord_id, player.name, ...servers.map(s => s.id)]);
        
        console.log(`      Found ${existingPlayers.length} existing entries in this guild`);
        
        if (existingPlayers.length === 0) {
          console.log(`      ⚠️ Player not found in this guild, skipping`);
          continue;
        }
        
        // Find which servers the player is already linked to
        const linkedServerIds = existingPlayers.map(p => p.server_id);
        const missingServers = servers.filter(s => !linkedServerIds.includes(s.id));
        
        console.log(`      🔗 Already linked to: ${linkedServerIds.length} servers`);
        console.log(`      ❌ Missing links to: ${missingServers.length} servers`);
        
        if (missingServers.length === 0) {
          console.log(`      ✅ Player already linked to all servers in guild`);
          continue;
        }
        
        // Use the first existing player entry as the template
        const templatePlayer = existingPlayers[0];
        
        // Create missing player entries for other servers
        for (const missingServer of missingServers) {
          console.log(`      ➕ Creating entry for server: ${missingServer.nickname}`);
          
          // Insert new player entry
          const [insertResult] = await pool.query(`
            INSERT INTO players (server_id, discord_id, ign, is_active)
            VALUES (?, ?, ?, ?)
          `, [
            missingServer.id,
            player.discord_id,
            player.name,
            true
          ]);
          
          const newPlayerId = insertResult.insertId;
          console.log(`         ✅ Created player entry ID: ${newPlayerId}`);
          
          // Create player balance entry if template has one
          if (templatePlayer.balance !== null) {
            await pool.query(`
              INSERT INTO player_balances (player_id, server_id, balance, total_spent, last_transaction_at)
              VALUES (?, ?, ?, ?, ?)
            `, [
              newPlayerId,
              missingServer.id,
              templatePlayer.balance || 0,
              templatePlayer.total_spent || 0,
              templatePlayer.last_transaction_at || null
            ]);
            
            console.log(`         💰 Created balance entry: ${templatePlayer.balance || 0} coins`);
          }
        }
      }
    }
    
    console.log('\n🎉 Player-to-all-servers linking completed!');
    console.log('\n📋 Summary:');
    console.log('- Linked players to all servers in their respective guilds');
    console.log('- Preserved existing balances and data');
    console.log('- Each player now has entries for all servers in their guild');
    
    console.log('\n✅ Players should now be able to:');
    console.log('💰 See their coins on ALL servers in the guild');
    console.log('🎮 Play on any server and maintain their balance');
    console.log('🔄 Switch between servers seamlessly');
    
  } catch (error) {
    console.error('❌ Error linking players to all servers:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the linking process
linkPlayersToAllServers();
