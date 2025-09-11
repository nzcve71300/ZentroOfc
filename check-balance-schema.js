#!/usr/bin/env node

/**
 * Check Balance Schema Script
 * 
 * This script checks the database schema to understand
 * the correct column types for player_balances table
 */

require('dotenv').config();
const pool = require('./src/db/index');

async function checkBalanceSchema() {
  try {
    console.log('🔍 Checking player_balances table schema...\n');
    
    // Check table structure
    const [tableStructure] = await pool.query('DESCRIBE player_balances');
    
    console.log('📊 player_balances table structure:');
    tableStructure.forEach((column, index) => {
      console.log(`   ${index + 1}. ${column.Field}: ${column.Type} (${column.Null}, ${column.Key}, ${column.Default || 'NULL'})`);
    });
    
    // Check if there are any existing balance entries to see the pattern
    const [existingBalances] = await pool.query(`
      SELECT pb.*, p.server_id as player_server_id
      FROM player_balances pb
      JOIN players p ON pb.player_id = p.id
      LIMIT 5
    `);
    
    console.log('\n📋 Sample existing balance entries:');
    existingBalances.forEach((balance, index) => {
      console.log(`   ${index + 1}. Player ID=${balance.player_id}, Balance Server=${balance.server_id}, Player Server=${balance.player_server_id}, Balance=${balance.balance}`);
    });
    
    // Check if server_id in player_balances should match players.server_id or something else
    console.log('\n🔍 Checking relationship patterns...');
    
    // Check if there are any balance entries that work
    const [workingBalances] = await pool.query(`
      SELECT COUNT(*) as count
      FROM player_balances pb
      WHERE pb.server_id IS NOT NULL
    `);
    
    console.log(`   Balance entries with server_id: ${workingBalances[0].count}`);
    
    // Check if we should use a different approach
    const [nullBalances] = await pool.query(`
      SELECT COUNT(*) as count
      FROM player_balances pb
      WHERE pb.server_id IS NULL
    `);
    
    console.log(`   Balance entries with NULL server_id: ${nullBalances[0].count}`);
    
    console.log('\n💡 Recommendation:');
    if (nullBalances[0].count > 0) {
      console.log('   - Use NULL for server_id in player_balances');
      console.log('   - The relationship is through player_id only');
    } else {
      console.log('   - Need to find the correct server_id mapping');
    }
    
  } catch (error) {
    console.error('❌ Error checking schema:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the check
checkBalanceSchema();
