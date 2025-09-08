const pool = require('./src/db');

/**
 * Investigate why Discord ID updates are not working
 */

async function investigateDiscordIdIssue() {
  console.log('🔍 INVESTIGATING DISCORD ID UPDATE ISSUE');
  console.log('=========================================');
  
  try {
    // Step 1: Check for triggers
    console.log('\n📊 Step 1: Checking for triggers...');
    
    const [triggers] = await pool.query(`
      SELECT TRIGGER_NAME, EVENT_MANIPULATION, ACTION_STATEMENT, ACTION_TIMING
      FROM INFORMATION_SCHEMA.TRIGGERS 
      WHERE EVENT_OBJECT_TABLE = 'players'
    `);
    
    if (triggers.length > 0) {
      console.log('Found triggers on players table:');
      for (const trigger of triggers) {
        console.log(`  ${trigger.TRIGGER_NAME}: ${trigger.EVENT_MANIPULATION} ${trigger.ACTION_TIMING}`);
        console.log(`    Statement: ${trigger.ACTION_STATEMENT}`);
      }
    } else {
      console.log('✅ No triggers found on players table');
    }
    
    // Step 2: Check for stored procedures
    console.log('\n📊 Step 2: Checking for stored procedures...');
    
    const [procedures] = await pool.query(`
      SELECT ROUTINE_NAME, ROUTINE_DEFINITION
      FROM INFORMATION_SCHEMA.ROUTINES 
      WHERE ROUTINE_SCHEMA = DATABASE()
      AND ROUTINE_TYPE = 'PROCEDURE'
    `);
    
    if (procedures.length > 0) {
      console.log('Found stored procedures:');
      for (const proc of procedures) {
        console.log(`  ${proc.ROUTINE_NAME}`);
      }
    } else {
      console.log('✅ No stored procedures found');
    }
    
    // Step 3: Test the exact values
    console.log('\n📊 Step 3: Testing exact values...');
    
    const targetDiscordId = 899414980355571712;
    const currentDiscordId = 899414980355571700;
    
    console.log(`Target Discord ID: ${targetDiscordId}`);
    console.log(`Current Discord ID: ${currentDiscordId}`);
    console.log(`Difference: ${targetDiscordId - currentDiscordId}`);
    console.log(`Target as string: "${String(targetDiscordId)}"`);
    console.log(`Current as string: "${String(currentDiscordId)}"`);
    
    // Step 4: Try a simple test update
    console.log('\n📊 Step 4: Testing simple update...');
    
    // First, let's try updating to a completely different value to see if updates work at all
    const testDiscordId = 999999999999999999;
    
    console.log(`Testing update to: ${testDiscordId}`);
    
    const testUpdateResult = await pool.query(`
      UPDATE players 
      SET discord_id = ?
      WHERE id = 18508
    `, [testDiscordId]);
    
    console.log(`Test update result: ${testUpdateResult[0].affectedRows} rows affected`);
    
    // Check if the test update worked
    const [testRecord] = await pool.query(`
      SELECT discord_id FROM players WHERE id = 18508
    `);
    
    console.log(`After test update, discord_id is: ${testRecord[0].discord_id}`);
    
    if (testRecord[0].discord_id == testDiscordId) {
      console.log('✅ Test update worked - updates are possible');
      
      // Now try the actual target value
      console.log('\n📊 Step 5: Trying actual target value...');
      
      const actualUpdateResult = await pool.query(`
        UPDATE players 
        SET discord_id = ?
        WHERE id = 18508
      `, [targetDiscordId]);
      
      console.log(`Actual update result: ${actualUpdateResult[0].affectedRows} rows affected`);
      
      // Check the result
      const [actualRecord] = await pool.query(`
        SELECT discord_id FROM players WHERE id = 18508
      `);
      
      console.log(`After actual update, discord_id is: ${actualRecord[0].discord_id}`);
      
      if (actualRecord[0].discord_id == targetDiscordId) {
        console.log('🎉 SUCCESS: Discord ID updated to target value!');
      } else {
        console.log('❌ ISSUE: Discord ID was not updated to target value');
        console.log(`Expected: ${targetDiscordId}`);
        console.log(`Actual: ${actualRecord[0].discord_id}`);
        
        // Check if it reverted to the original value
        if (actualRecord[0].discord_id == currentDiscordId) {
          console.log('⚠️ Discord ID reverted to original value - there may be a trigger or constraint');
        }
      }
      
    } else {
      console.log('❌ Test update failed - there may be a fundamental issue');
    }
    
    // Step 6: Check for any foreign key constraints
    console.log('\n📊 Step 6: Checking for foreign key constraints...');
    
    const [foreignKeys] = await pool.query(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_NAME = 'players' 
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    
    if (foreignKeys.length > 0) {
      console.log('Found foreign key constraints:');
      for (const fk of foreignKeys) {
        console.log(`  ${fk.CONSTRAINT_NAME}: ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
      }
    } else {
      console.log('✅ No foreign key constraints found');
    }
    
    // Step 7: Final status
    console.log('\n📊 Step 7: Final status...');
    
    const [finalRecord] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.id = 18508
    `);
    
    if (finalRecord.length > 0) {
      const record = finalRecord[0];
      console.log('Final Clap2000777 record:');
      console.log(`  ID: ${record.id}`);
      console.log(`  IGN: "${record.ign}"`);
      console.log(`  Discord ID: ${record.discord_id}`);
      console.log(`  Active: ${record.is_active}`);
      console.log(`  Balance: ${record.balance || 0}`);
      console.log(`  Server: ${record.nickname || 'Unknown'}`);
    }
    
  } catch (error) {
    console.error('❌ Error during investigation:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the investigation
if (require.main === module) {
  investigateDiscordIdIssue()
    .then(() => {
      console.log('\n✅ Investigation completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Investigation failed:', error);
      process.exit(1);
    });
}

module.exports = { investigateDiscordIdIssue };