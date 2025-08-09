const WebSocket = require('ws');

async function testSNB1Rcon() {
  console.log('🔧 Testing SNB1 RCON Connection...\n');
  
  const serverDetails = {
    ip: '81.0.247.39',
    port: 29816,
    password: 'UNeyTVwW'
  };
  
  console.log('📋 Testing with current details:');
  console.log(`   IP: ${serverDetails.ip}`);
  console.log(`   Port: ${serverDetails.port}`);
  console.log(`   Password: ${serverDetails.password}`);
  console.log(`   WebSocket URL: ws://${serverDetails.ip}:${serverDetails.port}/${serverDetails.password}\n`);
  
  // Test different common RCON ports
  const commonPorts = [29816, 28016, 28015, 28017, 25575];
  
  for (const port of commonPorts) {
    console.log(`🔍 Testing port ${port}...`);
    
    try {
      const ws = new WebSocket(`ws://${serverDetails.ip}:${port}/${serverDetails.password}`);
      
      const result = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve({ success: false, error: 'Timeout' });
        }, 5000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          console.log(`✅ SUCCESS! RCON connected on port ${port}`);
          
          // Send a test command
          ws.send(JSON.stringify({ Identifier: 1, Message: 'status', Name: 'WebRcon' }));
          
          ws.on('message', (data) => {
            const response = JSON.parse(data.toString());
            console.log(`📨 Response: ${response.Message.substring(0, 100)}...`);
            ws.close();
            resolve({ success: true, port: port });
          });
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          resolve({ success: false, error: error.message });
        });
      });
      
      if (result.success) {
        console.log(`\n🎉 FOUND WORKING RCON!`);
        console.log(`   Correct port: ${result.port}`);
        console.log(`   Update your database with this port.`);
        return;
      } else {
        console.log(`   ❌ Port ${port}: ${result.error}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Port ${port}: ${error.message}`);
    }
  }
  
  console.log(`\n❌ No working RCON ports found.`);
  console.log(`\n🔧 Troubleshooting steps:`);
  console.log(`1. Verify the server IP is correct: ${serverDetails.ip}`);
  console.log(`2. Check if the server is online (can players connect?)`);
  console.log(`3. Ask server owner for correct RCON port and password`);
  console.log(`4. Common RCON ports: 28016, 28015, 28017, 29816`);
  console.log(`5. RCON password might be different from what's in database`);
}

testSNB1Rcon();