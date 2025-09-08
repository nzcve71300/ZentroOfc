const pool = require('./src/db');

/**
 * Force fix Clap2000777 Discord ID by removing conflicting records
 */

async function fixClapDiscordForce() {
  console.log('🔧 FORCE FIXING CLAP2000777 DISCORD ID');
  console.log('=======================================');
  
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
    
    // Step 3: Find and DELETE conflicting records
    console.log('\n🔍 Step 3: Finding conflicting records...');
    
    const [conflictRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.discord_id = 899414980355571712
      AND p.id != ?
    `, [activeRecord.id]);
    
    if (conflictRecords.length > 0) {
      console.log(`Found ${conflictRecords.length} conflicting records with target Discord ID 899414980355571712:`);
      for (const record of conflictRecords) {
        console.log(`  ID: ${record.id}, IGN: "${record.ign}", Active: ${record.is_active}, Balance: ${record.balance || 0}, Server: ${record.nickname || 'Unknown'}`);
      }
      
      console.log('\n🗑️ DELETING conflicting records...');
      for (const record of conflictRecords) {
        // Delete economy record first
        await pool.query('DELETE FROM economy WHERE player_id = ?', [record.id]);
        console.log(`  ✅ Deleted economy record for ID ${record.id}`);
        
        // Delete player record
        await pool.query('DELETE FROM players WHERE id = ?', [record.id]);
        console.log(`  ✅ Deleted player record ID ${record.id} (IGN: "${record.ign}")`);
      }
    } else {
      console.log('✅ No conflicting records found with target Discord ID 899414980355571712');
    }
    
    // Step 4: Now update the target record
    console.log('\n🔧 Step 4: Updating target record...');
    
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
    console.error('❌ Error in force fix:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix
if (require.main === module) {
  fixClapDiscordForce()
    .then(() => {
      console.log('\n✅ Force Discord ID fix completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Force Discord ID fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixClapDiscordForce };
