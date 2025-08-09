const WebSocket = require('ws');

async function testRconConnection() {
  console.log('🔧 Test RCON Connection');
  console.log('========================\n');

  const ip = '81.0.247.39';
  const port = 29816;
  const password = 'UNeyTVw';

  console.log(`Testing connection to: ${ip}:${port}`);
  console.log(`Using password: ${password}\n`);

  try {
    const ws = new WebSocket(`ws://${ip}:${port}/${password}`);
    
    let connectionTimeout = setTimeout(() => {
      console.log('❌ Connection timeout (10 seconds)');
      ws.terminate();
      process.exit(1);
    }, 10000);

    ws.on('open', () => {
      clearTimeout(connectionTimeout);
      console.log('✅ RCON connection successful!');
      console.log('🎉 The server is reachable and the password is correct.');
      
      // Send a test command
      ws.send(JSON.stringify({
        Identifier: 1,
        Message: "status",
        Name: "WebRcon"
      }));
      
      setTimeout(() => {
        ws.close();
        process.exit(0);
      }, 2000);
    });

    ws.on('message', (data) => {
      try {
        const response = JSON.parse(data);
        console.log('📨 Received response from server:');
        console.log(`   Message: ${response.Message}`);
        console.log(`   Type: ${response.Type}`);
      } catch (e) {
        console.log('📨 Received raw data:', data.toString());
      }
    });

    ws.on('error', (error) => {
      clearTimeout(connectionTimeout);
      console.log('❌ RCON connection failed!');
      console.log(`   Error: ${error.message}`);
      
      if (error.message.includes('ECONNREFUSED')) {
        console.log('\n🔍 Possible issues:');
        console.log('   - Server is not running');
        console.log('   - RCON is not enabled on the server');
        console.log('   - Port 29816 is not open/accessible');
        console.log('   - IP address is incorrect');
      } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        console.log('\n🔍 Possible issues:');
        console.log('   - RCON password is incorrect');
        console.log('   - Expected: UNeyTVw');
      }
      
      process.exit(1);
    });

    ws.on('close', (code, reason) => {
      clearTimeout(connectionTimeout);
      console.log(`🔌 Connection closed (Code: ${code})`);
      if (reason) {
        console.log(`   Reason: ${reason}`);
      }
    });

  } catch (error) {
    console.error('❌ Failed to create WebSocket connection:', error.message);
    process.exit(1);
  }
}

testRconConnection();