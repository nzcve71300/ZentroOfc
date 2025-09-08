const pool = require('./src/db');

/**
 * Check the database constraint issue for Artemis2689
 */
async function checkArtemisConstraint() {
  try {
    console.log('🔍 Checking Artemis2689 database constraint issue...\n');
    
    const correctDiscordId = '680226741960441889';
    const wrongDiscordId = '680226741960441900';
    
    // Check all records with the correct Discord ID
    console.log('📋 Records with correct Discord ID:');
    const [correctRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.discord_id = ?
    `, [correctDiscordId]);
    
    console.log(`Found ${correctRecords.length} records with Discord ID ${correctDiscordId}:`);
    for (const record of correctRecords) {
      console.log(`  ID=${record.id}, IGN="${record.ign}", Server=${record.nickname}, Active=${record.is_active}, Balance=${record.balance || 0}`);
    }
    
    // Check all records with the wrong Discord ID
    console.log('\n📋 Records with wrong Discord ID:');
    const [wrongRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.discord_id = ?
    `, [wrongDiscordId]);
    
    console.log(`Found ${wrongRecords.length} records with Discord ID ${wrongDiscordId}:`);
    for (const record of wrongRecords) {
      console.log(`  ID=${record.id}, IGN="${record.ign}", Server=${record.nickname}, Active=${record.is_active}, Balance=${record.balance || 0}`);
    }
    
    // Check all Artemis records
    console.log('\n📋 All Artemis records:');
    const [allArtemis] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign LIKE '%Artemis%' OR p.ign LIKE '%artemis%'
      ORDER BY p.server_id, p.id
    `);
    
    for (const record of allArtemis) {
      console.log(`  ID=${record.id}, IGN="${record.ign}", Discord=${record.discord_id}, Server=${record.nickname}, Active=${record.is_active}, Balance=${record.balance || 0}`);
    }
    
    // Check the unique constraint
    console.log('\n🔍 Checking unique constraint violations:');
    
    // Group by server and Discord ID to find potential conflicts
    const serverDiscordGroups = {};
    for (const record of allArtemis) {
      const key = `${record.server_id}-${record.discord_id}`;
      if (!serverDiscordGroups[key]) {
        serverDiscordGroups[key] = [];
      }
      serverDiscordGroups[key].push(record);
    }
    
    for (const [key, records] of Object.entries(serverDiscordGroups)) {
      if (records.length > 1) {
        const [serverId, discordId] = key.split('-');
        const serverName = records[0].nickname;
        console.log(`  ⚠️ Potential conflict: Server=${serverName}, Discord=${discordId}, Records=${records.length}`);
        for (const record of records) {
          console.log(`    ID=${record.id}, Active=${record.is_active}, Balance=${record.balance || 0}`);
        }
      }
    }
    
    // Check if there are any records with the correct Discord ID that are active
    const activeCorrectRecords = correctRecords.filter(r => r.is_active);
    const activeWrongRecords = wrongRecords.filter(r => r.is_active);
    
    console.log('\n📊 Active records summary:');
    console.log(`  Active records with correct Discord ID: ${activeCorrectRecords.length}`);
    console.log(`  Active records with wrong Discord ID: ${activeWrongRecords.length}`);
    
    if (activeCorrectRecords.length > 0) {
      console.log('\n✅ Found active records with correct Discord ID:');
      for (const record of activeCorrectRecords) {
        console.log(`  - ${record.nickname}: ${record.balance || 0} (ID=${record.id})`);
      }
    }
    
    if (activeWrongRecords.length > 0) {
      console.log('\n❌ Found active records with wrong Discord ID:');
      for (const record of activeWrongRecords) {
        console.log(`  - ${record.nickname}: ${record.balance || 0} (ID=${record.id})`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking constraint:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkArtemisConstraint();
