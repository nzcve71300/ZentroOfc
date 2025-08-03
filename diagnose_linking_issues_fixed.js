const pool = require('./src/db');

async function diagnoseLinkingIssuesFixed() {
  console.log('🔍 Diagnosing linking issues (fixed version)...');
  
  try {
    // Check for players with linking conflicts
    console.log('\n📋 Checking for linking conflicts...');
    const [conflicts] = await pool.query(`
      SELECT 
        p1.ign,
        p1.discord_id as discord_id_1,
        p1.is_active as active_1,
        p2.discord_id as discord_id_2,
        p2.is_active as active_2,
        rs.nickname as server_name
      FROM players p1
      JOIN players p2 ON p1.ign = p2.ign AND p1.server_id = p2.server_id AND p1.id != p2.id
      JOIN rust_servers rs ON p1.server_id = rs.id
      WHERE p1.ign IS NOT NULL
      ORDER BY p1.ign, p1.server_id
    `);
    
    if (conflicts.length > 0) {
      console.log('⚠️ Found linking conflicts:');
      conflicts.forEach(conflict => {
        console.log(`- ${conflict.ign} on ${conflict.server_name}: Discord ${conflict.discord_id_1} (active: ${conflict.active_1}) vs Discord ${conflict.discord_id_2} (active: ${conflict.active_2})`);
      });
    } else {
      console.log('✅ No linking conflicts found');
    }
    
    // Check for inactive players that might be causing issues
    console.log('\n📋 Checking inactive players...');
    const [inactivePlayers] = await pool.query(`
      SELECT p.*, rs.nickname as server_name 
      FROM players p 
      JOIN rust_servers rs ON p.server_id = rs.id 
      WHERE p.is_active = false 
      AND p.discord_id IS NOT NULL
      ORDER BY p.ign, p.discord_id
    `);
    
    if (inactivePlayers.length > 0) {
      console.log(`Found ${inactivePlayers.length} inactive player records:`);
      inactivePlayers.forEach(player => {
        console.log(`- ${player.ign} (Discord: ${player.discord_id}) on ${player.server_name} - Linked: ${player.linked_at}, Unlinked: ${player.unlinked_at}`);
      });
    } else {
      console.log('✅ No inactive players found');
    }
    
    // Check for players with same IGN but different Discord IDs
    console.log('\n📋 Checking for IGN conflicts...');
    const [ignConflicts] = await pool.query(`
      SELECT 
        p1.ign,
        p1.discord_id as discord_id_1,
        p1.is_active as active_1,
        p2.discord_id as discord_id_2,
        p2.is_active as active_2,
        rs.nickname as server_name
      FROM players p1
      JOIN players p2 ON p1.ign = p2.ign AND p1.discord_id != p2.discord_id
      JOIN rust_servers rs ON p1.server_id = rs.id
      WHERE p1.ign IS NOT NULL
      AND p1.discord_id IS NOT NULL
      AND p2.discord_id IS NOT NULL
      ORDER BY p1.ign, p1.server_id
    `);
    
    if (ignConflicts.length > 0) {
      console.log('⚠️ Found IGN conflicts (same IGN, different Discord IDs):');
      ignConflicts.forEach(conflict => {
        console.log(`- ${conflict.ign} on ${conflict.server_name}: Discord ${conflict.discord_id_1} (active: ${conflict.active_1}) vs Discord ${conflict.discord_id_2} (active: ${conflict.active_2})`);
      });
    } else {
      console.log('✅ No IGN conflicts found');
    }
    
    // Check VIP kit authorization (using correct column names)
    console.log('\n📋 Checking VIP kit authorizations...');
    try {
      const [vipAuth] = await pool.query(`
        SELECT ka.*, rs.nickname as server_name
        FROM kit_auth ka
        JOIN rust_servers rs ON ka.server_id = rs.id
        WHERE ka.kitlist = 'VIPkit'
        ORDER BY ka.server_id, ka.discord_id
      `);
      
      console.log(`Found ${vipAuth.length} VIP kit authorizations:`);
      vipAuth.forEach(auth => {
        console.log(`- Discord ID: ${auth.discord_id} on ${auth.server_name} (kitlist: ${auth.kitlist})`);
      });
    } catch (error) {
      console.log('⚠️ Error checking VIP kit authorizations:', error.message);
      console.log('This might be due to different column names in kit_auth table');
    }
    
    // Check for orphaned kit_auth entries (no corresponding player)
    console.log('\n📋 Checking for orphaned kit_auth entries...');
    try {
      const [orphanedKitAuth] = await pool.query(`
        SELECT ka.*, rs.nickname as server_name
        FROM kit_auth ka
        JOIN rust_servers rs ON ka.server_id = rs.id
        LEFT JOIN players p ON ka.discord_id = p.discord_id AND ka.server_id = p.server_id
        WHERE p.id IS NULL
        AND ka.discord_id IS NOT NULL
        ORDER BY ka.server_id, ka.discord_id
      `);
      
      if (orphanedKitAuth.length > 0) {
        console.log(`⚠️ Found ${orphanedKitAuth.length} orphaned kit_auth entries:`);
        orphanedKitAuth.forEach(auth => {
          console.log(`- Discord ID: ${auth.discord_id} on ${auth.server_name} (kitlist: ${auth.kitlist}) - No corresponding player record`);
        });
      } else {
        console.log('✅ No orphaned kit_auth entries found');
      }
    } catch (error) {
      console.log('⚠️ Error checking orphaned kit_auth entries:', error.message);
    }
    
    console.log('\n✅ Diagnosis completed!');
    
  } catch (error) {
    console.error('❌ Error in diagnosis:', error);
  } finally {
    await pool.end();
  }
}

diagnoseLinkingIssuesFixed(); 