const pool = require('./src/db');

/**
 * Simple debug for Discord ID update issue
 */

async function debugDiscordIdSimple() {
  console.log('🔍 SIMPLE DISCORD ID UPDATE DEBUG');
  console.log('==================================');
  
  try {
    // Step 1: Check current state
    console.log('\n📊 Step 1: Current state...');
    
    const [currentRecord] = await pool.query(`
      SELECT id, ign, discord_id, is_active, linked_at
      FROM players 
      WHERE id = 18508
    `);
    
    if (currentRecord.length > 0) {
      const record = currentRecord[0];
      console.log('Current record:');
      console.log(`  ID: ${record.id}`);
      console.log(`  IGN: "${record.ign}"`);
      console.log(`  Discord ID: ${record.discord_id}`);
      console.log(`  Active: ${record.is_active}`);
      console.log(`  Linked At: ${record.linked_at}`);
    }
    
    // Step 2: Try updating to a test Discord ID
    console.log('\n📊 Step 2: Testing with a different Discord ID...');
    
    const testDiscordId = 777777777777777777;
    
    console.log(`Updating to test Discord ID: ${testDiscordId}`);
    const testResult = await pool.query(`
      UPDATE players 
      SET discord_id = ?
      WHERE id = 18508
    `, [testDiscordId]);
    
    console.log(`Test update result: ${testResult[0].affectedRows} rows affected, ${testResult[0].changedRows} changed`);
    
    // Check what happened
    const [testRecord] = await pool.query(`
      SELECT discord_id FROM players WHERE id = 18508
    `);
    
    console.log(`Discord ID after test update: ${testRecord[0].discord_id}`);
    
    if (testRecord[0].discord_id == testDiscordId) {
      console.log('✅ Test update worked! Now trying target Discord ID...');
      
      // Now try the target Discord ID
      const targetResult = await pool.query(`
        UPDATE players 
        SET discord_id = 899414980355571712
        WHERE id = 18508
      `);
      
      console.log(`Target update result: ${targetResult[0].affectedRows} rows affected, ${targetResult[0].changedRows} changed`);
      
      // Check final state
      const [finalRecord] = await pool.query(`
        SELECT discord_id FROM players WHERE id = 18508
      `);
      
      console.log(`Discord ID after target update: ${finalRecord[0].discord_id}`);
      
      if (finalRecord[0].discord_id == 899414980355571712) {
        console.log('\n🎉 SUCCESS: Discord ID updated to target value!');
      } else {
        console.log('\n❌ ISSUE: Discord ID was not updated to target value');
        console.log(`Expected: 899414980355571712`);
        console.log(`Actual: ${finalRecord[0].discord_id}`);
      }
    } else {
      console.log('❌ Test update failed - Discord ID did not change');
      console.log(`Expected: ${testDiscordId}`);
      console.log(`Actual: ${testRecord[0].discord_id}`);
    }
    
    // Step 3: Check if there are any constraints preventing the update
    console.log('\n📊 Step 3: Checking for unique constraints...');
    
    const [constraints] = await pool.query(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        CONSTRAINT_TYPE
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_NAME = 'players'
      AND TABLE_SCHEMA = DATABASE()
      AND CONSTRAINT_TYPE = 'UNIQUE'
    `);
    
    if (constraints.length > 0) {
      console.log(`Found ${constraints.length} unique constraints:`);
      for (const constraint of constraints) {
        console.log(`  📌 ${constraint.CONSTRAINT_NAME} on ${constraint.COLUMN_NAME}`);
      }
    } else {
      console.log('✅ No unique constraints found');
    }
    
    // Step 4: Check if the target Discord ID exists anywhere else
    console.log('\n📊 Step 4: Checking if target Discord ID exists elsewhere...');
    
    const [existingRecords] = await pool.query(`
      SELECT id, ign, discord_id, is_active
      FROM players 
      WHERE discord_id = 899414980355571712
      AND id != 18508
    `);
    
    if (existingRecords.length > 0) {
      console.log(`Found ${existingRecords.length} other records with target Discord ID:`);
      for (const record of existingRecords) {
        console.log(`  ID: ${record.id}, IGN: "${record.ign}", Active: ${record.is_active}`);
      }
    } else {
      console.log('✅ No other records found with target Discord ID');
    }
    
  } catch (error) {
    console.error('❌ Error debugging Discord ID update:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugDiscordIdSimple()
    .then(() => {
      console.log('\n✅ Simple Discord ID update debug completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Simple Discord ID update debug failed:', error);
      process.exit(1);
    });
}

module.exports = { debugDiscordIdSimple };
