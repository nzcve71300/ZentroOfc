#!/usr/bin/env node

/**
 * Add Combat Lock Fields Script
 * 
 * This script adds combat lock fields to teleport_configs and position_configs tables
 * to implement the combat lock feature for all teleports
 */

require('dotenv').config();
const pool = require('./src/db/index');

async function addCombatLockFields() {
  try {
    console.log('🔧 Adding combat lock fields to teleport and position configs...\n');
    
    // Add combat lock fields to teleport_configs table
    console.log('📊 Adding combat lock fields to teleport_configs table...');
    
    try {
      await pool.query(`
        ALTER TABLE teleport_configs 
        ADD COLUMN combat_lock_enabled BOOLEAN DEFAULT TRUE,
        ADD COLUMN combat_lock_time_minutes INT DEFAULT 5
      `);
      console.log('✅ Added combat lock fields to teleport_configs');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️ Combat lock fields already exist in teleport_configs');
      } else {
        throw error;
      }
    }
    
    // Add combat lock fields to position_configs table (Outpost/Bandit Camp)
    console.log('📊 Adding combat lock fields to position_configs table...');
    
    try {
      await pool.query(`
        ALTER TABLE position_configs 
        ADD COLUMN combat_lock_enabled BOOLEAN DEFAULT TRUE,
        ADD COLUMN combat_lock_time_minutes INT DEFAULT 5
      `);
      console.log('✅ Added combat lock fields to position_configs');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️ Combat lock fields already exist in position_configs');
      } else {
        throw error;
      }
    }
    
    // Create combat_tracking table to track player kills
    console.log('📊 Creating combat_tracking table...');
    
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS combat_tracking (
          id INT AUTO_INCREMENT PRIMARY KEY,
          server_id VARCHAR(32) NOT NULL,
          killer_name VARCHAR(255) NOT NULL,
          victim_name VARCHAR(255) NOT NULL,
          kill_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          combat_lock_until TIMESTAMP NOT NULL,
          INDEX idx_server_killer (server_id, killer_name),
          INDEX idx_combat_lock_until (combat_lock_until),
          INDEX idx_kill_timestamp (kill_timestamp)
        )
      `);
      console.log('✅ Created combat_tracking table');
    } catch (error) {
      if (error.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('⚠️ combat_tracking table already exists');
      } else {
        throw error;
      }
    }
    
    // Verify the changes
    console.log('\n🔍 Verifying table structures...');
    
    const [teleportColumns] = await pool.query('DESCRIBE teleport_configs');
    const combatLockFields = teleportColumns.filter(col => col.Field.includes('combat_lock'));
    console.log(`📋 teleport_configs combat lock fields: ${combatLockFields.map(f => f.Field).join(', ')}`);
    
    const [positionColumns] = await pool.query('DESCRIBE position_configs');
    const positionCombatFields = positionColumns.filter(col => col.Field.includes('combat_lock'));
    console.log(`📋 position_configs combat lock fields: ${positionCombatFields.map(f => f.Field).join(', ')}`);
    
    const [combatTableExists] = await pool.query('SHOW TABLES LIKE "combat_tracking"');
    console.log(`📋 combat_tracking table exists: ${combatTableExists.length > 0 ? 'Yes' : 'No'}`);
    
    console.log('\n🎉 Combat lock fields added successfully!');
    console.log('\n📋 Summary:');
    console.log('- ✅ Added combat_lock_enabled (default: TRUE) to teleport_configs');
    console.log('- ✅ Added combat_lock_time_minutes (default: 5) to teleport_configs');
    console.log('- ✅ Added combat_lock_enabled (default: TRUE) to position_configs');
    console.log('- ✅ Added combat_lock_time_minutes (default: 5) to position_configs');
    console.log('- ✅ Created combat_tracking table for kill tracking');
    console.log('- ✅ Ready for combat lock implementation');
    
  } catch (error) {
    console.error('❌ Error adding combat lock fields:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the migration
addCombatLockFields();
