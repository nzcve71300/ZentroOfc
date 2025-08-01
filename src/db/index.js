const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'zentro_bot',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connected to MariaDB/MySQL database');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Please check your database configuration in .env file');
    process.exit(1);
  }
}

// Initialize database tables
async function initializeTables() {
  try {
    const fs = require('fs');
    const path = require('path');
    const schemaPath = path.join(__dirname, '../../subscription_schema.sql');
    
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Split schema into individual statements
      const statements = schema
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt && !stmt.startsWith('--'));
      
      for (const statement of statements) {
        if (statement) {
          try {
            await pool.query(statement);
          } catch (error) {
            // Ignore errors for existing tables
            if (!error.message.includes('already exists')) {
              console.error('Error executing statement:', error.message);
            }
          }
        }
      }
      
      console.log('✅ Database tables created/verified');
    } else {
      console.error('❌ Schema file not found:', schemaPath);
    }
  } catch (error) {
    console.error('❌ Error initializing tables:', error.message);
  }
}

// Initialize database on startup
async function initializeDatabase() {
  await testConnection();
  await initializeTables();
}

// Export the pool and helper functions
module.exports = pool;

// Also export initialization function
module.exports.initializeDatabase = initializeDatabase; 