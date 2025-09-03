const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugDiscordIdMismatch() {
  console.log('🔍 Investigating Discord ID Mismatch in Linking System');
  console.log('=====================================================\n');

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

    // Step 1: Check the specific Discord ID mentioned in the error
    console.log('📋 Step 1: Checking Discord ID 716032072314055914...\n');
    
    const suspiciousDiscordId = '716032072314055914';
    
    const [suspiciousPlayer] = await connection.execute(`
      SELECT 
        p.id,
        p.ign,
        p.discord_id,
        p.server_id,
        rs.nickname as server_name,
        g.discord_id as guild_discord_id
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE p.discord_id = ?
      ORDER BY rs.nickname, p.ign
    `, [suspiciousDiscordId]);

    if (suspiciousPlayer.length === 0) {
      console.log(`❌ Discord ID ${suspiciousDiscordId} does NOT exist in the database!`);
      console.log('   This confirms the mismatch issue!');
    } else {
      console.log(`Found ${suspiciousPlayer.length} players with Discord ID ${suspiciousDiscordId}:`);
      for (const player of suspiciousPlayer) {
        console.log(`   - ${player.ign} on ${player.server_name}`);
      }
    }

    // Step 2: Check the correct Discord ID (sassie0412)
    console.log('\n📋 Step 2: Checking Discord ID 820981833718038589 (sassie0412)...\n');
    
    const correctDiscordId = '820981833718038589';
    
    const [correctPlayer] = await connection.execute(`
      SELECT 
        p.id,
        p.ign,
        p.discord_id,
        p.server_id,
        rs.nickname as server_name,
        g.discord_id as guild_discord_id
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE p.discord_id = ?
      ORDER BY rs.nickname, p.ign
    `, [correctDiscordId]);

    if (correctPlayer.length === 0) {
      console.log(`❌ Discord ID ${correctDiscordId} not found in database!`);
    } else {
      console.log(`Found ${correctPlayer.length} players with Discord ID ${correctDiscordId}:`);
      for (const player of correctPlayer) {
        console.log(`   - ${player.ign} on ${player.server_name}`);
      }
    }

    // Step 3: Check for "De_Donzels" player name
    console.log('\n📋 Step 3: Searching for "De_Donzels" player...\n');
    
    const playerName = 'De_Donzels';
    
    const [deDonzelsPlayers] = await connection.execute(`
      SELECT 
        p.id,
        p.ign,
        p.discord_id,
        p.server_id,
        rs.nickname as server_name,
        g.discord_id as guild_discord_id
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE LOWER(p.ign) = LOWER(?)
      ORDER BY rs.nickname, p.ign
    `, [playerName]);

    if (deDonzelsPlayers.length === 0) {
      console.log(`❌ No player found with name "${playerName}"`);
    } else {
      console.log(`Found ${deDonzelsPlayers.length} players with name "${playerName}":`);
      for (const player of deDonzelsPlayers) {
        console.log(`   - ${player.ign} on ${player.server_name} (Discord: ${player.discord_id || 'Not linked'})`);
      }
    }

    // Step 4: Check for orphaned or duplicate Discord IDs
    console.log('\n📋 Step 4: Checking for Orphaned/Duplicate Discord IDs...\n');
    
    const [orphanedDiscordIds] = await connection.execute(`
      SELECT 
        discord_id,
        COUNT(*) as count,
        GROUP_CONCAT(ign SEPARATOR ', ') as player_names,
        GROUP_CONCAT(server_id SEPARATOR ', ') as server_ids
      FROM players 
      WHERE discord_id IS NOT NULL
      GROUP BY discord_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);

    if (orphanedDiscordIds.length === 0) {
      console.log('✅ No duplicate Discord IDs found');
    } else {
      console.log(`Found ${orphanedDiscordIds.length} Discord IDs with multiple players:`);
      for (const orphan of orphanedDiscordIds) {
        console.log(`   - Discord ID: ${orphan.discord_id} (${orphan.count} players)`);
        console.log(`     Players: ${orphan.player_names}`);
        console.log(`     Servers: ${orphan.server_ids}`);
      }
    }

    // Step 5: Check for players with same name across servers
    console.log('\n📋 Step 5: Checking for Players with Same Name Across Servers...\n');
    
    const [duplicateNames] = await connection.execute(`
      SELECT 
        ign,
        COUNT(*) as count,
        GROUP_CONCAT(DISTINCT discord_id SEPARATOR ', ') as discord_ids,
        GROUP_CONCAT(DISTINCT server_id SEPARATOR ', ') as server_ids
      FROM players 
      WHERE ign IS NOT NULL
      GROUP BY ign
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 10
    `);

    if (duplicateNames.length === 0) {
      console.log('✅ No duplicate player names found');
    } else {
      console.log(`Found ${duplicateNames.length} player names with multiple records:`);
      for (const duplicate of duplicateNames) {
        console.log(`   - Name: ${duplicate.ign} (${duplicate.count} records)`);
        console.log(`     Discord IDs: ${duplicate.discord_ids || 'None'}`);
        console.log(`     Server IDs: ${duplicate.server_ids}`);
      }
    }

    // Step 6: Check the linking logic in the database
    console.log('\n📋 Step 6: Analyzing Linking Logic Issues...\n');
    
    // Look for players that might be causing the "already linked" issue
    const [linkingIssues] = await connection.execute(`
      SELECT 
        p1.ign as player1_name,
        p1.discord_id as player1_discord,
        p1.server_id as player1_server,
        rs1.nickname as player1_server_name,
        p2.ign as player2_name,
        p2.discord_id as player2_discord,
        p2.server_id as player2_server,
        rs2.nickname as player2_server_name
      FROM players p1
      JOIN players p2 ON p1.ign = p2.ign AND p1.id != p2.id
      JOIN rust_servers rs1 ON p1.server_id = rs1.id
      JOIN rust_servers rs2 ON p2.server_id = rs2.id
      WHERE p1.discord_id IS NOT NULL 
        AND p2.discord_id IS NOT NULL
        AND p1.discord_id != p2.discord_id
      ORDER BY p1.ign
    `);

    if (linkingIssues.length === 0) {
      console.log('✅ No conflicting Discord ID links found');
    } else {
      console.log(`Found ${linkingIssues.length} potential linking conflicts:`);
      for (const conflict of linkingIssues) {
        console.log(`   - Player: ${conflict.player1_name}`);
        console.log(`     Server 1: ${conflict.player1_server_name} (Discord: ${conflict.player1_discord})`);
        console.log(`     Server 2: ${conflict.player2_server_name} (Discord: ${conflict.player2_discord})`);
      }
    }

    // Step 7: Recommendations
    console.log('\n🎯 **Root Cause Analysis:**');
    console.log('==========================');
    
    if (suspiciousPlayer.length === 0) {
      console.log('1. ❌ Discord ID 716032072314055914 does not exist in database');
      console.log('2. 🔍 The bot is referencing a non-existent Discord ID');
      console.log('3. 🐛 This suggests a bug in the linking logic');
      console.log('4. 📝 The bot thinks someone is linked when they are not');
    }

    console.log('\n🔧 **Immediate Fixes Needed:**');
    console.log('1. Clean up any orphaned player records');
    console.log('2. Fix the linking logic to check Discord ID validity');
    console.log('3. Ensure player names are unique per Discord ID per guild');
    console.log('4. Add validation to prevent linking to non-existent Discord IDs');

    console.log('\n🚀 **Next Steps:**');
    console.log('1. Run cleanup script to remove orphaned records');
    console.log('2. Test linking system with known good Discord IDs');
    console.log('3. Monitor for similar "already linked" errors');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

debugDiscordIdMismatch();
