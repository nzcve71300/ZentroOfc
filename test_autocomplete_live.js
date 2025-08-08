const pool = require('./src/db');

async function testAutocompleteLive() {
  try {
    console.log('🧪 Testing autocomplete live...\n');
    
    const guildId = '1385691441967267953';
    console.log(`Testing for guild: ${guildId}`);
    
    // Step 1: Check guild
    const [guildResult] = await pool.query(
      'SELECT id, discord_id, name FROM guilds WHERE discord_id = ?',
      [guildId]
    );
    
    if (guildResult.length === 0) {
      console.log('❌ Guild not found!');
      return;
    }
    
    const guild = guildResult[0];
    console.log(`✅ Guild found: ${guild.name} (DB ID: ${guild.id})`);
    
    // Step 2: Test the exact autocomplete query
    console.log('\n🔍 Testing autocomplete query...');
    const [autocompleteResult] = await pool.query(
      'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ? LIMIT 25',
      [guild.id, '%']
    );
    
    console.log(`📊 Found ${autocompleteResult.length} servers:`);
    autocompleteResult.forEach((server, index) => {
      console.log(`  ${index + 1}. ${server.nickname}`);
    });
    
    // Step 3: Test with "Shadows" search
    console.log('\n🔍 Testing "Shadows" search...');
    const [shadowsResult] = await pool.query(
      'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ? LIMIT 25',
      [guild.id, '%Shadows%']
    );
    
    console.log(`📊 Found ${shadowsResult.length} servers with "Shadows":`);
    shadowsResult.forEach((server, index) => {
      console.log(`  ${index + 1}. ${server.nickname}`);
    });
    
    // Step 4: Check if "Shadows 3x" exists specifically
    console.log('\n🔍 Checking for "Shadows 3x" specifically...');
    const [specificServer] = await pool.query(
      'SELECT * FROM rust_servers WHERE nickname = ?',
      ['Shadows 3x']
    );
    
    if (specificServer.length > 0) {
      const server = specificServer[0];
      console.log(`✅ Found "Shadows 3x":`);
      console.log(`  - ID: ${server.id}`);
      console.log(`  - Guild ID: ${server.guild_id}`);
      console.log(`  - IP: ${server.ip}`);
      console.log(`  - Port: ${server.port}`);
      
      if (server.guild_id == guild.id) {
        console.log('✅ Server is in the correct guild!');
      } else {
        console.log(`❌ Server is in wrong guild! Expected: ${guild.id}, Got: ${server.guild_id}`);
      }
    } else {
      console.log('❌ "Shadows 3x" not found in database!');
    }
    
    console.log('\n💡 If the database shows the server but Discord doesn\'t:');
    console.log('1. Try restarting the bot: pm2 restart zentro-bot');
    console.log('2. Wait a few minutes for Discord cache to clear');
    console.log('3. Try the command again');
    
  } catch (error) {
    console.error('❌ Error testing autocomplete:', error);
  } finally {
    await pool.end();
  }
}

testAutocompleteLive(); 