const pool = require('./src/db');

/**
 * Debug Discord ID update issue by checking raw database state
 */

async function debugDiscordIdUpdate() {
  console.log('🔍 DEBUGGING DISCORD ID UPDATE ISSUE');
  console.log('====================================');
  
  try {
    // Step 1: Check raw database state before update
    console.log('\n📊 Step 1: Raw database state BEFORE update...');
    
    const [beforeUpdate] = await pool.query(`
      SELECT id, ign, discord_id, is_active, linked_at, updated_at
      FROM players 
      WHERE id = 18508
    `);
    
    if (beforeUpdate.length > 0) {
      const record = beforeUpdate[0];
      console.log('Raw record before update:');
      console.log(`  ID: ${record.id}`);
      console.log(`  IGN: "${record.ign}"`);
      console.log(`  Discord ID: ${record.discord_id}`);
      console.log(`  Active: ${record.is_active}`);
      console.log(`  Linked At: ${record.linked_at}`);
      console.log(`  Updated At: ${record.updated_at}`);
    }
    
    // Step 2: Check if there are any triggers that might be reverting the change
    console.log('\n📊 Step 2: Checking for UPDATE triggers...');
    
    const [updateTriggers] = await pool.query(`
      SELECT 
        TRIGGER_NAME,
        EVENT_MANIPULATION,
        ACTION_TIMING,
        ACTION_STATEMENT
      FROM INFORMATION_SCHEMA.TRIGGERS 
      WHERE EVENT_OBJECT_TABLE = 'players'
      AND EVENT_OBJECT_SCHEMA = DATABASE()
      AND EVENT_MANIPULATION = 'UPDATE'
    `);
    
    if (updateTriggers.length > 0) {
      console.log(`Found ${updateTriggers.length} UPDATE triggers:`);
      for (const trigger of updateTriggers) {
        console.log(`  📌 ${trigger.TRIGGER_NAME}`);
        console.log(`     Statement: ${trigger.ACTION_STATEMENT}`);
        console.log('');
      }
    } else {
      console.log('✅ No UPDATE triggers found');
    }
    
    // Step 3: Try a different approach - update with a completely different Discord ID first
    console.log('\n📊 Step 3: Testing with a different Discord ID...');
    
    const testDiscordId = 888888888888888888;
    
    console.log(`Testing update to Discord ID: ${testDiscordId}`);
    const testResult = await pool.query(`
      UPDATE players 
      SET discord_id = ?,
          linked_at = CURRENT_TIMESTAMP
      WHERE id = 18508
    `, [testDiscordId]);
    
    console.log(`Test update result: ${testResult[0].affectedRows} rows affected, ${testResult[0].changedRows} changed`);
    
    // Check what the Discord ID is now
    const [testRecord] = await pool.query(`
      SELECT id, ign, discord_id, is_active, linked_at, updated_at
      FROM players 
      WHERE id = 18508
    `);
    
    if (testRecord.length > 0) {
      const record = testRecord[0];
      console.log('Raw record after test update:');
      console.log(`  ID: ${record.id}`);
      console.log(`  IGN: "${record.ign}"`);
      console.log(`  Discord ID: ${record.discord_id}`);
      console.log(`  Active: ${record.is_active}`);
      console.log(`  Linked At: ${record.linked_at}`);
      console.log(`  Updated At: ${record.updated_at}`);
      
      if (record.discord_id == testDiscordId) {
        console.log('✅ Test update worked! Now trying target Discord ID...');
        
        // Now try the target Discord ID
        const targetResult = await pool.query(`
          UPDATE players 
          SET discord_id = 899414980355571712,
              linked_at = CURRENT_TIMESTAMP
          WHERE id = 18508
        `);
        
        console.log(`Target update result: ${targetResult[0].affectedRows} rows affected, ${targetResult[0].changedRows} changed`);
        
        // Check final state
        const [finalRecord] = await pool.query(`
          SELECT id, ign, discord_id, is_active, linked_at, updated_at
          FROM players 
          WHERE id = 18508
        `);
        
        if (finalRecord.length > 0) {
          const record = finalRecord[0];
          console.log('Raw record after target update:');
          console.log(`  ID: ${record.id}`);
          console.log(`  IGN: "${record.ign}"`);
          console.log(`  Discord ID: ${record.discord_id}`);
          console.log(`  Active: ${record.is_active}`);
          console.log(`  Linked At: ${record.linked_at}`);
          console.log(`  Updated At: ${record.updated_at}`);
          
          if (record.discord_id == 899414980355571712) {
            console.log('\n🎉 SUCCESS: Discord ID updated to target value!');
          } else {
            console.log('\n❌ ISSUE: Discord ID was not updated to target value');
            console.log(`Expected: 899414980355571712`);
            console.log(`Actual: ${record.discord_id}`);
          }
        }
      } else {
        console.log('❌ Test update failed - Discord ID did not change');
        console.log(`Expected: ${testDiscordId}`);
        console.log(`Actual: ${record.discord_id}`);
      }
    }
    
    // Step 4: Check for any application-level caching or connection issues
    console.log('\n📊 Step 4: Checking for connection and caching issues...');
    
    // Try a simple SELECT to see if we're getting the right data
    const [simpleSelect] = await pool.query(`
      SELECT discord_id FROM players WHERE id = 18508
    `);
    
    console.log(`Simple SELECT result: ${simpleSelect[0].discord_id}`);
    
    // Try with a different connection
    const pool2 = require('./src/db');
    const [differentConnection] = await pool2.query(`
      SELECT discord_id FROM players WHERE id = 18508
    `);
    
    console.log(`Different connection result: ${differentConnection[0].discord_id}`);
    await pool2.end();
    
  } catch (error) {
    console.error('❌ Error debugging Discord ID update:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugDiscordIdUpdate()
    .then(() => {
      console.log('\n✅ Discord ID update debug completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Discord ID update debug failed:', error);
      process.exit(1);
    });
}

module.exports = { debugDiscordIdUpdate };
