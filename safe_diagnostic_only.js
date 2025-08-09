const mysql = require('mysql2/promise');
require('dotenv').config();

async function safeDiagnosticOnly() {
  console.log('🔍 SAFE DIAGNOSTIC - READ ONLY');
  console.log('===============================\n');
  console.log('⚠️ THIS SCRIPT MAKES NO CHANGES - ONLY READS DATA');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 READING CURRENT STATE - NO CHANGES MADE...');
    
    // Get the Discord ID that's failing (from your logs)
    const failingGuildId = '1379533411009560626'; // Snowy Billiards 2x
    
    console.log(`Testing Discord ID: ${failingGuildId} (Snowy Billiards 2x)`);

    // Test the exact failing query
    console.log('\n1. Testing the EXACT link command query:');
    const [linkQuery] = await connection.execute(
      'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
      [failingGuildId]
    );
    
    console.log(`   Result: ${linkQuery.length} servers found`);
    if (linkQuery.length === 0) {
      console.log('   ❌ THIS IS WHY /LINK FAILS');
    } else {
      console.log('   ✅ This should work');
      linkQuery.forEach(server => console.log(`      - ${server.nickname}`));
    }

    // Check the subquery
    console.log('\n2. Testing the subquery (finding guild):');
    const [guildQuery] = await connection.execute(
      'SELECT id, name, discord_id FROM guilds WHERE discord_id = ?',
      [failingGuildId]
    );
    
    console.log(`   Result: ${guildQuery.length} guilds found`);
    if (guildQuery.length === 0) {
      console.log('   ❌ NO GUILD FOUND - This is the problem!');
    } else {
      console.log(`   ✅ Guild found: ${guildQuery[0].name} (Internal ID: ${guildQuery[0].id})`);
    }

    // Show all guilds
    console.log('\n3. All guilds in database:');
    const [allGuilds] = await connection.execute('SELECT id, name, discord_id FROM guilds ORDER BY name');
    allGuilds.forEach(guild => {
      const isMatch = guild.discord_id.toString() === failingGuildId;
      const marker = isMatch ? ' ← MATCH' : '';
      console.log(`   - ${guild.name}: Discord ID ${guild.discord_id}${marker}`);
    });

    // Show all servers
    console.log('\n4. All servers in database:');
    const [allServers] = await connection.execute(`
      SELECT rs.id, rs.nickname, rs.guild_id, g.name as guild_name, g.discord_id 
      FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id 
      ORDER BY g.name, rs.nickname
    `);
    allServers.forEach(server => {
      console.log(`   - ${server.nickname} → Guild: ${server.guild_name} (Discord: ${server.discord_id})`);
    });

    await connection.end();

    console.log('\n🎯 DIAGNOSIS COMPLETE - NO CHANGES MADE');
    console.log('\nPROBLEM SUMMARY:');
    
    if (guildQuery.length === 0) {
      console.log('❌ The guild Discord ID in the database doesn\'t match what Discord is sending');
      console.log('❌ This is why /link says "no servers found"');
      console.log('\nSOLUTION:');
      console.log('• Need to update the Discord ID in the guilds table');
      console.log('• OR check if you\'re testing in the wrong Discord server');
    } else if (linkQuery.length === 0) {
      console.log('❌ Guild found but no servers linked to it');
    } else {
      console.log('✅ Everything looks correct - might be a different issue');
    }

    console.log('\n📝 NEXT STEPS:');
    console.log('1. Review the diagnosis above');
    console.log('2. If you want me to fix it, I can create a targeted fix');
    console.log('3. Or you can tell me to stop if you want to handle it differently');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

safeDiagnosticOnly();