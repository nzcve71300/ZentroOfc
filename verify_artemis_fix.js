const pool = require('./src/db');

/**
 * Verify if Artemis2689 is already fixed
 */
async function verifyArtemisFix() {
  try {
    console.log('🔍 Verifying Artemis2689 fix...\n');
    
    const correctDiscordId = '680226741960441889';
    
    // Check active records with correct Discord ID
    console.log('📋 Active Artemis records with correct Discord ID:');
    const [activeRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign LIKE '%Artemis%' AND p.discord_id = ? AND p.is_active = true
    `, [correctDiscordId]);
    
    if (activeRecords.length === 0) {
      console.log('❌ No active records found with correct Discord ID');
      return;
    }
    
    console.log(`Found ${activeRecords.length} active records:`);
    for (const record of activeRecords) {
      console.log(`  ID=${record.id}, IGN="${record.ign}", Server=${record.nickname}, Balance=${record.balance || 0}`);
    }
    
    // Check if there are any active records with wrong Discord ID
    console.log('\n📋 Checking for active records with wrong Discord ID:');
    const [wrongRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign LIKE '%Artemis%' AND p.discord_id != ? AND p.is_active = true
    `, [correctDiscordId]);
    
    if (wrongRecords.length > 0) {
      console.log(`Found ${wrongRecords.length} active records with wrong Discord ID:`);
      for (const record of wrongRecords) {
        console.log(`  ID=${record.id}, IGN="${record.ign}", Discord=${record.discord_id}, Server=${record.nickname}, Balance=${record.balance || 0}`);
      }
    } else {
      console.log('✅ No active records with wrong Discord ID found');
    }
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`  Active records with correct Discord ID: ${activeRecords.length}`);
    console.log(`  Active records with wrong Discord ID: ${wrongRecords.length}`);
    
    if (activeRecords.length > 0 && wrongRecords.length === 0) {
      console.log('\n🎉 Artemis2689 is already fixed!');
      console.log('The user should be able to use Discord ID:', correctDiscordId);
      console.log('And see their balances:');
      for (const record of activeRecords) {
        console.log(`  - ${record.nickname}: ${record.balance || 0}`);
      }
    } else if (wrongRecords.length > 0) {
      console.log('\n⚠️ Still has active records with wrong Discord ID - needs fixing');
    } else {
      console.log('\n❌ No active records found - user appears unlinked');
    }
    
  } catch (error) {
    console.error('❌ Error verifying Artemis fix:', error);
  } finally {
    await pool.end();
  }
}

// Run the verification
verifyArtemisFix();
