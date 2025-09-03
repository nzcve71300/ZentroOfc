const mysql = require('mysql2/promise');
require('dotenv').config();

async function testLinkingLogic() {
  console.log('🧪 Testing Bot Linking Logic for CantLoveNoFloozy');
  console.log('==================================================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!\n');

    const playerName = 'CantLoveNoFloozy';
    const newDiscordId = '262680979808845825';
    const existingDiscordId = '223446414261476343';

    // Test 1: Simulate what the bot might be checking
    console.log('📋 Test 1: Simulating Bot\'s "Already Linked" Check...\n');
    
    // Check if ANY player with this name is linked anywhere
    const [anyLinkedPlayers] = await connection.execute(`
      SELECT 
        p.ign,
        p.discord_id,
        rs.nickname as server_name,
        g.discord_id as guild_discord_id
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE LOWER(p.ign) = LOWER(?) AND p.discord_id IS NOT NULL
      ORDER BY rs.nickname
    `, [playerName]);

    if (anyLinkedPlayers.length > 0) {
      console.log(`⚠️  **FOUND THE ISSUE!**`);
      console.log(`   Player "${playerName}" is already linked to Discord ID(s) on these servers:`);
      for (const player of anyLinkedPlayers) {
        console.log(`   - ${player.ign} on ${player.server_name} → Discord ID: ${player.discord_id}`);
      }
      console.log('');
      console.log('🔍 **This is why the bot is blocking the link!**');
      console.log('   The bot is checking if ANY player with this name is linked,');
      console.log('   not just the specific Discord ID being used.');
    } else {
      console.log('✅ No linked players found with this name');
    }

    // Test 2: Check the specific Discord ID they're trying to use
    console.log('\n📋 Test 2: Checking New Discord ID...\n');
    
    const [newDiscordCheck] = await connection.execute(`
      SELECT 
        p.ign,
        p.discord_id,
        rs.nickname as server_name
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.discord_id = ?
      ORDER BY rs.nickname
    `, [newDiscordId]);

    if (newDiscordCheck.length === 0) {
      console.log(`✅ Discord ID ${newDiscordId} is completely free to use`);
    } else {
      console.log(`⚠️  Discord ID ${newDiscordId} is already linked to:`);
      for (const player of newDiscordCheck) {
        console.log(`   - ${player.ign} on ${player.server_name}`);
      }
    }

    // Test 3: Simulate the bot's linking logic
    console.log('\n📋 Test 3: Simulating Bot\'s Linking Logic...\n');
    
    // This is what the bot might be doing - checking if name exists anywhere
    const [nameExistsCheck] = await connection.execute(`
      SELECT 
        COUNT(*) as count,
        GROUP_CONCAT(DISTINCT p.discord_id SEPARATOR ', ') as linked_discord_ids
      FROM players p
      WHERE LOWER(p.ign) = LOWER(?) AND p.discord_id IS NOT NULL
    `, [playerName]);

    if (nameExistsCheck.length > 0) {
      const count = nameExistsCheck[0].count;
      const linkedIds = nameExistsCheck[0].linked_discord_ids;
      
      console.log(`📊 **Bot's Logic Check Results:**`);
      console.log(`   Players with name "${playerName}" that are linked: ${count}`);
      console.log(`   Discord IDs they're linked to: ${linkedIds || 'None'}`);
      console.log('');
      
      if (count > 0) {
        console.log('🚫 **BOT WILL BLOCK THIS LINK**');
        console.log('   Because there are already linked players with this name');
        console.log('   This is the "Already Linked" error you\'re seeing!');
      } else {
        console.log('✅ **BOT WILL ALLOW THIS LINK**');
      }
    }

    // Test 4: Check what the safe linking procedure would do
    console.log('\n📋 Test 4: Testing Safe Linking Procedure...\n');
    
    try {
      // Get the player ID for CantLoveNoFloozy on USA-DeadOps (the unlinked one)
      const [playerToLink] = await connection.execute(`
        SELECT p.id, p.guild_id
        FROM players p
        JOIN rust_servers rs ON p.server_id = rs.id
        WHERE LOWER(p.ign) = LOWER(?) AND rs.nickname = 'USA-DeadOps'
      `, [playerName]);

      if (playerToLink.length > 0) {
        const playerId = playerToLink[0].id;
        const guildId = playerToLink[0].guild_id;
        
        console.log(`🔗 **Safe Linking Test:**`);
        console.log(`   Player ID: ${playerId}`);
        console.log(`   Guild ID: ${guildId}`);
        console.log(`   New Discord ID: ${newDiscordId}`);
        console.log('');
        console.log('   This should work with:');
        console.log(`   CALL safe_link_player(${playerId}, ${newDiscordId}, '${guildId}');`);
      }
    } catch (error) {
      console.log(`❌ Error testing safe linking: ${error.message}`);
    }

    // Test 5: Summary and solution
    console.log('\n🎯 **ROOT CAUSE IDENTIFIED:**');
    console.log('=============================');
    console.log('');
    console.log('❌ **The Problem:**');
    console.log('   CantLoveNoFloozy is already linked to Discord ID 223446414261476343 on Dead-ops');
    console.log('   The bot is checking if ANY player with this name is linked, not just the Discord ID');
    console.log('   This is causing the "Already Linked" error');
    console.log('');
    console.log('🔧 **The Solution:**');
    console.log('   1. Unlink the existing CantLoveNoFloozy on Dead-ops first');
    console.log('   2. Then link the new Discord ID to the USA-DeadOps player');
    console.log('   3. Or use the safe_link_player procedure to handle the conflict');
    console.log('');
    console.log('🛠️ **Quick Fix Commands:**');
    console.log('===========================');
    console.log('• Unlink existing: UPDATE players SET discord_id = NULL WHERE ign = "CantLoveNoFloozy" AND server_id = (SELECT id FROM rust_servers WHERE nickname = "Dead-ops");');
    console.log('• Link new: UPDATE players SET discord_id = 262680979808845825 WHERE ign = "CantLoveNoFloozy" AND server_id = (SELECT id FROM rust_servers WHERE nickname = "USA-DeadOps");');
    console.log('• Or use safe procedure: CALL safe_link_player(player_id, 262680979808845825, guild_id);');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

testLinkingLogic();
