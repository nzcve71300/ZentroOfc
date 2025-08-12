const pool = require('./src/db');

async function fixLinkingDuplicates() {
  try {
    console.log('🔧 Diagnosing and fixing linking system duplicates...');
    
    // Step 1: Check for duplicate in-game names across servers
    console.log('\n📋 Step 1: Checking for duplicate in-game names...');
    const [duplicates] = await pool.query(`
      SELECT 
        p.name as in_game_name,
        COUNT(*) as count,
        GROUP_CONCAT(CONCAT(p.discord_id, ' (', s.nickname, ')') SEPARATOR ', ') as locations
      FROM players p
      JOIN rust_servers s ON p.server_id = s.id
      WHERE p.name IS NOT NULL AND p.name != ''
      GROUP BY p.name
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);
    
    if (duplicates.length > 0) {
      console.log(`Found ${duplicates.length} duplicate in-game names:`);
      duplicates.forEach(dup => {
        console.log(`\n   "${dup.in_game_name}" appears ${dup.count} times:`);
        console.log(`   Locations: ${dup.locations}`);
      });
    } else {
      console.log('✅ No duplicate in-game names found');
    }
    
    // Step 2: Check for players with same in-game name on same server
    console.log('\n📋 Step 2: Checking for same-name conflicts on individual servers...');
    const [sameServerDuplicates] = await pool.query(`
      SELECT 
        p.server_id,
        s.nickname as server_name,
        p.name as in_game_name,
        COUNT(*) as count,
        GROUP_CONCAT(p.discord_id SEPARATOR ', ') as discord_ids
      FROM players p
      JOIN rust_servers s ON p.server_id = s.id
      WHERE p.name IS NOT NULL AND p.name != ''
      GROUP BY p.server_id, p.name
      HAVING COUNT(*) > 1
      ORDER BY s.nickname, p.name
    `);
    
    if (sameServerDuplicates.length > 0) {
      console.log(`Found ${sameServerDuplicates.length} same-name conflicts on individual servers:`);
      sameServerDuplicates.forEach(conflict => {
        console.log(`\n   Server: ${conflict.server_name}`);
        console.log(`   In-game name: ${conflict.in_game_name}`);
        console.log(`   Discord IDs: ${conflict.discord_ids}`);
      });
    } else {
      console.log('✅ No same-server name conflicts found');
    }
    
    // Step 3: Check for orphaned linking records
    console.log('\n📋 Step 3: Checking for orphaned linking records...');
    const [orphanedLinks] = await pool.query(`
      SELECT 
        p.*,
        s.nickname as server_name
      FROM players p
      JOIN rust_servers s ON p.server_id = s.id
      WHERE p.discord_id IS NOT NULL 
      AND p.discord_id != ''
      AND p.discord_id NOT IN (
        SELECT DISTINCT discord_id FROM players 
        WHERE discord_id IS NOT NULL AND discord_id != ''
      )
    `);
    
    if (orphanedLinks.length > 0) {
      console.log(`Found ${orphanedLinks.length} potentially orphaned linking records:`);
      orphanedLinks.forEach(link => {
        console.log(`   ${link.name} (${link.discord_id}) on ${link.server_name}`);
      });
    } else {
      console.log('✅ No orphaned linking records found');
    }
    
    // Step 4: Check specific case mentioned
    console.log('\n📋 Step 4: Checking specific case "BRNytro11" on Emperor 3x...');
    const [brnytro11Records] = await pool.query(`
      SELECT 
        p.*,
        s.nickname as server_name
      FROM players p
      JOIN rust_servers s ON p.server_id = s.id
      WHERE p.name = 'BRNytro11'
      ORDER BY s.nickname
    `);
    
    if (brnytro11Records.length > 0) {
      console.log(`Found ${brnytro11Records.length} records for "BRNytro11":`);
      brnytro11Records.forEach(record => {
        console.log(`   Server: ${record.server_name}`);
        console.log(`   Discord ID: ${record.discord_id || 'NULL'}`);
        console.log(`   Created: ${record.created_at}`);
        console.log(`   Updated: ${record.updated_at}`);
        console.log('');
      });
    } else {
      console.log('No records found for "BRNytro11"');
    }
    
    // Step 5: Show linking system status
    console.log('\n📋 Step 5: Linking system overview...');
    const [totalPlayers] = await pool.query('SELECT COUNT(*) as total FROM players');
    const [linkedPlayers] = await pool.query('SELECT COUNT(*) as linked FROM players WHERE discord_id IS NOT NULL AND discord_id != ""');
    const [unlinkedPlayers] = await pool.query('SELECT COUNT(*) as unlinked FROM players WHERE discord_id IS NULL OR discord_id = ""');
    
    console.log(`Total players: ${totalPlayers[0].total}`);
    console.log(`Linked players: ${linkedPlayers[0].linked}`);
    console.log(`Unlinked players: ${unlinkedPlayers[0].unlinked}`);
    
    // Step 6: Provide cleanup options
    console.log('\n🎯 RECOMMENDED ACTIONS:');
    
    if (sameServerDuplicates.length > 0) {
      console.log('❌ CRITICAL: Same-server duplicates found!');
      console.log('   These will cause linking failures.');
      console.log('   Run cleanup script to fix.');
    }
    
    if (duplicates.length > 0) {
      console.log('⚠️  WARNING: Cross-server duplicates found.');
      console.log('   This may cause confusion but is usually OK.');
    }
    
    console.log('\n🔧 To fix linking issues:');
    console.log('1. Run: node cleanup_linking_duplicates.js');
    console.log('2. Restart bot: pm2 restart zentro-bot');
    console.log('3. Test linking with affected players');
    
  } catch (error) {
    console.error('❌ Error diagnosing linking duplicates:', error);
  } finally {
    await pool.end();
  }
}

fixLinkingDuplicates(); 