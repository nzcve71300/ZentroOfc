console.log('🔄 Force RCON Refresh');
console.log('=====================\n');

console.log('The issue is that the bot is using cached RCON connections with the old guild ID.');
console.log('We need to force a complete refresh of all RCON connections.\n');

console.log('📋 Steps to fix:');
console.log('1. Stop the bot completely');
console.log('2. Clear any cached connections');
console.log('3. Restart the bot');
console.log('4. The bot will establish fresh RCON connections with the correct guild ID\n');

console.log('🚀 Commands to run via SSH:');
console.log('--------------------------------');
console.log('# Stop the bot completely');
console.log('pm2 stop zentro-bot');
console.log('');
console.log('# Kill any remaining Node.js processes (just in case)');
console.log('pkill -f "node.*index.js"');
console.log('');
console.log('# Wait a moment for connections to close');
console.log('sleep 3');
console.log('');
console.log('# Start the bot again');
console.log('pm2 start zentro-bot');
console.log('');
console.log('# Check the logs');
console.log('pm2 logs zentro-bot');
console.log('');
console.log('✅ After restart, you should see:');
console.log('- "📡 Found 1 servers in database"');
console.log('- "🔗 Attempting RCON connection to RISE 3X"');
console.log('- "🔥 Connected to RCON: RISE 3X (1391149977434329230)"  <-- Correct guild ID');
console.log('');
console.log('🎯 Then test the autokit emotes again!'); 