const pool = require('./src/db');

console.log('🔍 DEBUGGING GUILD LOOKUP');
console.log('==========================');

async function debugGuildLookup() {
  try {
    console.log('\n📋 Checking guilds table:');
    const [guilds] = await pool.query('SELECT id, discord_id, name FROM guilds');
    guilds.forEach(guild => {
      console.log(`   - ID: ${guild.id}, Discord ID: ${guild.discord_id}, Name: ${guild.name}`);
    });

    console.log('\n📋 Checking rust_servers table:');
    const [servers] = await pool.query('SELECT id, nickname, guild_id FROM rust_servers');
    servers.forEach(server => {
      console.log(`   - ID: ${server.id}, Nickname: ${server.nickname}, Guild ID: ${server.guild_id}`);
    });

    console.log('\n🧪 Testing different guild ID formats:');
    
    // Test with string '337'
    console.log('\n   Testing with guild_id = "337":');
    const [test1] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      ['337', 'EMPEROR 3X']
    );
    console.log(`   Result: ${test1.length} servers found`);

    // Test with number 337
    console.log('\n   Testing with guild_id = 337:');
    const [test2] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [337, 'EMPEROR 3X']
    );
    console.log(`   Result: ${test2.length} servers found`);

    // Test direct guild_id lookup
    console.log('\n   Testing direct guild_id lookup:');
    const [test3] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = ? AND nickname = ?',
      [337, 'EMPEROR 3X']
    );
    console.log(`   Result: ${test3.length} servers found`);

    // Test with the actual guild_id from the servers table
    console.log('\n   Testing with actual guild_id from servers table:');
    const [test4] = await pool.query(
      'SELECT id FROM rust_servers WHERE nickname = ?',
      ['EMPEROR 3X']
    );
    if (test4.length > 0) {
      console.log(`   Server found with guild_id: ${test4[0].id}`);
      
      // Check what guild this corresponds to
      const [guildCheck] = await pool.query(
        'SELECT discord_id FROM guilds WHERE id = ?',
        [test4[0].id]
      );
      if (guildCheck.length > 0) {
        console.log(`   Corresponding guild discord_id: ${guildCheck[0].discord_id}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugGuildLookup().then(() => {
  console.log('\n✅ Debug completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Debug failed:', error);
  process.exit(1);
}); 