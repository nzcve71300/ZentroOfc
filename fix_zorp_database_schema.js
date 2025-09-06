#!/usr/bin/env node

/**
 * Fix Zorp Database Schema - Add Missing State Management Columns
 * This script adds the missing columns that the monitorZorpZonesRockSolid function expects
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixZorpDatabaseSchema() {
  let connection;
  
  try {
    console.log('🔧 Fixing Zorp database schema...');
    
    // Create database connection using the same config as the bot
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'zentro',
      charset: 'utf8mb4'
    });
    
    console.log('✅ Connected to database');
    
    // Check if columns already exist
    console.log('🔍 Checking existing columns...');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'zorp_zones' 
      AND COLUMN_NAME IN ('desired_state', 'applied_state', 'last_offline_at', 'last_online_at', 'color_yellow')
    `);
    
    const existingColumns = columns.map(row => row.COLUMN_NAME);
    console.log(`📋 Existing columns: ${existingColumns.join(', ') || 'none'}`);
    
    // Add missing columns
    const columnsToAdd = [
      {
        name: 'desired_state',
        definition: "ENUM('white', 'green', 'yellow', 'red') DEFAULT 'white'",
        comment: 'The state the zone should be in (managed by monitoring system)'
      },
      {
        name: 'applied_state', 
        definition: "ENUM('white', 'green', 'yellow', 'red') DEFAULT 'white'",
        comment: 'The state currently applied in the game'
      },
      {
        name: 'last_offline_at',
        definition: 'TIMESTAMP NULL',
        comment: 'When the player last went offline (used for yellow->red transition timing)'
      },
      {
        name: 'last_online_at',
        definition: 'TIMESTAMP NULL', 
        comment: 'When the player last came online (used for green state management)'
      },
      {
        name: 'color_yellow',
        definition: "TEXT DEFAULT '255,255,0'",
        comment: 'RGB color for yellow state (format: r,g,b)'
      }
    ];
    
    for (const column of columnsToAdd) {
      if (!existingColumns.includes(column.name)) {
        console.log(`➕ Adding column: ${column.name}`);
        await connection.execute(`
          ALTER TABLE zorp_zones 
          ADD COLUMN ${column.name} ${column.definition}
        `);
        
        // Add comment
        await connection.execute(`
          ALTER TABLE zorp_zones 
          MODIFY COLUMN ${column.name} ${column.definition} 
          COMMENT '${column.comment}'
        `);
        
        console.log(`✅ Added column: ${column.name}`);
      } else {
        console.log(`⏭️  Column already exists: ${column.name}`);
      }
    }
    
    // Update existing records to have proper initial states
    console.log('🔄 Updating existing records...');
    const [updateResult] = await connection.execute(`
      UPDATE zorp_zones 
      SET desired_state = COALESCE(current_state, 'green'),
          applied_state = COALESCE(current_state, 'green'),
          last_online_at = COALESCE(last_online_at, created_at)
      WHERE desired_state IS NULL OR applied_state IS NULL
    `);
    
    console.log(`✅ Updated ${updateResult.affectedRows} existing records`);
    
    // Add indexes for better performance
    console.log('📊 Adding performance indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_zorp_zones_desired_state ON zorp_zones(desired_state)',
      'CREATE INDEX IF NOT EXISTS idx_zorp_zones_applied_state ON zorp_zones(applied_state)', 
      'CREATE INDEX IF NOT EXISTS idx_zorp_zones_last_offline_at ON zorp_zones(last_offline_at)',
      'CREATE INDEX IF NOT EXISTS idx_zorp_zones_last_online_at ON zorp_zones(last_online_at)'
    ];
    
    for (const indexQuery of indexes) {
      try {
        await connection.execute(indexQuery);
        console.log(`✅ Added index: ${indexQuery.split(' ')[5]}`);
      } catch (error) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`⏭️  Index already exists: ${indexQuery.split(' ')[5]}`);
        } else {
          console.log(`⚠️  Index creation warning: ${error.message}`);
        }
      }
    }
    
    // Verify the changes
    console.log('🔍 Verifying changes...');
    const [verifyColumns] = await connection.execute(`
      SELECT 
          COLUMN_NAME, 
          DATA_TYPE, 
          IS_NULLABLE, 
          COLUMN_DEFAULT,
          COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'zorp_zones' 
      AND COLUMN_NAME IN ('desired_state', 'applied_state', 'last_offline_at', 'last_online_at', 'color_yellow')
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('\n📋 Updated columns:');
    verifyColumns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? 'nullable' : 'not null'}) - ${col.COLUMN_COMMENT}`);
    });
    
    // Show current state of zones
    console.log('\n🎯 Current zone states:');
    const [zones] = await connection.execute(`
      SELECT 
          name,
          owner,
          current_state,
          desired_state,
          applied_state,
          last_online_at,
          last_offline_at,
          created_at
      FROM zorp_zones 
      WHERE created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (zones.length > 0) {
      console.log('Active zones:');
      zones.forEach(zone => {
        console.log(`  - ${zone.name} (${zone.owner}): current=${zone.current_state}, desired=${zone.desired_state}, applied=${zone.applied_state}`);
      });
    } else {
      console.log('  No active zones found');
    }
    
    console.log('\n✅ Zorp database schema fix completed successfully!');
    console.log('🎮 The offline detection system should now work properly.');
    
  } catch (error) {
    console.error('❌ Error fixing Zorp database schema:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the fix
if (require.main === module) {
  fixZorpDatabaseSchema()
    .then(() => {
      console.log('🎉 Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixZorpDatabaseSchema };
