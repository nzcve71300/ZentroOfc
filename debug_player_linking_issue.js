const pool = require('./src/db');

async function debugPlayerLinkingIssue() {
  try {
    console.log('🔍 Debugging player linking issue for XsLdSsG...');
    
    const playerIgn = 'XsLdSsG';
    const guildId = '1391149977434329230'; // Your guild ID
    
    console.log(`\n🔍 Searching for all records of IGN: ${playerIgn}`);
    
    // Check all player records with this IGN (active and inactive)
    const [allPlayerRecords] = await pool.query(`
      SELECT p.*, rs.nickname, rs.id as server_id
      FROM players p
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE LOWER(p.ign) = LOWER(?)
      ORDER BY p.linked_at DESC
    `, [playerIgn]);
    
    console.log(`📋 Found ${allPlayerRecords.length} total records for ${playerIgn}:`);
    
    for (const record of allPlayerRecords) {
      console.log(`\n📝 Record ID: ${record.id}`);
      console.log(`   Server: ${record.nickname || 'Unknown'} (${record.server_id})`);
      console.log(`   Discord ID: ${record.discord_id || 'NULL'}`);
      console.log(`   IGN: ${record.ign}`);
      console.log(`   Active: ${record.is_active}`);
      console.log(`   Linked: ${record.linked_at}`);
      console.log(`   Unlinked: ${record.unlinked_at || 'Never'}`);
      console.log(`   Guild ID: ${record.guild_id}`);
    }
    
    // Check specifically for records in your guild
    console.log(`\n🔍 Checking records in guild ${guildId}:`);
    const [guildRecords] = await pool.query(`
      SELECT p.*, rs.nickname, g.discord_id as guild_discord_id
      FROM players p
      JOIN guilds g ON p.guild_id = g.id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE LOWER(p.ign) = LOWER(?) AND g.discord_id = ?
      ORDER BY p.linked_at DESC
    `, [playerIgn, guildId]);
    
    console.log(`📋 Found ${guildRecords.length} records in your guild:`);
    
    for (const record of guildRecords) {
      console.log(`\n📝 Guild Record ID: ${record.id}`);
      console.log(`   Server: ${record.nickname || 'Unknown'}`);
      console.log(`   Discord ID: ${record.discord_id || 'NULL'}`);
      console.log(`   Active: ${record.is_active}`);
      console.log(`   Linked: ${record.linked_at}`);
      console.log(`   Unlinked: ${record.unlinked_at || 'Never'}`);
      
      // Check if this record has an economy entry
      const [economyRecord] = await pool.query(
        'SELECT * FROM economy WHERE player_id = ?',
        [record.id]
      );
      
      console.log(`   Economy Record: ${economyRecord.length > 0 ? 'EXISTS' : 'MISSING'}`);
      if (economyRecord.length > 0) {
        console.log(`   Balance: ${economyRecord[0].balance}`);
      }
    }
    
    // Check the exact query that's failing in the link command
    console.log(`\n🔍 Testing the exact query from link command:`);
    const [anyIgnLinks] = await pool.query(`
      SELECT p.*, rs.nickname 
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
      AND LOWER(p.ign) = LOWER(?)
    `, [guildId, playerIgn]);
    
    console.log(`📋 Link command query found ${anyIgnLinks.length} records:`);
    
    for (const record of anyIgnLinks) {
      console.log(`\n📝 Link Query Result:`);
      console.log(`   Record ID: ${record.id}`);
      console.log(`   Server: ${record.nickname}`);
      console.log(`   Discord ID: ${record.discord_id || 'NULL'}`);
      console.log(`   Active: ${record.is_active}`);
      console.log(`   This would cause: ${record.is_active ? 'BLOCKING ERROR' : 'Should allow linking'}`);
    }
    
    // Check for any similar IGNs (case variations)
    console.log(`\n🔍 Checking for case variations of ${playerIgn}:`);
    const [caseVariations] = await pool.query(`
      SELECT DISTINCT p.ign, COUNT(*) as count
      FROM players p
      JOIN guilds g ON p.guild_id = g.id
      WHERE g.discord_id = ? AND p.ign LIKE ?
      GROUP BY p.ign
    `, [guildId, `%${playerIgn.toLowerCase()}%`]);
    
    console.log(`📋 Case variations found:`);
    for (const variation of caseVariations) {
      console.log(`   "${variation.ign}" - ${variation.count} record(s)`);
    }
    
    console.log('\n🎯 DIAGNOSIS COMPLETE!');
    console.log('💡 Check the results above to identify the issue.');
    
  } catch (error) {
    console.error('❌ Error debugging player linking issue:', error);
  } finally {
    await pool.end();
  }
}

debugPlayerLinkingIssue();
