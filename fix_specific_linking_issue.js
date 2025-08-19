const pool = require('./src/db');

async function fixSpecificLinkingIssue() {
  try {
    console.log('🔧 Fixing specific linking issue for XsLdSsG...');
    
    const playerIgn = 'XsLdSsG';
    const guildId = '1391149977434329230'; // Your guild ID
    
    console.log(`\n🔍 Checking records for IGN: ${playerIgn}`);
    
    // First, let's see what we're dealing with
    const [allRecords] = await pool.query(`
      SELECT p.*, rs.nickname, g.discord_id as guild_discord_id
      FROM players p
      JOIN guilds g ON p.guild_id = g.id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE LOWER(p.ign) = LOWER(?) AND g.discord_id = ?
      ORDER BY p.linked_at DESC
    `, [playerIgn, guildId]);
    
    console.log(`📋 Found ${allRecords.length} records:`);
    
    for (const record of allRecords) {
      console.log(`\n📝 Record ID: ${record.id}`);
      console.log(`   Server: ${record.nickname || 'Unknown'}`);
      console.log(`   Discord ID: ${record.discord_id || 'NULL'}`);
      console.log(`   Active: ${record.is_active}`);
      console.log(`   Linked: ${record.linked_at}`);
      console.log(`   Unlinked: ${record.unlinked_at || 'Never'}`);
    }
    
    // Strategy: Clean up any problematic inactive records
    console.log(`\n🧹 Cleaning up inactive records for ${playerIgn}...`);
    
    // Option 1: Remove completely inactive records (no discord_id and inactive)
    const [orphanedResult] = await pool.query(`
      DELETE p FROM players p
      JOIN guilds g ON p.guild_id = g.id
      WHERE LOWER(p.ign) = LOWER(?) 
      AND g.discord_id = ?
      AND p.discord_id IS NULL 
      AND p.is_active = false
    `, [playerIgn, guildId]);
    
    console.log(`🗑️ Removed ${orphanedResult.affectedRows} orphaned inactive records`);
    
    // Option 2: Set proper unlinked_at for inactive records that have discord_id but are inactive
    const [inactiveResult] = await pool.query(`
      UPDATE players p
      JOIN guilds g ON p.guild_id = g.id
      SET p.unlinked_at = COALESCE(p.unlinked_at, p.linked_at, CURRENT_TIMESTAMP)
      WHERE LOWER(p.ign) = LOWER(?) 
      AND g.discord_id = ?
      AND p.discord_id IS NOT NULL 
      AND p.is_active = false
      AND p.unlinked_at IS NULL
    `, [playerIgn, guildId]);
    
    console.log(`📅 Updated ${inactiveResult.affectedRows} inactive records with proper unlinked_at timestamps`);
    
    // Check final state
    console.log(`\n🔍 Final state check for ${playerIgn}:`);
    const [finalRecords] = await pool.query(`
      SELECT p.*, rs.nickname
      FROM players p
      JOIN guilds g ON p.guild_id = g.id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE LOWER(p.ign) = LOWER(?) AND g.discord_id = ?
      ORDER BY p.linked_at DESC
    `, [playerIgn, guildId]);
    
    console.log(`📋 Remaining ${finalRecords.length} records:`);
    
    for (const record of finalRecords) {
      console.log(`   ${record.is_active ? '✅ ACTIVE' : '❌ INACTIVE'}: ${record.ign} (Discord: ${record.discord_id || 'NULL'}) on ${record.nickname || 'Unknown'}`);
    }
    
    // Check if linking should work now
    const activeRecords = finalRecords.filter(r => r.is_active);
    
    if (activeRecords.length === 0) {
      console.log(`\n🎉 SUCCESS! ${playerIgn} should now be able to link - no active records found!`);
    } else {
      console.log(`\n⚠️ WARNING: ${playerIgn} still has ${activeRecords.length} active record(s). They may need admin intervention.`);
      activeRecords.forEach(record => {
        console.log(`   Active record: Discord ID ${record.discord_id} on ${record.nickname}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error fixing specific linking issue:', error);
  } finally {
    await pool.end();
  }
}

fixSpecificLinkingIssue();
