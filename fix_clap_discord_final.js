const pool = require('./src/db');

/**
 * Final fix for Clap2000777 Discord ID
 * Handle unique constraint conflicts properly
 */

async function fixClapDiscordFinal() {
  console.log('🔧 FINAL FIX FOR CLAP2000777 DISCORD ID');
  console.log('=========================================');
  
  try {
    // Step 1: Show current state
    console.log('\n📊 Step 1: Current state...');
    
    const [clapRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname, p.guild_id, p.server_id
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE LOWER(p.ign) = LOWER('Clap2000777')
      ORDER BY p.is_active DESC, p.linked_at DESC
    `);
    
    console.log('Current Clap2000777 records:');
    for (const record of clapRecords) {
      console.log(`  ID: ${record.id}, IGN: "${record.ign}", Discord: ${record.discord_id}, Active: ${record.is_active}, Balance: ${record.balance || 0}, Server: ${record.nickname || 'Unknown'}, Guild: ${record.guild_id}, ServerID: ${record.server_id}`);
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
    
    // Step 3: Check for constraint conflicts
    console.log('\n🔍 Step 3: Checking for constraint conflicts...');
    
    // Check if target Discord ID is already used by active records on the same server
    const [conflictRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.discord_id = 899414980355571712
      AND p.server_id = ?
      AND p.is_active = true
      AND p.id != ?
    `, [activeRecord.server_id, activeRecord.id]);
    
    if (conflictRecords.length > 0) {
      console.log(`Found ${conflictRecords.length} conflicting active records on same server:`);
      for (const record of conflictRecords) {
        console.log(`  ID: ${record.id}, IGN: "${record.ign}", Balance: ${record.balance || 0}, Server: ${record.nickname || 'Unknown'}`);
      }
      
      // Deactivate conflicting records
      console.log('\n🔧 Deactivating conflicting records...');
      for (const record of conflictRecords) {
        await pool.query(`
          UPDATE players 
          SET is_active = false, 
              unlinked_at = CURRENT_TIMESTAMP,
              unlink_reason = 'Deactivated to fix Clap2000777 Discord ID conflict'
          WHERE id = ?
        `, [record.id]);
        
        console.log(`  ✅ Deactivated record ID ${record.id} (IGN: "${record.ign}")`);
      }
    } else {
      console.log('✅ No conflicting active records found on same server');
    }
    
    // Step 4: Now update the target record
    console.log('\n🔧 Step 4: Updating target record...');
    
    try {
      const updateResult = await pool.query(`
        UPDATE players 
        SET discord_id = 899414980355571712,
            linked_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [activeRecord.id]);
      
      console.log(`✅ Update executed successfully`);
      console.log(`Rows affected: ${updateResult[0].affectedRows}`);
      console.log(`Changed rows: ${updateResult[0].changedRows}`);
      
    } catch (updateError) {
      console.log(`❌ Update failed: ${updateError.message}`);
      
      // If it's a constraint error, let's try a different approach
      if (updateError.code === 'ER_DUP_ENTRY') {
        console.log('\n🔧 Constraint error detected. Trying alternative approach...');
        
        // First, temporarily set discord_id to NULL to break the constraint
        await pool.query(`
          UPDATE players 
          SET discord_id = NULL
          WHERE id = ?
        `, [activeRecord.id]);
        
        console.log('  ✅ Temporarily set discord_id to NULL');
        
        // Now set it to the target value
        await pool.query(`
          UPDATE players 
          SET discord_id = 899414980355571712,
              linked_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [activeRecord.id]);
        
        console.log('  ✅ Set discord_id to target value');
      }
    }
    
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
        console.log('\n🎉 SUCCESS: Clap2000777 now has the correct Discord ID!');
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
    console.error('❌ Error in final fix:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix
if (require.main === module) {
  fixClapDiscordFinal()
    .then(() => {
      console.log('\n✅ Final Discord ID fix completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Final Discord ID fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixClapDiscordFinal };
