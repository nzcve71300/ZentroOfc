const pool = require('./src/db');

/**
 * Fix Clap2000777 Discord ID
 * Update the active record to use the correct Discord ID: 899414980355571712
 */

async function fixClapDiscordId() {
  console.log('🔧 FIXING CLAP2000777 DISCORD ID');
  console.log('=================================');
  
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
    
    if (clapRecords.length === 0) {
      console.log('❌ No Clap2000777 records found!');
      return;
    }
    
    // Step 2: Find the active record
    const activeRecord = clapRecords.find(r => r.is_active);
    
    if (!activeRecord) {
      console.log('❌ No active Clap2000777 record found!');
      return;
    }
    
    console.log(`\n🎯 Active record found: ID ${activeRecord.id} on ${activeRecord.nickname}`);
    console.log(`Current Discord ID: ${activeRecord.discord_id}`);
    console.log(`Target Discord ID: 899414980355571712`);
    
    // Step 3: Check if the target Discord ID is already in use
    console.log('\n🔍 Step 3: Checking if target Discord ID is already in use...');
    
    const [existingDiscordRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.discord_id = 899414980355571712
      ORDER BY p.is_active DESC, p.linked_at DESC
    `);
    
    if (existingDiscordRecords.length > 0) {
      console.log(`Found ${existingDiscordRecords.length} existing records with Discord ID 899414980355571712:`);
      for (const record of existingDiscordRecords) {
        console.log(`  ID: ${record.id}, IGN: "${record.ign}", Active: ${record.is_active}, Balance: ${record.balance || 0}, Server: ${record.nickname || 'Unknown'}`);
      }
      
      // If there are active records with this Discord ID, we need to handle them
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
      console.log('✅ Target Discord ID 899414980355571712 is not in use');
    }
    
    // Step 4: Update Clap2000777 record with correct Discord ID
    console.log('\n🔧 Step 4: Updating Clap2000777 record...');
    
    await pool.query(`
      UPDATE players 
      SET discord_id = 899414980355571712,
          linked_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [activeRecord.id]);
    
    console.log(`✅ Updated Clap2000777 record ID ${activeRecord.id} with Discord ID 899414980355571712`);
    
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
    
  } catch (error) {
    console.error('❌ Error fixing Clap2000777 Discord ID:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix
if (require.main === module) {
  fixClapDiscordId()
    .then(() => {
      console.log('\n✅ Clap2000777 Discord ID fix completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Clap2000777 Discord ID fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixClapDiscordId };
