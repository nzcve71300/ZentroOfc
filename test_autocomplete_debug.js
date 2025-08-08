const pool = require('./src/db');

async function testAutocompleteDebug() {
  try {
    console.log('🔍 Debugging autocomplete issue...\n');
    
    const guildId = '1385691441967267953';
    console.log(`Testing autocomplete for guild: ${guildId}`);
    
    // Step 1: Check if guild exists
    console.log('\n📋 Step 1: Checking guild...');
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
    
    // Step 2: Check all servers for this guild
    console.log('\n📋 Step 2: Checking all servers for this guild...');
    const [allServers] = await pool.query(
      'SELECT id, nickname, guild_id FROM rust_servers WHERE guild_id = ?',
      [guild.id]
    );
    
    console.log(`Found ${allServers.length} servers for guild ${guild.id}:`);
    allServers.forEach(server => {
      console.log(`  - ${server.nickname} (ID: ${server.id})`);
    });
    
    // Step 3: Test the exact autocomplete query
    console.log('\n📋 Step 3: Testing exact autocomplete query...');
    const [autocompleteResult] = await pool.query(
      'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
      [guildId, '%']
    );
    
    console.log(`Autocomplete query returned ${autocompleteResult.length} results:`);
    autocompleteResult.forEach(server => {
      console.log(`  - ${server.nickname}`);
    });
    
    // Step 4: Test with specific search term
    console.log('\n📋 Step 4: Testing with "Shadows" search...');
    const [shadowsResult] = await pool.query(
      'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
      [guildId, '%Shadows%']
    );
    
    console.log(`"Shadows" search returned ${shadowsResult.length} results:`);
    shadowsResult.forEach(server => {
      console.log(`  - ${server.nickname}`);
    });
    
    // Step 5: Check if there are any issues with the server record
    console.log('\n📋 Step 5: Checking server record details...');
    const [serverDetails] = await pool.query(
      'SELECT * FROM rust_servers WHERE nickname = ?',
      ['Shadows 3x']
    );
    
    if (serverDetails.length > 0) {
      const server = serverDetails[0];
      console.log(`Server details:`);
      console.log(`  - ID: ${server.id}`);
      console.log(`  - Nickname: ${server.nickname}`);
      console.log(`  - Guild ID: ${server.guild_id}`);
      console.log(`  - IP: ${server.ip}`);
      console.log(`  - Port: ${server.port}`);
    } else {
      console.log('❌ Server "Shadows 3x" not found!');
    }
    
    // Step 6: Test the exact query that should work
    console.log('\n📋 Step 6: Testing the exact working query...');
    const [workingQuery] = await pool.query(
      'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ? LIMIT 25',
      [guild.id, '%']
    );
    
    console.log(`Direct query returned ${workingQuery.length} results:`);
    workingQuery.forEach(server => {
      console.log(`  - ${server.nickname}`);
    });
    
    console.log('\n💡 If the direct query works but autocomplete doesn\'t, the issue might be:');
    console.log('1. Bot caching old results');
    console.log('2. Discord API caching');
    console.log('3. Need to restart the bot');
    
  } catch (error) {
    console.error('❌ Error testing autocomplete:', error);
  } finally {
    await pool.end();
  }
}

testAutocompleteDebug(); 