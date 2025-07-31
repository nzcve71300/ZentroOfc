const config = require('./src/config');

console.log('🔍 Checking bot database configuration...');
console.log('📋 Database config:', {
  host: config.db.host,
  user: config.db.user,
  database: config.db.database,
  port: config.db.port,
  password: config.db.password ? '***SET***' : '***NOT SET***'
});

console.log('\n💡 If password is not set, check your .env file or environment variables');
console.log('💡 The bot should be using the same credentials as your database'); 