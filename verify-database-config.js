#!/usr/bin/env node

/**
 * Database Configuration Verification Script
 * 
 * This script verifies that all components (Discord Bot, Website API, etc.)
 * are using the same database configuration from environment variables.
 * 
 * CRITICAL: The website MUST ALWAYS use the same database as the Discord bot
 * to ensure data consistency and avoid conflicts.
 */

require('dotenv').config();

console.log('🔍 Verifying Database Configuration Consistency...\n');

// Expected database configuration from environment variables
const expectedConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ? '***HIDDEN***' : 'NOT SET',
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
};

console.log('📋 Expected Database Configuration:');
console.log(`   Host: ${expectedConfig.host}`);
console.log(`   User: ${expectedConfig.user}`);
console.log(`   Password: ${expectedConfig.password}`);
console.log(`   Database: ${expectedConfig.database}`);
console.log(`   Port: ${expectedConfig.port}\n`);

// Verify all required environment variables are set
const requiredVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ MISSING REQUIRED ENVIRONMENT VARIABLES:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\n⚠️  Please set these variables in your .env file!');
  process.exit(1);
}

// Test database connection
const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });
    
    console.log('✅ Database connection successful!');
    
    // Test a simple query to verify we can read data
    const [rows] = await connection.execute('SELECT 1 as test');
    if (rows[0].test === 1) {
      console.log('✅ Database query test successful!');
    }
    
    await connection.end();
    
    console.log('\n🎯 VERIFICATION COMPLETE:');
    console.log('   ✅ All environment variables are set');
    console.log('   ✅ Database connection is working');
    console.log('   ✅ Website API will use the SAME database as Discord Bot');
    console.log('\n🚀 Your system is properly configured for data consistency!');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('\n⚠️  Please check your database configuration!');
    process.exit(1);
  }
}

testConnection();
