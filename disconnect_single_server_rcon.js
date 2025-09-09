const { WebSocket } = require('ws');

// Server details to disconnect
const targetServer = {
  ip: '149.102.128.81',
  port: 31616,
  password: 'vaKzNZpw',
  guildId: '1342235198175182921'
};

console.log('🔍 Attempting to disconnect RCON for specific server...');
console.log(`📡 Server: ${targetServer.ip}:${targetServer.port}`);
console.log(`🏰 Guild ID: ${targetServer.guildId}`);
console.log('');

// Since we can't access the activeConnections Map directly from outside the bot,
// we'll create a temporary connection to test and then provide instructions

console.log('📋 To disconnect ONLY this server\'s RCON:');
console.log('');
console.log('1. 🎯 METHOD 1 - Modify the bot code temporarily:');
console.log('   - Edit src/rcon/index.js');
console.log('   - Find the connectRcon function');
console.log('   - Add a condition to skip this specific server:');
console.log('');
console.log('   if (ip === "149.102.128.81" && port === 31616) {');
console.log('     console.log("Skipping connection to 149.102.128.81:31616");');
console.log('     return;');
console.log('   }');
console.log('');
console.log('   - Restart the bot: pm2 restart zentro-bot');
console.log('   - Remove the condition after disconnection');
console.log('');

console.log('2. 🎯 METHOD 2 - Use PM2 to restart with environment variable:');
console.log('   - Set environment variable: export SKIP_SERVER_149_102_128_81=true');
console.log('   - Restart bot: pm2 restart zentro-bot');
console.log('   - The bot can check this variable and skip the connection');
console.log('');

console.log('3. 🎯 METHOD 3 - Database approach (if you want to temporarily disable):');
console.log('   - Update the server record to have an invalid IP temporarily');
console.log('   - Restart bot: pm2 restart zentro-bot');
console.log('   - Change IP back when you want to reconnect');
console.log('');

console.log('⚠️  IMPORTANT:');
console.log('   - This will ONLY disconnect the RCON for this specific server');
console.log('   - Other servers will remain connected');
console.log('   - No data will be deleted');
console.log('   - Server configuration remains intact');
console.log('');

console.log('✅ RECOMMENDED: Use Method 1 (temporary code modification)');
console.log('   This is the cleanest way to disconnect just one server\'s RCON');
