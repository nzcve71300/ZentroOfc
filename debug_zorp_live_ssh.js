const WebSocket = require('ws');
const pool = require('./src/db');

console.log('🔍 ZORP EMOTE DEBUG MONITOR');
console.log('============================');
console.log('This script will help identify where the goodbye emote deletion is failing.');
console.log('');

// Test the actual deletion logic from the bot
async function testZorpDeletion(playerName, serverName, guildId) {
  console.log(`\n🧪 TESTING ZORP DELETION FOR:`);
  console.log(`   Player: ${playerName}`);
  console.log(`   Server: ${serverName}`);
  console.log(`   Guild ID: ${guildId}`);
  console.log('');

  try {
    // Step 1: Get server ID
    console.log('📡 Step 1: Getting server ID...');
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) {
      console.log(`❌ Server not found: ${serverName}`);
      return false;
    }
    
    const serverId = serverResult[0].id;
    console.log(`✅ Server ID found: ${serverId}`);

    // Step 2: Check if player has a zone (try by owner first)
    console.log('📡 Step 2: Checking for player zones...');
    let [zoneResult] = await pool.query(
      'SELECT name FROM zorp_zones WHERE server_id = ? AND owner = ?',
      [serverId, playerName]
    );

    console.log(`   Found ${zoneResult.length} zones by owner`);

    // If no zone found by owner, try to find any zone for this player
    if (zoneResult.length === 0) {
      console.log(`   No zone found by owner ${playerName}, checking for any available zones...`);
      [zoneResult] = await pool.query(
        'SELECT name FROM zorp_zones WHERE server_id = ? LIMIT 1',
        [serverId]
      );
      console.log(`   Found ${zoneResult.length} zones by server`);
    }

    if (zoneResult.length === 0) {
      console.log(`❌ Player ${playerName} has no zone to delete`);
      return false;
    }

    const zoneName = zoneResult[0].name;
    console.log(`✅ Zone found: ${zoneName}`);

    // Step 3: Show what would be deleted
    console.log('📡 Step 3: Zone deletion simulation...');
    console.log(`   Would delete zone: ${zoneName}`);
    console.log(`   Would send RCON command: zones.deletecustomzone "${zoneName}"`);
    console.log(`   Would delete from database: DELETE FROM zorp_zones WHERE name = '${zoneName}' AND server_id = ${serverId}`);

    return true;
  } catch (error) {
    console.error('❌ Error in deletion test:', error);
    return false;
  }
}

// Test with different scenarios
async function runTests() {
  console.log('🚀 RUNNING COMPREHENSIVE TESTS...\n');

  // Test 1: Check what servers are available
  console.log('📋 Available servers:');
  try {
    const [servers] = await pool.query('SELECT id, nickname, guild_id FROM rust_servers LIMIT 5');
    servers.forEach(server => {
      console.log(`   - ${server.nickname} (ID: ${server.id}, Guild: ${server.guild_id})`);
    });
  } catch (error) {
    console.error('❌ Error getting servers:', error);
  }

  console.log('\n📋 Available zorp zones:');
  try {
    const [zones] = await pool.query('SELECT name, owner, server_id FROM zorp_zones LIMIT 10');
    zones.forEach(zone => {
      console.log(`   - ${zone.name} (Owner: ${zone.owner}, Server ID: ${zone.server_id})`);
    });
  } catch (error) {
    console.error('❌ Error getting zones:', error);
  }

  // Test 2: Test deletion for a specific player (you can change this)
  console.log('\n🧪 Test deletion for a specific player...');
  const testPlayer = 'TestPlayer'; // Change this to a real player name
  const testServer = 'EMPEROR 3X'; // Change this to your server name
  const testGuildId = '123456789'; // Change this to your guild ID

  await testZorpDeletion(testPlayer, testServer, testGuildId);

  console.log('\n🎯 NEXT STEPS:');
  console.log('1. Change the testPlayer, testServer, and testGuildId variables above');
  console.log('2. Run this script again with real values');
  console.log('3. Use the goodbye emote in-game and check the bot logs');
  console.log('4. Look for "[ZORP DEBUG]" messages in the bot console');
}

// Run the tests
runTests().then(() => {
  console.log('\n✅ Debug script completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
}); 