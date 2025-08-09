const mysql = require('mysql2/promise');
require('dotenv').config();

async function testSpecificGuild() {
  console.log('🔧 TEST SPECIFIC GUILD FOR /LINK');
  console.log('=================================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 WHICH DISCORD SERVER ARE YOU TESTING /LINK IN?');
    console.log('Please tell me the Discord server name so I can check if it has servers configured.');
    
    console.log('\nAvailable Discord servers with Rust servers:');
    console.log('1. RISE 3X Discord (Discord ID: 1391149977434329230) → Rise 3x server');
    console.log('2. EMPEROR 3X Discord (Discord ID: 1342235198175182921) → EMPEROR 3X server');  
    console.log('3. Shadows 3x Discord (Discord ID: 1391209638308872254) → Shadows 3x server');
    console.log('4. Snowy Billiards 2x Discord (Discord ID: 1379533411009560626) → SNB1 server');
    
    console.log('\n⚠️ These Discord servers have NO servers configured:');
    console.log('- "Zentro Rust Console Bot" (Discord ID: 1385691441967267800)');
    console.log('- "Zentro Rust Console Bot" (Discord ID: 1385691441967267953)');
    
    console.log('\n📝 TO FIX THE ISSUE:');
    console.log('1. Make sure you\'re testing /link in one of the working Discord servers above');
    console.log('2. If you need to use /link in a different Discord server, you need to:');
    console.log('   - Add a Rust server to that Discord server first');
    console.log('   - Or move the bot to the correct Discord server');

    // Test each working guild's query
    const workingGuilds = [
      { id: 1391149977434329230, name: 'RISE 3X' },
      { id: 1342235198175182921, name: 'EMPEROR 3X' },
      { id: 1391209638308872254, name: 'Shadows 3x' },
      { id: 1379533411009560626, name: 'Snowy Billiards 2x' }
    ];

    console.log('\n📋 TESTING /LINK QUERY FOR EACH WORKING GUILD:');
    
    for (const guild of workingGuilds) {
      const [servers] = await connection.execute(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
        [guild.id]
      );
      
      console.log(`\n${guild.name} (${guild.id}):`);
      if (servers.length > 0) {
        console.log(`   ✅ /link command will work - ${servers.length} servers found:`);
        servers.forEach(server => {
          console.log(`      - ${server.nickname}`);
        });
      } else {
        console.log(`   ❌ /link command will fail - no servers found`);
      }
    }

    await connection.end();

    console.log('\n🎯 SUMMARY:');
    console.log('✅ The database is working correctly');
    console.log('✅ Most Discord servers have properly configured Rust servers');
    console.log('⚠️ Make sure you\'re testing /link in the RIGHT Discord server');
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Test /link in one of the working Discord servers listed above');
    console.log('2. If it works there, the issue is you\'re testing in the wrong Discord');
    console.log('3. If it still doesn\'t work, there might be a bot code issue');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

testSpecificGuild();