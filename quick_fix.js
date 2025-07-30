const fs = require('fs');
const path = require('path');

console.log('🚀 Quick Fix for Zentro Bot Issues');
console.log('=====================================\n');

// Check environment file
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('📋 Current .env file content:');
  console.log(envContent);
  
  // Check if database variables are set
  const hasDbHost = envContent.includes('DB_HOST=') && !envContent.includes('DB_HOST=\n');
  const hasDbUser = envContent.includes('DB_USER=') && !envContent.includes('DB_USER=\n');
  const hasDbPassword = envContent.includes('DB_PASSWORD=') && !envContent.includes('DB_PASSWORD=\n');
  const hasDbName = envContent.includes('DB_NAME=') && !envContent.includes('DB_NAME=\n');
  
  if (!hasDbHost || !hasDbUser || !hasDbPassword || !hasDbName) {
    console.log('\n❌ Database credentials are missing or empty!');
    console.log('💡 Please edit the .env file with your database credentials:');
    console.log('   DB_HOST=your_database_host');
    console.log('   DB_USER=your_database_username');
    console.log('   DB_PASSWORD=your_database_password');
    console.log('   DB_NAME=your_database_name');
    console.log('   DB_PORT=3306');
  } else {
    console.log('\n✅ Database credentials appear to be set');
  }
} else {
  console.log('❌ .env file not found!');
  console.log('💡 Please create a .env file with your database credentials');
}

console.log('\n🔧 Issues to Fix:');
console.log('1. Database Connection: Set up MariaDB/MySQL credentials in .env');
console.log('2. Invalid Servers: Remove servers with 0.0.0.0 IP addresses');
console.log('3. Database Schema: Add missing columns to economy/transactions tables');
console.log('4. RCON Connections: Bot will skip invalid servers after fixes');

console.log('\n📝 Next Steps:');
console.log('1. Edit .env file with your database credentials');
console.log('2. Start your MariaDB/MySQL server');
console.log('3. Run: node test_db_connection.js');
console.log('4. Run: node fix_database_schema.js');
console.log('5. Run: node cleanup_invalid_servers.js');
console.log('6. Restart your bot');

console.log('\n🚨 If you need help with database setup:');
console.log('- Install XAMPP for local MySQL/MariaDB');
console.log('- Or use a cloud database service');
console.log('- Make sure the database exists and is accessible'); 