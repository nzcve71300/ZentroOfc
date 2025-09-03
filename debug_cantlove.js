const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugCantLove() {
  console.log('🔍 Quick Debug: CantLoveNoFloozy Linking Issue');
  console.log('===============================================\n');

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
    const discordId = '262680979808845825';

    // Check 1: Search for this player name
    console.log('📋 Check 1: Searching for Player Name...\n');
    
    const [playerResults] = await connection.execute(`
      SELECT 
        p.id,
        p.ign,
        p.discord_id,
        p.server_id,
        p.guild_id,
        rs.nickname as server_name,
        g.discord_id as guild_discord_id
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE LOWER(p.ign) LIKE LOWER(?)
      ORDER BY rs.nickname, p.ign
    `, [`%${playerName}%`]);

    if (playerResults.length === 0) {
      console.log(`❌ No players found with name "${playerName}"`);
    } else {
      console.log(`Found ${playerResults.length} players with name "${playerName}":`);
      for (const player of playerResults) {
        console.log(`   - ${player.ign} on ${player.server_name} (Discord: ${player.discord_id || 'Not linked'})`);
      }
    }

    // Check 2: Search for this Discord ID
    console.log('\n📋 Check 2: Searching for Discord ID...\n');
    
    const [discordResults] = await connection.execute(`
      SELECT 
        p.id,
        p.ign,
        p.discord_id,
        p.server_id,
        p.guild_id,
        rs.nickname as server_name,
        g.discord_id as guild_discord_id
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE p.discord_id = ?
      ORDER BY rs.nickname, p.ign
    `, [discordId]);

    if (discordResults.length === 0) {
      console.log(`❌ No players found with Discord ID ${discordId}`);
    } else {
      console.log(`Found ${discordResults.length} players with Discord ID ${discordId}:`);
      for (const player of discordResults) {
        console.log(`   - ${player.ign} on ${player.server_name} (Guild: ${player.guild_id})`);
      }
    }

    // Check 3: Check if this Discord ID is already linked anywhere
    console.log('\n📋 Check 3: Checking for Any Existing Links...\n');
    
    const [existingLinks] = await connection.execute(`
      SELECT 
        p.ign,
        p.discord_id,
        rs.nickname as server_name,
        g.discord_id as guild_discord_id
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE p.discord_id = ?
      ORDER BY rs.nickname, p.ign
    `, [discordId]);

    if (existingLinks.length === 0) {
      console.log(`✅ Discord ID ${discordId} is not linked to any player`);
    } else {
      console.log(`⚠️  Discord ID ${discordId} is already linked to ${existingLinks.length} player(s):`);
      for (const link of existingLinks) {
        console.log(`   - ${link.ign} on ${link.server_name} (Guild: ${link.guild_discord_id})`);
      }
    }

    // Check 4: Test the validation function
    console.log('\n📋 Check 4: Testing Validation Function...\n');
    
    try {
      // Test with a sample guild ID from the results
      const testGuildId = playerResults.length > 0 ? playerResults[0].guild_id : 'test_guild';
      
      const [validationResult] = await connection.execute(`
        SELECT validate_player_link(?, ?) as is_valid
      `, [discordId, testGuildId]);
      
      if (validationResult.length > 0) {
        const isValid = validationResult[0].is_valid;
        console.log(`✅ Validation result: ${isValid ? 'CAN link' : 'CANNOT link'} (Discord ID: ${discordId}, Guild: ${testGuildId})`);
      }
    } catch (error) {
      console.log(`❌ Validation function error: ${error.message}`);
    }

    // Check 5: Summary and recommendations
    console.log('\n🎯 **Analysis Summary:**');
    console.log('========================');
    
    if (existingLinks.length > 0) {
      console.log('❌ **ISSUE IDENTIFIED:**');
      console.log(`   Discord ID ${discordId} is already linked to ${existingLinks.length} player(s)`);
      console.log('   This is why the linking is failing!');
      console.log('');
      console.log('🔧 **Solution:**');
      console.log('   1. Use the safe_link_player procedure to handle the conflict');
      console.log('   2. Or manually unlink the existing player first');
      console.log('   3. Then link CantLoveNoFloozy');
    } else if (playerResults.length === 0) {
      console.log('❌ **ISSUE IDENTIFIED:**');
      console.log('   Player name not found in database');
      console.log('   Player needs to join a server first to be added');
    } else {
      console.log('✅ **NO ISSUES FOUND:**');
      console.log('   Player exists and Discord ID is not linked');
      console.log('   Linking should work normally');
    }

    console.log('\n🛠️ **Quick Commands to Try:**');
    console.log('==============================');
    if (existingLinks.length > 0) {
      console.log('• Check existing links: SELECT * FROM players WHERE discord_id = 262680979808845825;');
      console.log('• Use safe linking: CALL safe_link_player(player_id, 262680979808845825, guild_id);');
      console.log('• Auto-fix duplicates: CALL auto_fix_linking_duplicates();');
    } else {
      console.log('• Link normally: The system should work without issues');
      console.log('• Validate first: SELECT validate_player_link(262680979808845825, guild_id);');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

debugCantLove();
