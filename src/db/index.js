const mysql = require('mysql2/promise');
const { db } = require('../config');

// Create MySQL connection pool with error handling
let pool;

try {
  pool = mysql.createPool({
    host: db.host,
    user: db.user,
    password: db.password,
    database: db.database,
    port: db.port || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  
  // Test connection
  pool.getConnection()
    .then(connection => {
      console.log('✅ MySQL connection pool created successfully');
      connection.release();
    })
    .catch(err => {
      console.error('❌ MySQL connection failed:', err.message);
      console.log('💡 Please set up MySQL database before running the bot');
      console.log('   Options: XAMPP, MySQL Server, or Cloud Database');
    });
} catch (error) {
  console.error('❌ Failed to create MySQL pool:', error.message);
}

module.exports = pool; 