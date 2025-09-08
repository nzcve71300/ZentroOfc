const pool = require('./src/db');

async function testDiscordQuery() {
  try {
    console.log('🔍 Testing Discord ID queries...\n');
    
    const correctDiscordId = '1170856076569223200';
    
    // Test 1: Direct number comparison
    console.log('Test 1: Direct number comparison');
    const [test1] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active
      FROM players p
      WHERE p.discord_id = ?
    `, [correctDiscordId]);
    console.log(`Found ${test1.length} records`);
    
    // Test 2: CAST to CHAR
    console.log('\nTest 2: CAST to CHAR');
    const [test2] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active
      FROM players p
      WHERE CAST(p.discord_id AS CHAR) = ?
    `, [correctDiscordId]);
    console.log(`Found ${test2.length} records`);
    
    // Test 3: CAST to CHAR with number parameter
    console.log('\nTest 3: CAST to CHAR with number parameter');
    const [test3] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active
      FROM players p
      WHERE CAST(p.discord_id AS CHAR) = ?
    `, [1170856076569223200]);
    console.log(`Found ${test3.length} records`);
    
    // Test 4: Show all Meliodas records with their discord_id types
    console.log('\nTest 4: All Meliodas records with types');
    const [test4] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, 
             TYPEOF(p.discord_id) as discord_id_type,
             CAST(p.discord_id AS CHAR) as discord_id_as_char,
             p.server_id, p.is_active
      FROM players p
      WHERE p.ign LIKE '%Meliodas%'
      ORDER BY p.id
    `);
    
    for (const record of test4) {
      console.log(`  ID=${record.id}, Discord=${record.discord_id}, Type=${record.discord_id_type}, AsChar="${record.discord_id_as_char}"`);
    }
    
    // Test 5: Try with LIKE
    console.log('\nTest 5: LIKE comparison');
    const [test5] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active
      FROM players p
      WHERE CAST(p.discord_id AS CHAR) LIKE ?
    `, [`%${correctDiscordId}%`]);
    console.log(`Found ${test5.length} records`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testDiscordQuery();
