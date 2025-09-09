// Simple script to help disconnect RCON for specific server
// This will show you the server info and give you options

console.log('🔍 Server to disconnect RCON:');
console.log('   IP: 149.102.128.81');
console.log('   Port: 31616');
console.log('   Password: vaKzNZpw');
console.log('');

console.log('📋 Options to disconnect RCON:');
console.log('');
console.log('1. 🚀 RESTART BOT (Recommended):');
console.log('   pm2 restart zentro-bot');
console.log('   - This will disconnect all RCON connections');
console.log('   - Then reconnect only active servers');
console.log('   - Safest option, no data loss');
console.log('');

console.log('2. 🛑 STOP BOT:');
console.log('   pm2 stop zentro-bot');
console.log('   - Disconnects all RCON connections');
console.log('   - Bot will be offline until restarted');
console.log('');

console.log('3. 🔄 RELOAD BOT:');
console.log('   pm2 reload zentro-bot');
console.log('   - Graceful restart with zero downtime');
console.log('   - Disconnects and reconnects RCON');
console.log('');

console.log('⚠️  IMPORTANT NOTES:');
console.log('   - This will ONLY disconnect the RCON connection');
console.log('   - NO data will be deleted from database');
console.log('   - Server configuration remains intact');
console.log('   - Players can still use Discord commands');
console.log('   - Only in-game RCON features will be disabled');
console.log('');

console.log('✅ RECOMMENDED ACTION:');
console.log('   Run: pm2 restart zentro-bot');
console.log('   This will safely disconnect the RCON and reconnect if needed');
