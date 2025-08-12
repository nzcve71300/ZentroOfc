const { WebSocket } = require('ws');

async function testRconConnection() {
  const serverDetails = {
    ip: '176.57.171.134',
    port: 31716,
    password: 'lKGGy6xx'
  };
  
  console.log('🔍 Testing RCON connection...');
  console.log(`Server: ${serverDetails.ip}:${serverDetails.port}`);
  console.log(`Password: ${serverDetails.password}`);
  
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://${serverDetails.ip}:${serverDetails.port}/${serverDetails.password}`);
    
    ws.on('open', () => {
      console.log('✅ RCON connection successful!');
      console.log('📡 Server is reachable and credentials are correct');
      
      // Send a simple command to test
      const testCommand = JSON.stringify({ 
        Identifier: 1, 
        Message: 'players', 
        Name: 'WebRcon' 
      });
      
      ws.send(testCommand);
    });
    
    ws.on('message', (data) => {
      try {
        const response = JSON.parse(data.toString());
        console.log('📨 Server response received');
        console.log('✅ RCON communication working properly');
        ws.close();
        resolve(true);
      } catch (error) {
        console.log('📨 Raw response received (non-JSON)');
        console.log('✅ RCON communication working properly');
        ws.close();
        resolve(true);
      }
    });
    
    ws.on('error', (error) => {
      console.log('❌ RCON connection failed:', error.message);
      console.log('🔧 Possible issues:');
      console.log('   - Incorrect IP address');
      console.log('   - Incorrect port number');
      console.log('   - Incorrect RCON password');
      console.log('   - Server is offline');
      console.log('   - Firewall blocking connection');
      resolve(false);
    });
    
    ws.on('close', () => {
      console.log('🔌 RCON connection closed');
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.log('⏰ RCON connection timeout');
        console.log('❌ Server may be offline or credentials incorrect');
        ws.close();
        resolve(false);
      }
    }, 10000);
  });
}

async function main() {
  console.log('🧪 Testing new server RCON connection...\n');
  
  const success = await testRconConnection();
  
  console.log('\n🎯 TEST SUMMARY:');
  if (success) {
    console.log('✅ RCON connection test PASSED');
    console.log('✅ Server credentials are correct');
    console.log('✅ Server is online and reachable');
    console.log('✅ Ready to add to bot configuration');
  } else {
    console.log('❌ RCON connection test FAILED');
    console.log('❌ Please check server credentials and status');
    console.log('❌ Server may be offline or credentials incorrect');
  }
  
  process.exit(success ? 0 : 1);
}

main();