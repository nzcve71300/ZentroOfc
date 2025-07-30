require('dotenv').config();

console.log('🔍 Simple Environment and Connection Test\n');

console.log('Environment Variables:');
console.log('DB_HOST:', process.env.DB_HOST || 'NOT SET');
console.log('DB_USER:', process.env.DB_USER || 'NOT SET');
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'SET' : 'NOT SET');
console.log('DB_NAME:', process.env.DB_NAME || 'NOT SET');
console.log('DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? 'SET' : 'NOT SET');

console.log('\n📋 Next Steps:');
console.log('1. Check if your .env file exists and has the correct values');
console.log('2. Make sure your database server is running');
console.log('3. Verify your Discord bot token is valid');
console.log('4. Check if your bot has the correct permissions in Discord'); 