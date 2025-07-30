const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up environment variables...');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('✅ .env file already exists');
  console.log('📝 Current environment variables:');
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  lines.forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key] = line.split('=');
      console.log(`   - ${key}`);
    }
  });
} else {
  console.log('❌ .env file not found');
  console.log('📝 Creating .env file template...');
  
  const template = `# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here

# Database Configuration (MariaDB/MySQL)
DB_HOST=localhost
DB_USER=your_database_username
DB_PASSWORD=your_database_password
DB_NAME=zentro_bot
DB_PORT=3306

# RCON Configuration
RCON_DEFAULT_PORT=28016
RCON_DEFAULT_PASSWORD=your_rcon_password_here
`;
  
  fs.writeFileSync(envPath, template);
  console.log('✅ Created .env file template');
  console.log('📝 Please edit the .env file with your actual credentials');
}

console.log('\n💡 To fix the database connection issues:');
console.log('1. Edit the .env file with your database credentials');
console.log('2. Make sure your MariaDB/MySQL server is running');
console.log('3. Ensure the database exists and is accessible');
console.log('4. Run: node test_db_connection.js to test the connection');
console.log('5. Run: node fix_database_schema.js to fix the schema'); 