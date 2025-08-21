require('dotenv').config();

console.log('🔍 CHECKING ENVIRONMENT VARIABLES');
console.log('==================================\n');

// Check for Discord token
if (process.env.DISCORD_TOKEN) {
  console.log('✅ DISCORD_TOKEN found');
  console.log(`   Length: ${process.env.DISCORD_TOKEN.length} characters`);
  console.log(`   Starts with: ${process.env.DISCORD_TOKEN.substring(0, 10)}...`);
} else {
  console.log('❌ DISCORD_TOKEN not found');
}

// Check for other common environment variables
const envVars = [
  'DISCORD_TOKEN',
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'NODE_ENV'
];

console.log('\n📋 Environment Variables:');
envVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`   ${varName}: ${process.env[varName].substring(0, 10)}...`);
  } else {
    console.log(`   ${varName}: ❌ Not set`);
  }
});

// Check if .env file exists
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('\n✅ .env file found');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  console.log(`   Contains ${lines.length} environment variables`);
} else {
  console.log('\n❌ .env file not found');
  console.log('💡 Create a .env file with your Discord token:');
  console.log('   DISCORD_TOKEN=your_discord_bot_token_here');
}

console.log('\n💡 If DISCORD_TOKEN is not found, try:');
console.log('   1. Check if .env file exists in the current directory');
console.log('   2. Make sure DISCORD_TOKEN is set in the .env file');
console.log('   3. Or export it: export DISCORD_TOKEN=your_token_here');
