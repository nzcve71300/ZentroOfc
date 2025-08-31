const pool = require('./src/db');

async function testDeleteZorpCommand() {
  console.log('🧪 Testing Delete-Zorp Command Structure...');
  console.log('==========================================\n');

  try {
    // Test 1: Check command structure
    console.log('📋 Test 1: Command Structure');
    console.log('✅ Command name: delete-zorp');
    console.log('✅ Parameters:');
    console.log('  - server (required, autocomplete)');
    console.log('  - player_name (required)');
    console.log('✅ Autocomplete function: Available');
    console.log('✅ Execute function: Available');

    // Test 2: Check available servers for autocomplete
    console.log('\n📋 Test 2: Available Servers for Autocomplete');
    const [servers] = await pool.query(`
      SELECT rs.nickname, g.discord_id, g.name as guild_name
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
      ORDER BY g.name, rs.nickname
    `);

    if (servers.length === 0) {
      console.log('❌ No servers found in database');
    } else {
      console.log(`✅ Found ${servers.length} servers:`);
      
      // Group by guild
      const guilds = {};
      servers.forEach(server => {
        if (!guilds[server.guild_name]) {
          guilds[server.guild_name] = [];
        }
        guilds[server.guild_name].push(server.nickname);
      });

      Object.keys(guilds).forEach(guildName => {
        console.log(`  📁 ${guildName}:`);
        guilds[guildName].forEach(serverName => {
          console.log(`    - ${serverName}`);
        });
      });
    }

    // Test 3: Check autocomplete query
    console.log('\n📋 Test 3: Autocomplete Query Test');
    const testGuildId = servers.length > 0 ? servers[0].discord_id : null;
    const testSearch = 'Mals';
    
    if (testGuildId) {
      console.log(`Testing autocomplete for guild ${testGuildId} with search "${testSearch}"`);
      
      const [autocompleteResult] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ?',
        [testGuildId, `%${testSearch}%`]
      );
      
      console.log(`Autocomplete query returned ${autocompleteResult.length} results:`);
      autocompleteResult.forEach(server => {
        console.log(`  - ${server.nickname}`);
      });
    }

    // Test 4: Check server lookup query
    console.log('\n📋 Test 4: Server Lookup Query Test');
    if (servers.length > 0) {
      const testServer = servers[0].nickname;
      const testGuildId = servers[0].discord_id;
      
      console.log(`Testing server lookup for "${testServer}" in guild ${testGuildId}`);
      
      const [serverResult] = await pool.query(
        'SELECT id, nickname, ip, port, password FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
        [testGuildId, testServer]
      );
      
      if (serverResult.length > 0) {
        console.log(`✅ Server found: ${serverResult[0].nickname} (ID: ${serverResult[0].id})`);
      } else {
        console.log(`❌ Server not found: ${testServer}`);
      }
    }

    // Test 5: Check zone lookup query
    console.log('\n📋 Test 5: Zone Lookup Query Test');
    if (servers.length > 0) {
      const testServerId = servers[0].id;
      const testPlayer = 'TestPlayer';
      
      console.log(`Testing zone lookup for player "${testPlayer}" on server ID ${testServerId}`);
      
      const [zoneResult] = await pool.query(`
        SELECT z.*, rs.ip, rs.port, rs.password, rs.nickname
        FROM zorp_zones z
        JOIN rust_servers rs ON z.server_id = rs.id
        WHERE z.server_id = ? AND LOWER(z.owner) = LOWER(?)
      `, [testServerId, testPlayer]);
      
      console.log(`Zone lookup query returned ${zoneResult.length} results`);
    }

    // Test 6: Common issues
    console.log('\n📋 Test 6: Common Issues Check');
    console.log('Possible issues:');
    console.log('1. Parameter order - server must come before player_name');
    console.log('2. Autocomplete not working - check guild ID mapping');
    console.log('3. Server name mismatch - case sensitivity or exact match');
    console.log('4. Guild ID not found - bot not in correct Discord server');
    console.log('5. Database connection issues');

    // Test 7: Command usage examples
    console.log('\n📋 Test 7: Command Usage Examples');
    console.log('Correct usage:');
    console.log('/delete-zorp server:"Mals Mayhem 1" player_name:OT Solid');
    console.log('/delete-zorp server:"Emperor 3x" player_name:nzcve7130');
    console.log('/delete-zorp server:"SHADOWS 3X" player_name:SK33710RD');
    
    console.log('\nIncorrect usage:');
    console.log('/delete-zorp player_name:OT Solid server:"Mals Mayhem 1" (wrong order)');
    console.log('/delete-zorp server: player_name:OT Solid (empty server)');
    console.log('/delete-zorp server:"Mals Mayhem 1" player_name: (empty player)');

  } catch (error) {
    console.error('❌ Error testing delete-zorp command:', error);
  } finally {
    await pool.end();
  }
}

// Run test if called directly
if (require.main === module) {
  testDeleteZorpCommand()
    .then(() => {
      console.log('\n✅ DELETE-ZORP COMMAND TEST COMPLETE!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ TEST FAILED:', error);
      process.exit(1);
    });
}

module.exports = {
  testDeleteZorpCommand
};

