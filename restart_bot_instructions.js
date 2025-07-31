console.log('🔄 Bot Restart Instructions');
console.log('===========================\n');

console.log('The bot is still using the old RCON connection that was established before we fixed the database.');
console.log('You need to restart the bot to pick up the new server configuration.\n');

console.log('📋 Steps to restart the bot:');
console.log('1. Stop the current bot process');
console.log('2. Start the bot again');
console.log('3. The bot will automatically reconnect to RCON with the new server config\n');

console.log('🚀 Commands to run via SSH:');
console.log('--------------------------------');
console.log('# Stop the current bot');
console.log('pm2 stop zentro-bot');
console.log('');
console.log('# Start the bot again');
console.log('pm2 start zentro-bot');
console.log('');
console.log('# Check the logs');
console.log('pm2 logs zentro-bot');
console.log('');
console.log('# Or if you\'re not using PM2:');
console.log('pkill -f "node.*index.js"');
console.log('node src/index.js &\n');

console.log('✅ After restart, you should see:');
console.log('- "📡 Found 1 servers in database"');
console.log('- "🔗 Attempting RCON connection to RISE 3X"');
console.log('- "🔥 Connected to RCON: RISE 3X"');
console.log('');
console.log('🎯 Then test the autokit emotes again!'); 