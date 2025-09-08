const pool = require('./src/db');

/**
 * Fix Clap2000777 Discord ID - CORRECTED VERSION
 * Update the active record to use the correct Discord ID: 899414980355571712
 */

async function fixClapDiscordIdCorrected() {
  console.log('🔧 FIXING CLAP2000777 DISCORD ID - CORRECTED');
  console.log('=============================================');
  
  try {
    // Step 1: Find all Clap2000777 records
    console.log('\n📊 Step 1: Finding all Clap2000777 records...');
    
    const [clapRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, p.linked_at, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE LOWER(p.ign) = LOWER('Clap2000777')
      ORDER BY p.is_active DESC, p.linked_at DESC
    `);
    
    console.log(`Found ${clapRecords.length} Clap2000777 records:`);
    for (const record of clapRecords) {
      console.log(`  ID: ${record.id}, IGN: "${record.ign}", Discord: ${record.discord_id}, Active: ${record.is_active}, Balance: ${record.balance || 0}, Server: ${record.nickname || 'Unknown'}`);
    }
    
    // Step 2: Find the active record with the highest balance (the one we want to keep)
    const activeRecord = clapRecords.find(r => r.is_active && r.balance > 0);
    
    if (!activeRecord) {
      console.log('❌ No active Clap2000777 record with balance found!');
      return;
    }
    
    console.log(`\n🎯 Active record with balance found: ID ${activeRecord.id} on ${activeRecord.nickname}`);
    console.log(`Current Discord ID: ${activeRecord.discord_id}`);
    console.log(`Current Balance: ${activeRecord.balance}`);
    console.log(`Target Discord ID: 899414980355571712`);
    
    // Step 3: Check if the target Discord ID is already in use by someone else
    console.log('\n🔍 Step 3: Checking if target Discord ID is already in use...');
    
    const [existingDiscordRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.discord_id = 899414980355571712
      AND p.id != ?
      ORDER BY p.is_active DESC, p.linked_at DESC
    `, [activeRecord.id]);
    
    if (existingDiscordRecords.length > 0) {
      console.log(`Found ${existingDiscordRecords.length} existing records with Discord ID 899414980355571712:`);
      for (const record of existingDiscordRecords) {
        console.log(`  ID: ${record.id}, IGN: "${record.ign}", Active: ${record.is_active}, Balance: ${record.balance || 0}, Server: ${record.nickname || 'Unknown'}`);
      }
      
      // If there are active records with this Discord ID, deactivate them
      const activeDiscordRecords = existingDiscordRecords.filter(r => r.is_active);
      if (activeDiscordRecords.length > 0) {
        console.log(`\n⚠️ Found ${activeDiscordRecords.length} active records with Discord ID 899414980355571712`);
        console.log('These will be deactivated to avoid conflicts...');
        
        for (const record of activeDiscordRecords) {
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
      console.log('✅ Target Discord ID 899414980355571712 is not in use by other records');
    }
    
    // Step 4: Update Clap2000777 record with correct Discord ID
    console.log('\n🔧 Step 4: Updating Clap2000777 record...');
    
    const updateResult = await pool.query(`
      UPDATE players 
      SET discord_id = 899414980355571712,
          linked_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [activeRecord.id]);
    
    console.log(`✅ Update query executed for record ID ${activeRecord.id}`);
    console.log(`Rows affected: ${updateResult[0].affectedRows}`);
    
    // Step 5: Verify the update
    console.log('\n🔍 Step 5: Verifying the update...');
    
    const [updatedRecord] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, p.linked_at, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.id = ?
    `, [activeRecord.id]);
    
    if (updatedRecord.length > 0) {
      const record = updatedRecord[0];
      console.log('✅ Verification successful:');
      console.log(`  ID: ${record.id}`);
      console.log(`  IGN: "${record.ign}"`);
      console.log(`  Discord ID: ${record.discord_id}`);
      console.log(`  Active: ${record.is_active}`);
      console.log(`  Balance: ${record.balance || 0}`);
      console.log(`  Server: ${record.nickname || 'Unknown'}`);
      console.log(`  Linked At: ${record.linked_at}`);
      
      if (record.discord_id == 899414980355571712) {
        console.log('\n🎉 SUCCESS: Clap2000777 now has the correct Discord ID!');
      } else {
        console.log('\n❌ ERROR: Discord ID was not updated correctly');
        console.log(`Expected: 899414980355571712, Got: ${record.discord_id}`);
      }
    } else {
      console.log('\n❌ ERROR: Could not verify the update');
    }
    
    // Step 6: Final status check
    console.log('\n📊 Step 6: Final status check...');
    
    const [finalClapRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE LOWER(p.ign) = LOWER('Clap2000777')
      ORDER BY p.is_active DESC, p.linked_at DESC
    `);
    
    console.log(`Final Clap2000777 records:`);
    for (const record of finalClapRecords) {
      console.log(`  ID: ${record.id}, IGN: "${record.ign}", Discord: ${record.discord_id}, Active: ${record.is_active}, Balance: ${record.balance || 0}, Server: ${record.nickname || 'Unknown'}`);
    }
    
    // Step 7: Check for any remaining active records with the old Discord ID
    console.log('\n🔍 Step 7: Checking for remaining active records with old Discord ID...');
    
    const [oldDiscordRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.discord_id = 899414980355571700
      AND p.is_active = true
    `);
    
    if (oldDiscordRecords.length > 0) {
      console.log(`Found ${oldDiscordRecords.length} active records with old Discord ID 899414980355571700:`);
      for (const record of oldDiscordRecords) {
        console.log(`  ID: ${record.id}, IGN: "${record.ign}", Balance: ${record.balance || 0}, Server: ${record.nickname || 'Unknown'}`);
      }
    } else {
      console.log('✅ No active records found with old Discord ID 899414980355571700');
    }
    
  } catch (error) {
    console.error('❌ Error fixing Clap2000777 Discord ID:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix
if (require.main === module) {
  fixClapDiscordIdCorrected()
    .then(() => {
      console.log('\n✅ Clap2000777 Discord ID fix completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Clap2000777 Discord ID fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixClapDiscordIdCorrected };
