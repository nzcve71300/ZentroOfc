#!/usr/bin/env node

/**
 * Database Initialization Script
 * This script initializes the MariaDB database with the proper schema
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

// Database configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'zentro_gaming_hub',
  charset: 'utf8mb4',
  timezone: '+00:00'
};

async function initializeDatabase() {
  let connection;
  
  try {
    console.log('🚀 Starting database initialization...');
    
    // Connect to MySQL server (without database)
    const serverConfig = { ...DB_CONFIG };
    delete serverConfig.database;
    
    connection = await mysql.createConnection(serverConfig);
    console.log('✅ Connected to MySQL server');
    
    // Create database if it doesn't exist
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Database '${DB_CONFIG.database}' created or already exists`);
    
    // Close server connection
    await connection.end();
    
    // Connect to the specific database
    connection = await mysql.createConnection(DB_CONFIG);
    console.log(`✅ Connected to database '${DB_CONFIG.database}'`);
    
    // Read and execute schema file
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    
    console.log('📖 Reading schema file...');
    
    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('SET'));
    
    console.log(`📝 Executing ${statements.length} SQL statements...`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await connection.execute(statement);
          console.log(`✅ Statement ${i + 1}/${statements.length} executed successfully`);
        } catch (error) {
          if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_DUP_KEYNAME') {
            console.log(`⚠️  Statement ${i + 1}/${statements.length} skipped (already exists)`);
          } else {
            console.error(`❌ Statement ${i + 1}/${statements.length} failed:`, error.message);
            throw error;
          }
        }
      }
    }
    
    // Verify tables were created
    const [tables] = await connection.execute(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = ?',
      [DB_CONFIG.database]
    );
    
    const expectedTables = ['users', 'servers', 'players', 'player_stats', 'player_balances', 'server_events'];
    const createdTables = tables.map(row => row.table_name);
    
    console.log('\n📊 Database verification:');
    for (const table of expectedTables) {
      if (createdTables.includes(table)) {
        console.log(`✅ Table '${table}' exists`);
      } else {
        console.log(`❌ Table '${table}' missing`);
      }
    }
    
    // Test database connection
    const [result] = await connection.execute('SELECT 1 as test');
    if (result[0].test === 1) {
      console.log('✅ Database connection test successful');
    }
    
    console.log('\n🎉 Database initialization completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Set up environment variables for database connection');
    console.log('2. Create a user account in the database');
    console.log('3. Start the application');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Database Initialization Script

Usage: node scripts/init-database.js [options]

Options:
  --help, -h     Show this help message
  --force        Force recreation of database (WARNING: This will delete all data!)

Environment Variables:
  DB_HOST        Database host (default: localhost)
  DB_PORT        Database port (default: 3306)
  DB_USER        Database user (default: root)
  DB_PASSWORD    Database password (default: empty)
  DB_NAME        Database name (default: zentro_gaming_hub)

Examples:
  node scripts/init-database.js
  DB_HOST=localhost DB_USER=zentro_user DB_PASSWORD=secret node scripts/init-database.js
  `);
  process.exit(0);
}

if (process.argv.includes('--force')) {
  console.log('⚠️  Force mode enabled - this will delete all existing data!');
  // Add force logic here if needed
}

// Run initialization
initializeDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
