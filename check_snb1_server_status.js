const net = require('net');

async function checkSNB1ServerStatus() {
  console.log('🔧 Checking SNB1 Server Status...\n');
  
  const serverIP = '81.0.247.39';
  
  // Common Rust server ports to check
  const portsToCheck = [
    { port: 28015, type: 'Game Server' },
    { port: 28016, type: 'RCON' },
    { port: 28017, type: 'Alternative RCON' },
    { port: 29015, type: 'Alternative Game' },
    { port: 29016, type: 'Alternative RCON' },
    { port: 29816, type: 'Current RCON (was giving 501)' },
    { port: 25575, type: 'Minecraft RCON (sometimes used)' }
  ];
  
  console.log(`📡 Checking server: ${serverIP}\n`);
  
  for (const { port, type } of portsToCheck) {
    try {
      const result = await checkPort(serverIP, port, 3000);
      if (result.open) {
        console.log(`✅ Port ${port} (${type}): OPEN`);
      } else {
        console.log(`❌ Port ${port} (${type}): CLOSED/FILTERED`);
      }
    } catch (error) {
      console.log(`❌ Port ${port} (${type}): ${error.message}`);
    }
  }
  
  console.log('\n🔍 Analysis:');
  console.log('If NO ports are open:');
  console.log('  - Server is completely offline');
  console.log('  - IP address has changed');
  console.log('  - Firewall is blocking all connections');
  console.log('');
  console.log('If Game Server port is open but RCON is closed:');
  console.log('  - RCON is disabled in server configuration');
  console.log('  - RCON is using a different port');
  console.log('  - RCON password is wrong (but port would still be open)');
  console.log('');
  console.log('💡 Next steps:');
  console.log('1. Contact SNB1 server owner/admin');
  console.log('2. Ask them to check server.cfg for:');
  console.log('   - rcon.web 1');
  console.log('   - rcon.port [actual_port]');
  console.log('   - rcon.password [actual_password]');
  console.log('3. Verify server IP hasn\'t changed');
  console.log('4. Check if server is actually online (can players connect?)');
}

function checkPort(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ open: false, error: 'timeout' });
    }, timeout);
    
    socket.connect(port, host, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ open: true });
    });
    
    socket.on('error', (error) => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ open: false, error: error.code });
    });
  });
}

checkSNB1ServerStatus();