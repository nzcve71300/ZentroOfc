const WebSocket = require('ws');
const pool = require('./src/db');

console.log('🔍 TESTING ZORP DELETION WITH REAL DATA');
console.log('========================================');

async function testRealZorpDeletion() {
  try {
    // Test with EMPEROR 3X server (Guild ID: 337)
    const serverName = 'EMPEROR 3X';
    const guildId = '337';
    
    console.log(`\n🧪 Testing with real server data:`);
    console.log(`   Server: ${serverName}`);
    console.log(`   Guild ID: ${guildId}`);
    
    // Step 1: Get server ID
    console.log('\n📡 Step 1: Getting server ID...');
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) {
      console.log(`❌ Server not found: ${serverName}`);
      return;
    }
    
    const serverId = serverResult[0].id;
    console.log(`✅ Server ID found: ${serverId}`);

    // Step 2: Check zones for this server
    console.log('\n📡 Step 2: Checking zones for this server...');
    const [zones] = await pool.query(
      'SELECT name, owner FROM zorp_zones WHERE server_id = ?',
      [serverId]
    );
    
    console.log(`   Found ${zones.length} zones for server ${serverName}:`);
    zones.forEach(zone => {
      console.log(`   - ${zone.name} (Owner: ${zone.owner})`);
    });

    if (zones.length === 0) {
      console.log(`❌ No zones found for server ${serverName}`);
      return;
    }

    // Step 3: Test deletion for each zone
    console.log('\n📡 Step 3: Testing deletion for each zone...');
    for (const zone of zones) {
      console.log(`\n   Testing zone: ${zone.name}`);
      console.log(`   Owner: ${zone.owner}`);
      
      // Simulate what the bot would do
      console.log(`   Would send RCON: zones.deletecustomzone "${zone.name}"`);
      console.log(`   Would delete from DB: DELETE FROM zorp_zones WHERE name = '${zone.name}' AND server_id = ${serverId}`);
    }

    // Step 4: Test with a specific player name
    console.log('\n📡 Step 4: Testing with specific player names...');
    const testPlayers = ['nzcve7130', 'InfectoFN']; // Real players from the database
    
    for (const playerName of testPlayers) {
      console.log(`\n   Testing player: ${playerName}`);
      
      // Check if player has zones by owner
      const [playerZones] = await pool.query(
        'SELECT name FROM zorp_zones WHERE server_id = ? AND owner = ?',
        [serverId, playerName]
      );
      
      if (playerZones.length > 0) {
        console.log(`   ✅ Found ${playerZones.length} zones for player ${playerName}`);
        playerZones.forEach(zone => {
          console.log(`      - ${zone.name}`);
        });
      } else {
        console.log(`   ❌ No zones found for player ${playerName}`);
      }
    }

    console.log('\n🎯 ANALYSIS:');
    console.log('1. Server lookup works with correct guild ID');
    console.log('2. Zones exist in database');
    console.log('3. The issue might be in the bot\'s guild ID lookup');
    console.log('4. Or the player name extraction from the emote message');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
testRealZorpDeletion().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
}); 