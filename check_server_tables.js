const pool = require('./src/db');

async function checkServerTables() {
  try {
    console.log('🔍 Checking server tables...\n');
    
    // Check rust_servers table
    console.log('📊 rust_servers table:');
    const [rustServers] = await pool.query('SELECT * FROM rust_servers');
    console.log(`Found ${rustServers.length} servers in rust_servers:`);
    rustServers.forEach((server, index) => {
      console.log(`  ${index + 1}. ${server.nickname} (Guild ID: ${server.guild_id})`);
    });
    
    // Check servers table
    console.log('\n📊 servers table:');
    const [servers] = await pool.query('SELECT * FROM servers');
    console.log(`Found ${servers.length} servers in servers:`);
    servers.forEach((server, index) => {
      console.log(`  ${index + 1}. ${server.nickname} (Guild ID: ${server.guild_id})`);
    });
    
    // Check guilds table
    console.log('\n📊 guilds table:');
    const [guilds] = await pool.query('SELECT * FROM guilds');
    console.log(`Found ${guilds.length} guilds:`);
    guilds.forEach((guild, index) => {
      console.log(`  ${index + 1}. ${guild.name} (Discord ID: ${guild.discord_id}, DB ID: ${guild.id})`);
    });
    
    // Test autocomplete queries
    console.log('\n🧪 Testing autocomplete queries...');
    
    // Test rust_servers autocomplete
    const testGuildId = '1385691441967267953';
    console.log(`\nTesting rust_servers autocomplete for guild ${testGuildId}:`);
    const [rustAutocomplete] = await pool.query(
      'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
      [testGuildId, '%']
    );
    console.log(`rust_servers autocomplete: ${rustAutocomplete.length} results`);
    rustAutocomplete.forEach(server => console.log(`  - ${server.nickname}`));
    
    // Test servers table autocomplete
    console.log(`\nTesting servers autocomplete for guild ${testGuildId}:`);
    const [serversAutocomplete] = await pool.query(
      'SELECT nickname FROM servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
      [testGuildId, '%']
    );
    console.log(`servers autocomplete: ${serversAutocomplete.length} results`);
    serversAutocomplete.forEach(server => console.log(`  - ${server.nickname}`));
    
    // Check which table has the new server
    const newServerName = 'Shadows 3x';
    console.log(`\n🔍 Looking for "${newServerName}" in both tables:`);
    
    const [rustServer] = await pool.query('SELECT * FROM rust_servers WHERE nickname = ?', [newServerName]);
    const [serverRecord] = await pool.query('SELECT * FROM servers WHERE nickname = ?', [newServerName]);
    
    if (rustServer.length > 0) {
      console.log(`✅ Found in rust_servers table`);
    } else {
      console.log(`❌ Not found in rust_servers table`);
    }
    
    if (serverRecord.length > 0) {
      console.log(`✅ Found in servers table`);
    } else {
      console.log(`❌ Not found in servers table`);
    }
    
  } catch (error) {
    console.error('❌ Error checking server tables:', error);
  } finally {
    await pool.end();
  }
}

checkServerTables(); 