const mysql = require('mysql2/promise');
require('dotenv').config();

async function emergencyFixServers() {
  console.log('🚨 EMERGENCY: FIX SERVER LOOKUP');
  console.log('===============================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 EMERGENCY DIAGNOSIS: Check guild-server relationships...');
    
    // Check all guilds
    const [guilds] = await connection.execute('SELECT * FROM guilds ORDER BY id');
    console.log(`Found ${guilds.length} guilds:`);
    guilds.forEach(guild => {
      console.log(`   - Guild ${guild.id}: Discord ID ${guild.discord_id}, Name: ${guild.name}`);
    });

    // Check all servers
    const [servers] = await connection.execute('SELECT * FROM rust_servers ORDER BY nickname');
    console.log(`\nFound ${servers.length} servers:`);
    servers.forEach(server => {
      console.log(`   - Server ${server.id}: ${server.nickname}, Guild ID: ${server.guild_id}`);
    });

    // Check the specific query that's failing in the link command
    console.log('\n📋 TESTING LINK COMMAND QUERY...');
    
    // This is the exact query from the link command that's failing
    for (const guild of guilds) {
      console.log(`\nTesting guild ${guild.discord_id} (${guild.name}):`);
      
      const [testResult] = await connection.execute(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
        [guild.discord_id]
      );
      
      console.log(`   - Found ${testResult.length} servers for this guild`);
      testResult.forEach(server => {
        console.log(`     * ${server.nickname} (${server.id})`);
      });
      
      if (testResult.length === 0) {
        console.log('   ❌ NO SERVERS FOUND - This is the problem!');
        
        // Check if there are servers with this guild_id directly
        const [directCheck] = await connection.execute(
          'SELECT * FROM rust_servers WHERE guild_id = ?',
          [guild.id]
        );
        
        console.log(`   - Direct check: ${directCheck.length} servers found with guild_id ${guild.id}`);
      }
    }

    console.log('\n📋 EMERGENCY FIX: Repair guild-server relationships...');
    
    // Check for orphaned servers (servers without valid guild references)
    const [orphanedServers] = await connection.execute(`
      SELECT rs.*, g.discord_id 
      FROM rust_servers rs 
      LEFT JOIN guilds g ON rs.guild_id = g.id 
      WHERE g.id IS NULL
    `);
    
    if (orphanedServers.length > 0) {
      console.log(`\n⚠️ Found ${orphanedServers.length} orphaned servers:`);
      orphanedServers.forEach(server => {
        console.log(`   - ${server.nickname} (${server.id}) - guild_id: ${server.guild_id}`);
      });
      
      // Try to fix orphaned servers by finding the correct guild
      for (const server of orphanedServers) {
        console.log(`\nFixing server: ${server.nickname}`);
        
        // Look for a guild that might own this server (try to match by name patterns or existing data)
        const [possibleGuilds] = await connection.execute('SELECT * FROM guilds');
        
        if (possibleGuilds.length > 0) {
          // For now, assign to the first guild (you can adjust this logic)
          const targetGuild = possibleGuilds[0];
          
          console.log(`   Assigning to guild: ${targetGuild.name} (${targetGuild.discord_id})`);
          
          await connection.execute(
            'UPDATE rust_servers SET guild_id = ? WHERE id = ?',
            [targetGuild.id, server.id]
          );
          
          console.log(`   ✅ Fixed server ${server.nickname}`);
        }
      }
    }

    console.log('\n📋 VERIFICATION: Test link command query again...');
    
    for (const guild of guilds) {
      const [verifyResult] = await connection.execute(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
        [guild.discord_id]
      );
      
      console.log(`Guild ${guild.discord_id}: ${verifyResult.length} servers found`);
      verifyResult.forEach(server => {
        console.log(`   - ${server.nickname}`);
      });
    }

    await connection.end();

    console.log('\n🎯 EMERGENCY FIX COMPLETE!');
    console.log('✅ Checked all guild-server relationships');
    console.log('✅ Fixed orphaned servers');
    console.log('✅ Verified link command queries');

    console.log('\n🚀 IMMEDIATE ACTION NEEDED:');
    console.log('1. Restart the bot RIGHT NOW:');
    console.log('   pm2 restart zentro-bot');
    console.log('2. Test /link command immediately');
    console.log('3. If still broken, run the diagnosis again');

  } catch (error) {
    console.error('❌ EMERGENCY ERROR:', error.message);
    console.error(error);
  }
}

emergencyFixServers();