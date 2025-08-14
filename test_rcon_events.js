const pool = require('./src/db');
const { sendRconCommand } = require('./src/rcon/index.js');

async function testRconEvents() {
  console.log('🧪 Testing RCON Event Detection...\n');

  try {
    // Get a server to test with
    const [serversResult] = await pool.query(`
      SELECT 
        rs.id, rs.nickname, rs.ip, rs.port, rs.password,
        g.discord_id as guild_id
      FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id 
      LIMIT 1
    `);

    if (serversResult.length === 0) {
      console.log('❌ No servers found to test with');
      return;
    }

    const server = serversResult[0];
    console.log(`Testing with server: ${server.nickname} (${server.ip}:${server.port})`);

    // Test Bradley detection
    console.log('\n1. Testing Bradley detection...');
    try {
      const bradleyResponse = await sendRconCommand(server.ip, server.port, server.password, "find_entity servergibs_bradley");
      console.log('Bradley response:', bradleyResponse);
      
      if (bradleyResponse) {
        const cleanResponse = bradleyResponse.replace(/[\x00-\x1F\x7F]/g, '').trim();
        console.log('Cleaned Bradley response:', cleanResponse);
        console.log('Contains servergibs_bradley:', cleanResponse.includes("servergibs_bradley"));
      }
    } catch (error) {
      console.error('Bradley test error:', error.message);
    }

    // Test Helicopter detection
    console.log('\n2. Testing Helicopter detection...');
    try {
      const helicopterResponse = await sendRconCommand(server.ip, server.port, server.password, "find_entity servergibs_patrolhelicopter");
      console.log('Helicopter response:', helicopterResponse);
      
      if (helicopterResponse) {
        const cleanResponse = helicopterResponse.replace(/[\x00-\x1F\x7F]/g, '').trim();
        console.log('Cleaned Helicopter response:', cleanResponse);
        console.log('Contains servergibs_patrolhelicopter:', cleanResponse.includes("servergibs_patrolhelicopter"));
      }
    } catch (error) {
      console.error('Helicopter test error:', error.message);
    }

    // Test basic RCON connection
    console.log('\n3. Testing basic RCON connection...');
    try {
      const statusResponse = await sendRconCommand(server.ip, server.port, server.password, "status");
      console.log('Status response length:', statusResponse ? statusResponse.length : 'null');
      if (statusResponse) {
        console.log('Status response preview:', statusResponse.substring(0, 100) + '...');
      }
    } catch (error) {
      console.error('Status test error:', error.message);
    }

    // Test say command
    console.log('\n4. Testing say command...');
    try {
      const sayResponse = await sendRconCommand(server.ip, server.port, server.password, 'say "Test message from bot"');
      console.log('Say response:', sayResponse);
    } catch (error) {
      console.error('Say test error:', error.message);
    }

    console.log('\n✅ RCON event testing completed!');

  } catch (error) {
    console.error('❌ Error during RCON testing:', error);
  } finally {
    await pool.end();
  }
}

testRconEvents();
