const pool = require('./src/db');

async function debugHomeTeleportTimeout() {
  try {
    console.log('🔍 Debugging Home Teleport Timeout Issue...\n');

    // Get a test server
    const [servers] = await pool.query('SELECT * FROM rust_servers LIMIT 1');
    if (servers.length === 0) {
      console.log('❌ No servers found in database');
      return;
    }

    const server = servers[0];
    console.log(`📋 Server: ${server.nickname}`);
    console.log(`🌐 IP: ${server.ip}:${server.port}\n`);

    console.log('🚨 ISSUE: Home teleport still timing out after fixes');
    console.log('🔍 Possible Causes:');
    console.log('1. Position response not being received');
    console.log('2. Position response format incorrect');
    console.log('3. State management issue');
    console.log('4. Position handler not being called');
    console.log('5. Database table mismatch');

    console.log('\n🔧 Debugging Steps Added:');
    console.log('✅ Added position response logging');
    console.log('✅ Added state management debugging');
    console.log('✅ Added timeout check logging');
    console.log('✅ Added position handler call logging');

    console.log('\n📝 Debug Logs to Monitor:');
    console.log('[HOME TELEPORT DEBUG] Sending printpos command for PlayerName');
    console.log('[POSITION DEBUG] Processing message for position response: ...');
    console.log('[HOME TELEPORT] Position response received for PlayerName: x, y, z');
    console.log('[HOME TELEPORT DEBUG] Processing position for state key: ...');
    console.log('[HOME TELEPORT DEBUG] Timeout check for PlayerName, current state: ...');
    console.log('[HOME TELEPORT DEBUG] Position timeout reached for PlayerName, cleaning up state');

    console.log('\n🎯 Expected Flow:');
    console.log('1. SET HOME emote → Bot kills player');
    console.log('2. Player respawns → Bot detects respawn');
    console.log('3. Bot sends printpos → Position response received');
    console.log('4. Position processed → Home saved → SUCCESS message');
    console.log('5. State cleared → No timeout');

    console.log('\n❌ Current Issue Flow:');
    console.log('1. SET HOME emote → Bot kills player');
    console.log('2. Player respawns → Bot detects respawn');
    console.log('3. Bot sends printpos → Position response NOT received/processed');
    console.log('4. 30-second timeout → "home teleport setup timed out" message');

    console.log('\n🔍 To Debug:');
    console.log('1. Use SET HOME emote');
    console.log('2. Get killed and respawn');
    console.log('3. Monitor logs: pm2 logs zentro-bot --lines 200');
    console.log('4. Look for position response messages');
    console.log('5. Check if state is being managed correctly');

    console.log('\n📋 Database Tables to Check:');
    console.log('✅ home_teleports - stores home locations');
    console.log('✅ home_teleport_configs - stores configuration');
    console.log('✅ player_homes - alternative home storage');

    console.log('\n⚠️ Common Issues:');
    console.log('1. Position response format: "(x, y, z)" vs "(x,y,z)"');
    console.log('2. State key mismatch between set and get');
    console.log('3. Position handler not finding home teleport state');
    console.log('4. Database table structure mismatch');

    console.log('\n🔧 Next Steps:');
    console.log('1. Test the system and monitor logs');
    console.log('2. Check if position responses are being received');
    console.log('3. Verify state management is working');
    console.log('4. Check database table structure');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await pool.end();
  }
}

debugHomeTeleportTimeout();
