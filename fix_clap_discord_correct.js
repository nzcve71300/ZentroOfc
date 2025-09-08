const pool = require('./src/db');

/**
 * Fix Clap2000777 Discord ID with the CORRECT target value
 * Target: 899414980355571712 (not 899414980355571700)
 */

async function fixClapDiscordCorrect() {
  console.log('🔧 FIXING CLAP2000777 DISCORD ID - CORRECT TARGET');
  console.log('=================================================');
  
  try {
    // Step 1: Show current state
    console.log('\n📊 Step 1: Current state...');
    
    const [clapRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE LOWER(p.ign) = LOWER('Clap2000777')
      ORDER BY p.is_active DESC, p.linked_at DESC
    `);
    
    console.log('Current Clap2000777 records:');
    for (const record of clapRecords) {
      console.log(`  ID: ${record.id}, IGN: "${record.ign}", Discord: ${record.discord_id}, Active: ${record.is_active}, Balance: ${record.balance || 0}, Server: ${record.nickname || 'Unknown'}`);
    }
    
    // Step 2: Find the active record we want to update
    const activeRecord = clapRecords.find(r => r.is_active && r.balance > 0);
    
    if (!activeRecord) {
      console.log('❌ No active Clap2000777 record with balance found!');
      return;
    }
    
    console.log(`\n🎯 Target record: ID ${activeRecord.id} on ${activeRecord.nickname}`);
    console.log(`Current Discord ID: ${activeRecord.discord_id}`);
    console.log(`Target Discord ID: 899414980355571712`);
    
    // Step 3: Check for conflicts with the CORRECT target Discord ID
    console.log('\n🔍 Step 3: Checking for conflicts with target Discord ID...');
    
    const [conflictRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.discord_id = 899414980355571712
      AND p.id != ?
    `, [activeRecord.id]);
    
    if (conflictRecords.length > 0) {
      console.log(`Found ${conflictRecords.length} records with target Discord ID 899414980355571712:`);
      for (const record of conflictRecords) {
        console.log(`  ID: ${record.id}, IGN: "${record.ign}", Active: ${record.is_active}, Balance: ${record.balance || 0}, Server: ${record.nickname || 'Unknown'}`);
      }
      
      // Deactivate conflicting active records
      const activeConflicts = conflictRecords.filter(r => r.is_active);
      if (activeConflicts.length > 0) {
        console.log(`\n🔧 Deactivating ${activeConflicts.length} conflicting active records...`);
        for (const record of activeConflicts) {
          await pool.query(`
            UPDATE players 
            SET is_active = false, 
                unlinked_at = CURRENT_TIMESTAMP,
                unlink_reason = 'Deactivated to fix Clap2000777 Discord ID conflict'
            WHERE id = ?
          `, [record.id]);
          
          console.log(`  ✅ Deactivated record ID ${record.id} (IGN: "${record.ign}")`);
        }
      }
    } else {
      console.log('✅ No conflicting records found with target Discord ID 899414980355571712');
    }
    
    // Step 4: Update the target record with the CORRECT Discord ID
    console.log('\n🔧 Step 4: Updating target record with CORRECT Discord ID...');
    
    const updateResult = await pool.query(`
      UPDATE players 
      SET discord_id = 899414980355571712,
          linked_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [activeRecord.id]);
    
    console.log(`✅ Update executed successfully`);
    console.log(`Rows affected: ${updateResult[0].affectedRows}`);
    console.log(`Changed rows: ${updateResult[0].changedRows}`);
    
    // Step 5: Verify the update
    console.log('\n🔍 Step 5: Verifying the update...');
    
    const [updatedRecord] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.id = ?
    `, [activeRecord.id]);
    
    if (updatedRecord.length > 0) {
      const record = updatedRecord[0];
      console.log('✅ Verification:');
      console.log(`  ID: ${record.id}`);
      console.log(`  IGN: "${record.ign}"`);
      console.log(`  Discord ID: ${record.discord_id}`);
      console.log(`  Active: ${record.is_active}`);
      console.log(`  Balance: ${record.balance || 0}`);
      console.log(`  Server: ${record.nickname || 'Unknown'}`);
      
      if (record.discord_id == 899414980355571712) {
        console.log('\n🎉 SUCCESS: Clap2000777 now has the CORRECT Discord ID!');
      } else {
        console.log('\n❌ ISSUE: Discord ID was not updated correctly');
        console.log(`Expected: 899414980355571712`);
        console.log(`Actual: ${record.discord_id}`);
      }
    }
    
    // Step 6: Final status
    console.log('\n📊 Step 6: Final status...');
    
    const [finalRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE LOWER(p.ign) = LOWER('Clap2000777')
      ORDER BY p.is_active DESC, p.linked_at DESC
    `);
    
    console.log('Final Clap2000777 records:');
    for (const record of finalRecords) {
      console.log(`  ID: ${record.id}, IGN: "${record.ign}", Discord: ${record.discord_id}, Active: ${record.is_active}, Balance: ${record.balance || 0}, Server: ${record.nickname || 'Unknown'}`);
    }
    
  } catch (error) {
    console.error('❌ Error in correct fix:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix
if (require.main === module) {
  fixClapDiscordCorrect()
    .then(() => {
      console.log('\n✅ Correct Discord ID fix completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Correct Discord ID fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixClapDiscordCorrect };
