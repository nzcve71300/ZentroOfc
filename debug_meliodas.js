const pool = require('./src/db');

/**
 * Debug script to see what's happening with the Discord IDs
 */
async function debugMeliodas() {
  try {
    console.log('🔍 Debugging Meliodas Discord ID issue...\n');
    
    const correctDiscordId = '1170856076569223200';
    const wrongDiscordId = '22115433549209050';
    
    console.log('📋 All Meliodas records:');
    const [allRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign LIKE '%Meliodas%'
      ORDER BY p.server_id, p.id
    `);
    
    for (const record of allRecords) {
      console.log(`  ID=${record.id}, IGN="${record.ign}", Discord="${record.discord_id}" (type: ${typeof record.discord_id}), Server=${record.nickname}, Active=${record.is_active}, Balance=${record.balance || 0}`);
    }
    
    console.log(`\n🔍 Searching for correct Discord ID: "${correctDiscordId}"`);
    const [correctRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.discord_id = ?
    `, [correctDiscordId]);
    
    console.log(`Found ${correctRecords.length} records with correct Discord ID:`);
    for (const record of correctRecords) {
      console.log(`  ID=${record.id}, IGN="${record.ign}", Server=${record.nickname}, Active=${record.is_active}, Balance=${record.balance || 0}`);
    }
    
    console.log(`\n🔍 Searching for wrong Discord ID: "${wrongDiscordId}"`);
    const [wrongRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.discord_id = ?
    `, [wrongDiscordId]);
    
    console.log(`Found ${wrongRecords.length} records with wrong Discord ID:`);
    for (const record of wrongRecords) {
      console.log(`  ID=${record.id}, IGN="${record.ign}", Server=${record.nickname}, Active=${record.is_active}, Balance=${record.balance || 0}`);
    }
    
    // Try different approaches
    console.log(`\n🔍 Trying string comparison...`);
    const [stringRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE CAST(p.discord_id AS CHAR) = ?
    `, [correctDiscordId]);
    
    console.log(`Found ${stringRecords.length} records with string comparison:`);
    for (const record of stringRecords) {
      console.log(`  ID=${record.id}, IGN="${record.ign}", Server=${record.nickname}, Active=${record.is_active}, Balance=${record.balance || 0}`);
    }
    
  } catch (error) {
    console.error('❌ Error debugging:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
debugMeliodas();
