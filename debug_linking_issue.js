const pool = require('./src/db');

async function debugLinkingIssue() {
  try {
    console.log('🔍 Debugging linking issue for BRNytro11...');
    
    // Check all records for BRNytro11
    console.log('\n📋 Step 1: All BRNytro11 records...');
    const [brnytro11Records] = await pool.query(`
      SELECT p.*, s.nickname as server_name
      FROM players p
      JOIN rust_servers s ON p.server_id = s.id
      WHERE p.ign = 'BRNytro11'
      ORDER BY s.nickname, p.linked_at DESC
    `);
    
    console.log(`Found ${brnytro11Records.length} records for "BRNytro11":`);
    brnytro11Records.forEach((record, index) => {
      console.log(`\n${index + 1}. Record:`);
      console.log(`   ID: ${record.id}`);
      console.log(`   Server: ${record.server_name} (${record.server_id})`);
      console.log(`   Discord ID: ${record.discord_id || 'NULL'}`);
      console.log(`   Linked at: ${record.linked_at || 'NULL'}`);
      console.log(`   Is Active: ${record.is_active}`);
    });
    
    // Check if there are any other players with the same Discord ID
    console.log('\n📋 Step 2: Checking Discord ID conflicts...');
    if (brnytro11Records.length > 0 && brnytro11Records[0].discord_id) {
      const discordId = brnytro11Records[0].discord_id;
      const [conflicts] = await pool.query(`
        SELECT p.*, s.nickname as server_name
        FROM players p
        JOIN rust_servers s ON p.server_id = s.id
        WHERE p.discord_id = ?
        ORDER BY s.nickname, p.ign
      `, [discordId]);
      
      console.log(`Found ${conflicts.length} records with Discord ID ${discordId}:`);
      conflicts.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.ign} on ${record.server_name} (ID: ${record.id})`);
      });
    }
    
    // Check the linking logic in the bot code
    console.log('\n📋 Step 3: Simulating bot linking logic...');
    
    // Simulate what the bot does when checking for existing links
    const [existingLinks] = await pool.query(`
      SELECT p.*, s.nickname as server_name
      FROM players p
      JOIN rust_servers s ON p.server_id = s.id
      WHERE p.ign = 'BRNytro11'
      AND p.discord_id IS NOT NULL
      AND p.discord_id != ''
      AND p.is_active = 1
    `);
    
    console.log(`Active linked records for "BRNytro11": ${existingLinks.length}`);
    existingLinks.forEach((record, index) => {
      console.log(`   ${index + 1}. ${record.ign} on ${record.server_name} (Discord: ${record.discord_id})`);
    });
    
    // Check if there are any inactive records that might be causing issues
    console.log('\n📋 Step 4: Checking inactive records...');
    const [inactiveRecords] = await pool.query(`
      SELECT p.*, s.nickname as server_name
      FROM players p
      JOIN rust_servers s ON p.server_id = s.id
      WHERE p.ign = 'BRNytro11'
      AND (p.is_active = 0 OR p.is_active IS NULL)
    `);
    
    console.log(`Inactive records for "BRNytro11": ${inactiveRecords.length}`);
    inactiveRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. ${record.ign} on ${record.server_name} (Active: ${record.is_active})`);
    });
    
    // Check the specific error scenario
    console.log('\n📋 Step 5: Checking for cross-server duplicates...');
    const [crossServerDuplicates] = await pool.query(`
      SELECT 
        p.ign,
        COUNT(DISTINCT p.server_id) as server_count,
        GROUP_CONCAT(DISTINCT s.nickname SEPARATOR ', ') as servers
      FROM players p
      JOIN rust_servers s ON p.server_id = s.id
      WHERE p.ign = 'BRNytro11'
      GROUP BY p.ign
      HAVING COUNT(DISTINCT p.server_id) > 1
    `);
    
    if (crossServerDuplicates.length > 0) {
      console.log('Found cross-server duplicates:');
      crossServerDuplicates.forEach(dup => {
        console.log(`   ${dup.ign} appears on ${dup.server_count} servers: ${dup.servers}`);
      });
    } else {
      console.log('No cross-server duplicates found');
    }
    
    console.log('\n🎯 DIAGNOSIS COMPLETE!');
    console.log('Check the bot logs for the exact error message when linking fails.');
    
  } catch (error) {
    console.error('❌ Error debugging linking issue:', error);
  } finally {
    await pool.end();
  }
}

debugLinkingIssue(); 