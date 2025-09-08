const pool = require('./src/db');

/**
 * Direct fix for Clap2000777 Discord ID
 * Execute SQL directly to update the Discord ID
 */

async function fixClapDiscordDirect() {
  console.log('🔧 DIRECT FIX FOR CLAP2000777 DISCORD ID');
  console.log('=========================================');
  
  try {
    // Step 1: Show current state
    console.log('\n📊 Step 1: Current state...');
    
    const [beforeRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE LOWER(p.ign) = LOWER('Clap2000777')
      ORDER BY p.is_active DESC, p.linked_at DESC
    `);
    
    console.log('BEFORE UPDATE:');
    for (const record of beforeRecords) {
      console.log(`  ID: ${record.id}, IGN: "${record.ign}", Discord: ${record.discord_id}, Active: ${record.is_active}, Balance: ${record.balance || 0}, Server: ${record.nickname || 'Unknown'}`);
    }
    
    // Step 2: Check the table structure
    console.log('\n🔍 Step 2: Checking table structure...');
    
    const [tableInfo] = await pool.query('SHOW CREATE TABLE players');
    console.log('Players table structure:');
    console.log(tableInfo[0]['Create Table']);
    
    // Step 3: Try the update with explicit data type casting
    console.log('\n🔧 Step 3: Attempting direct update...');
    
    try {
      // Try with explicit BIGINT casting
      const updateResult = await pool.query(`
        UPDATE players 
        SET discord_id = CAST(899414980355571712 AS UNSIGNED),
            linked_at = CURRENT_TIMESTAMP
        WHERE id = 18508
      `);
      
      console.log(`✅ Update executed successfully`);
      console.log(`Rows affected: ${updateResult[0].affectedRows}`);
      console.log(`Changed rows: ${updateResult[0].changedRows}`);
      
    } catch (updateError) {
      console.log(`❌ Update failed: ${updateError.message}`);
      
      // Try alternative approach - check if the value is too large
      console.log('\n🔍 Checking if Discord ID value is valid...');
      console.log(`Target Discord ID: 899414980355571712`);
      console.log(`Discord ID length: ${String(899414980355571712).length} digits`);
      
      // Check MySQL BIGINT limits
      console.log(`MySQL BIGINT UNSIGNED max: 18446744073709551615`);
      console.log(`Our value is within limits: ${899414980355571712 < 18446744073709551615}`);
    }
    
    // Step 4: Verify the update
    console.log('\n🔍 Step 4: Verifying the update...');
    
    const [afterRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE LOWER(p.ign) = LOWER('Clap2000777')
      ORDER BY p.is_active DESC, p.linked_at DESC
    `);
    
    console.log('AFTER UPDATE:');
    for (const record of afterRecords) {
      console.log(`  ID: ${record.id}, IGN: "${record.ign}", Discord: ${record.discord_id}, Active: ${record.is_active}, Balance: ${record.balance || 0}, Server: ${record.nickname || 'Unknown'}`);
    }
    
    // Step 5: Check if the update was successful
    const activeRecord = afterRecords.find(r => r.is_active);
    if (activeRecord) {
      console.log(`\n🎯 Active record Discord ID: ${activeRecord.discord_id}`);
      console.log(`Target Discord ID: 899414980355571712`);
      
      if (activeRecord.discord_id == 899414980355571712) {
        console.log('\n🎉 SUCCESS: Discord ID updated correctly!');
      } else {
        console.log('\n❌ ISSUE: Discord ID was not updated correctly');
        console.log(`Expected: 899414980355571712`);
        console.log(`Actual: ${activeRecord.discord_id}`);
        
        // Try one more approach - check if there's a trigger or constraint
        console.log('\n🔍 Checking for triggers or constraints...');
        
        const [triggers] = await pool.query(`
          SELECT TRIGGER_NAME, EVENT_MANIPULATION, ACTION_STATEMENT 
          FROM INFORMATION_SCHEMA.TRIGGERS 
          WHERE EVENT_OBJECT_TABLE = 'players'
        `);
        
        if (triggers.length > 0) {
          console.log('Found triggers on players table:');
          for (const trigger of triggers) {
            console.log(`  ${trigger.TRIGGER_NAME}: ${trigger.EVENT_MANIPULATION}`);
          }
        } else {
          console.log('No triggers found on players table');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error in direct fix:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix
if (require.main === module) {
  fixClapDiscordDirect()
    .then(() => {
      console.log('\n✅ Direct Discord ID fix completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Direct Discord ID fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixClapDiscordDirect };
