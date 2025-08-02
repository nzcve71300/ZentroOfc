require('dotenv').config();

console.log('🔍 Diagnosing pool issue...');
console.log('Environment variables:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PORT:', process.env.DB_PORT || 3306);

try {
  console.log('\n📦 Loading database module...');
  const pool = require('./src/db');
  console.log('✅ Database pool loaded successfully');
  
  console.log('\n🧪 Testing database connection...');
  pool.query('SELECT 1 as test')
    .then(([result]) => {
      console.log('✅ Database query successful:', result);
      console.log('\n🎉 Database connection is working!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database query failed:', error);
      process.exit(1);
    });
    
} catch (error) {
  console.error('❌ Failed to load database module:', error);
  process.exit(1);
} 