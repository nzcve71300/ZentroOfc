const pool = require('./src/db');

/**
 * Investigate database triggers that might be interfering with Discord ID updates
 */

async function investigateTriggers() {
  console.log('🔍 INVESTIGATING DATABASE TRIGGERS');
  console.log('==================================');
  
  try {
    // Step 1: Check for triggers on the players table
    console.log('\n📊 Step 1: Checking for triggers on players table...');
    
    const [triggers] = await pool.query(`
      SELECT 
        TRIGGER_NAME,
        EVENT_MANIPULATION,
        ACTION_TIMING,
        ACTION_STATEMENT
      FROM INFORMATION_SCHEMA.TRIGGERS 
      WHERE EVENT_OBJECT_TABLE = 'players'
      AND EVENT_OBJECT_SCHEMA = DATABASE()
    `);
    
    if (triggers.length > 0) {
      console.log(`Found ${triggers.length} triggers on players table:`);
      for (const trigger of triggers) {
        console.log(`  📌 ${trigger.TRIGGER_NAME}`);
        console.log(`     Event: ${trigger.EVENT_MANIPULATION}`);
        console.log(`     Timing: ${trigger.ACTION_TIMING}`);
        console.log(`     Statement: ${trigger.ACTION_STATEMENT}`);
        console.log('');
      }
    } else {
      console.log('✅ No triggers found on players table');
    }
    
    // Step 2: Check for stored procedures that might be called
    console.log('\n📊 Step 2: Checking for stored procedures...');
    
    const [procedures] = await pool.query(`
      SELECT 
        ROUTINE_NAME,
        ROUTINE_TYPE,
        ROUTINE_DEFINITION
      FROM INFORMATION_SCHEMA.ROUTINES 
      WHERE ROUTINE_SCHEMA = DATABASE()
      AND ROUTINE_TYPE = 'PROCEDURE'
    `);
    
    if (procedures.length > 0) {
      console.log(`Found ${procedures.length} stored procedures:`);
      for (const proc of procedures) {
        console.log(`  📌 ${proc.ROUTINE_NAME}`);
        console.log(`     Type: ${proc.ROUTINE_TYPE}`);
        console.log(`     Definition: ${proc.ROUTINE_DEFINITION.substring(0, 200)}...`);
        console.log('');
      }
    } else {
      console.log('✅ No stored procedures found');
    }
    
    // Step 3: Check for foreign key constraints
    console.log('\n📊 Step 3: Checking for foreign key constraints...');
    
    const [foreignKeys] = await pool.query(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_NAME = 'players'
      AND TABLE_SCHEMA = DATABASE()
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    
    if (foreignKeys.length > 0) {
      console.log(`Found ${foreignKeys.length} foreign key constraints:`);
      for (const fk of foreignKeys) {
        console.log(`  📌 ${fk.CONSTRAINT_NAME}`);
        console.log(`     Column: ${fk.COLUMN_NAME}`);
        console.log(`     References: ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
        console.log('');
      }
    } else {
      console.log('✅ No foreign key constraints found');
    }
    
    // Step 4: Check for any views that might be interfering
    console.log('\n📊 Step 4: Checking for views...');
    
    const [views] = await pool.query(`
      SELECT 
        TABLE_NAME,
        VIEW_DEFINITION
      FROM INFORMATION_SCHEMA.VIEWS 
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME LIKE '%player%'
    `);
    
    if (views.length > 0) {
      console.log(`Found ${views.length} views related to players:`);
      for (const view of views) {
        console.log(`  📌 ${view.TABLE_NAME}`);
        console.log(`     Definition: ${view.VIEW_DEFINITION.substring(0, 200)}...`);
        console.log('');
      }
    } else {
      console.log('✅ No player-related views found');
    }
    
    // Step 5: Test a simple update to see what happens
    console.log('\n📊 Step 5: Testing a simple update...');
    
    console.log('Testing update to a different Discord ID...');
    const testResult = await pool.query(`
      UPDATE players 
      SET discord_id = 999999999999999999
      WHERE id = 18508
    `);
    
    console.log(`Test update result: ${testResult[0].affectedRows} rows affected`);
    
    // Check what the Discord ID is now
    const [testRecord] = await pool.query(`
      SELECT discord_id FROM players WHERE id = 18508
    `);
    
    console.log(`Discord ID after test update: ${testRecord[0].discord_id}`);
    
    // Revert the test
    await pool.query(`
      UPDATE players 
      SET discord_id = 899414980355571700
      WHERE id = 18508
    `);
    
    console.log('✅ Test update reverted');
    
  } catch (error) {
    console.error('❌ Error investigating triggers:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the investigation
if (require.main === module) {
  investigateTriggers()
    .then(() => {
      console.log('\n✅ Trigger investigation completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Trigger investigation failed:', error);
      process.exit(1);
    });
}

module.exports = { investigateTriggers };
