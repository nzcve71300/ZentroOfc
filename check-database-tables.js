#!/usr/bin/env node

/**
 * Check Database Tables Script
 * 
 * This script checks what tables exist in the database
 * to help fix the configs API endpoint.
 */

require('dotenv').config();
const pool = require('./src/db/index');

async function checkTables() {
  try {
    console.log('🔍 Checking database tables...\n');
    
    // Get all tables
    const [tables] = await pool.query('SHOW TABLES');
    
    console.log('📋 Available tables:');
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`   ${index + 1}. ${tableName}`);
    });
    
    console.log('\n🔍 Checking for server-related tables...');
    
    // Check for various server table names
    const serverTableNames = ['servers', 'unified_servers', 'rust_servers'];
    
    for (const tableName of serverTableNames) {
      try {
        const [rows] = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        console.log(`✅ Table '${tableName}' exists with ${rows[0].count} rows`);
        
        // Show sample data
        const [sample] = await pool.query(`SELECT * FROM ${tableName} LIMIT 3`);
        console.log(`   Sample data:`, sample);
        
      } catch (error) {
        console.log(`❌ Table '${tableName}' does not exist`);
      }
    }
    
    console.log('\n🔍 Checking for configuration tables...');
    
    const configTableNames = [
      'eco_games_config',
      'teleport_configs', 
      'event_configs',
      'rider_config',
      'recycler_configs',
      'home_teleport_configs',
      'prison_configs',
      'position_configs',
      'crate_event_configs',
      'zorp_configs'
    ];
    
    for (const tableName of configTableNames) {
      try {
        const [rows] = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        console.log(`✅ Config table '${tableName}' exists with ${rows[0].count} rows`);
      } catch (error) {
        console.log(`❌ Config table '${tableName}' does not exist`);
      }
    }
    
    await pool.end();
    console.log('\n✅ Database check complete!');
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
    process.exit(1);
  }
}

checkTables();
