const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing .env file format...');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  console.log('📋 Original .env content:');
  console.log(envContent);
  
  // Fix the format - remove any BOM characters and ensure proper line endings
  envContent = envContent.replace(/^\uFEFF/, ''); // Remove BOM
  envContent = envContent.replace(/\r\n/g, '\n'); // Normalize line endings
  
  // Ensure each variable is properly formatted
  const lines = envContent.split('\n');
  const fixedLines = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      // Ensure there's an equals sign
      if (trimmed.includes('=')) {
        fixedLines.push(trimmed);
      } else {
        console.log(`⚠️ Skipping malformed line: ${trimmed}`);
      }
    } else if (trimmed.startsWith('#')) {
      fixedLines.push(trimmed);
    }
  }
  
  // Create a properly formatted .env file
  const fixedContent = `# Discord Bot Configuration
DISCORD_TOKEN=your-discord-bot-token-here
CLIENT_ID=your-discord-client-id-here

# Database Configuration (Local MySQL)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=zentro_bot
DB_USER=root
DB_PASSWORD=Zandewet@123

# RCON Configuration
RCON_DEFAULT_PORT=28016
RCON_DEFAULT_PASSWORD=your_rcon_password_here
`;
  
  fs.writeFileSync(envPath, fixedContent);
  console.log('✅ Fixed .env file format');
  console.log('📋 New .env content:');
  console.log(fixedContent);
  
} else {
  console.log('❌ .env file not found');
}

console.log('\n💡 Now test the database connection:');
console.log('node test_db_connection.js'); 