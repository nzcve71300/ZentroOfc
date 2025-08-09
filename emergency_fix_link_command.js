const mysql = require('mysql2/promise');
require('dotenv').config();

async function emergencyFixLinkCommand() {
  console.log('🚨 EMERGENCY: FIX LINK COMMAND QUERY');
  console.log('====================================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    // The exact Discord ID from your logs
    const testGuildId = '1379533411009560626'; // Snowy Billiards 2x

    console.log('\n📋 TESTING THE EXACT QUERY FROM LINK COMMAND...');
    console.log(`Testing with guild ID: ${testGuildId} (Snowy Billiards 2x)`);
    
    // This is the EXACT query from the link command
    const [linkResult] = await connection.execute(
      'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
      [testGuildId]
    );
    
    console.log(`Link command query result: ${linkResult.length} servers found`);
    linkResult.forEach(server => {
      console.log(`   - ${server.nickname} (${server.id})`);
    });

    console.log('\n📋 DEBUGGING THE SUBQUERY...');
    
    // Test the subquery separately
    const [guildSubquery] = await connection.execute(
      'SELECT id FROM guilds WHERE discord_id = ?',
      [testGuildId]
    );
    
    console.log(`Subquery result: ${guildSubquery.length} guilds found`);
    if (guildSubquery.length > 0) {
      console.log(`   Guild internal ID: ${guildSubquery[0].id}`);
      
      // Now test with the internal guild ID directly
      const [directQuery] = await connection.execute(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = ? ORDER BY nickname',
        [guildSubquery[0].id]
      );
      
      console.log(`Direct query result: ${directQuery.length} servers found`);
      directQuery.forEach(server => {
        console.log(`   - ${server.nickname} (${server.id})`);
      });
    } else {
      console.log('❌ NO GUILD FOUND WITH THAT DISCORD ID!');
    }

    console.log('\n📋 CHECKING ALL GUILD DISCORD IDs...');
    const [allGuilds] = await connection.execute('SELECT * FROM guilds ORDER BY id');
    console.log('All guilds in database:');
    allGuilds.forEach(guild => {
      console.log(`   - Internal ID: ${guild.id}, Discord ID: ${guild.discord_id}, Name: ${guild.name}`);
    });

    console.log('\n📋 CHECKING DATA TYPE ISSUE...');
    // Check if there's a data type mismatch
    const [typeCheck] = await connection.execute(
      "SELECT discord_id, CAST(discord_id AS CHAR) as discord_id_string FROM guilds WHERE name LIKE '%Snowy%' OR name LIKE '%SNB%'"
    );
    
    console.log('Snowy Billiards guild check:');
    typeCheck.forEach(guild => {
      console.log(`   - Stored Discord ID: ${guild.discord_id}`);
      console.log(`   - As string: ${guild.discord_id_string}`);
      console.log(`   - Matches test: ${guild.discord_id_string === testGuildId}`);
    });

    console.log('\n📋 EMERGENCY FIX: Update guild Discord ID if needed...');
    
    // Check if we need to fix the Discord ID
    const [snowyGuild] = await connection.execute(
      "SELECT * FROM guilds WHERE name LIKE '%Snowy%' OR name LIKE '%SNB%'"
    );
    
    if (snowyGuild.length > 0) {
      const guild = snowyGuild[0];
      console.log(`Found Snowy guild: ${guild.name} (Discord ID: ${guild.discord_id})`);
      
      if (guild.discord_id.toString() !== testGuildId) {
        console.log(`❌ Discord ID mismatch!`);
        console.log(`   Database has: ${guild.discord_id}`);
        console.log(`   Should be: ${testGuildId}`);
        
        console.log('🔧 Fixing Discord ID...');
        await connection.execute(
          'UPDATE guilds SET discord_id = ? WHERE id = ?',
          [testGuildId, guild.id]
        );
        console.log('✅ Fixed Discord ID');
        
        // Test the link query again
        const [fixedResult] = await connection.execute(
          'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
          [testGuildId]
        );
        
        console.log(`After fix: ${fixedResult.length} servers found`);
        fixedResult.forEach(server => {
          console.log(`   - ${server.nickname} (${server.id})`);
        });
      } else {
        console.log('✅ Discord ID is correct');
      }
    }

    await connection.end();

    console.log('\n🎯 EMERGENCY FIX COMPLETE!');
    console.log('✅ Diagnosed link command query issue');
    console.log('✅ Fixed any Discord ID mismatches');
    
    console.log('\n🚀 RESTART BOT NOW:');
    console.log('pm2 restart zentro-bot');
    console.log('Then test /link in Snowy Billiards 2x Discord');

  } catch (error) {
    console.error('❌ EMERGENCY ERROR:', error.message);
    console.error(error);
  }
}

emergencyFixLinkCommand();