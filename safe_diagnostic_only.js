const pool = require('./src/db');

async function safeDiagnosticOnly() {
  try {
    console.log('🔍 SAFE DIAGNOSTIC - READ ONLY (No changes will be made)');
    console.log('='.repeat(60));
    
    const playerIgn = 'XsLdSsG';
    
    // Find ALL guilds and their servers
    console.log('\n📋 ALL GUILDS AND SERVERS:');
    const [allGuilds] = await pool.query(`
      SELECT g.discord_id, g.name, g.id as db_id,
             COUNT(rs.id) as server_count
      FROM guilds g
      LEFT JOIN rust_servers rs ON g.id = rs.guild_id
      GROUP BY g.id, g.discord_id, g.name
      ORDER BY g.name
    `);
    
    for (const guild of allGuilds) {
      console.log(`\n🏛️ Guild: ${guild.name}`);
      console.log(`   Discord ID: ${guild.discord_id}`);
      console.log(`   DB ID: ${guild.db_id}`);
      console.log(`   Servers: ${guild.server_count}`);
      
      if (guild.server_count > 0) {
        const [servers] = await pool.query('SELECT * FROM rust_servers WHERE guild_id = ?', [guild.db_id]);
        for (const server of servers) {
          console.log(`     - ${server.nickname} (${server.id})`);
        }
      }
    }
    
    // Find ALL records for this player across ALL guilds
    console.log(`\n👤 ALL RECORDS FOR ${playerIgn}:`);
    const [allPlayerRecords] = await pool.query(`
      SELECT p.*, rs.nickname as server_name, g.discord_id as guild_discord_id, g.name as guild_name
      FROM players p
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      LEFT JOIN guilds g ON p.guild_id = g.id
      WHERE LOWER(p.ign) = LOWER(?)
      ORDER BY p.linked_at DESC
    `, [playerIgn]);
    
    console.log(`Found ${allPlayerRecords.length} total records:`);
    for (let i = 0; i < allPlayerRecords.length; i++) {
      const record = allPlayerRecords[i];
      console.log(`\n📝 Record ${i + 1}:`);
      console.log(`   Player ID: ${record.id}`);
      console.log(`   Guild: ${record.guild_name} (${record.guild_discord_id})`);
      console.log(`   Server: ${record.server_name} (${record.server_id})`);
      console.log(`   Discord ID: ${record.discord_id || 'NULL'}`);
      console.log(`   Active: ${record.is_active ? 'YES' : 'NO'}`);
      console.log(`   Linked: ${record.linked_at || 'Never'}`);
      console.log(`   Unlinked: ${record.unlinked_at || 'Never'}`);
      
      // Check economy record
      if (record.id) {
        const [economy] = await pool.query('SELECT * FROM economy WHERE player_id = ?', [record.id]);
        console.log(`   Economy: ${economy.length > 0 ? `Balance ${economy[0].balance}` : 'No record'}`);
      }
    }
    
    // Test link command logic for each guild that has servers
    console.log(`\n🧪 TESTING LINK COMMAND LOGIC:`);
    
    for (const guild of allGuilds) {
      if (guild.server_count > 0) {
        console.log(`\n🔍 Testing guild: ${guild.name} (${guild.discord_id})`);
        
        // Run the exact query from the link command
        const [linkQuery] = await pool.query(`
          SELECT p.*, rs.nickname 
          FROM players p
          JOIN rust_servers rs ON p.server_id = rs.id
          WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
          AND LOWER(p.ign) = LOWER(?)`,
          [guild.discord_id, playerIgn]
        );
        
        console.log(`   Link query result: ${linkQuery.length} records`);
        
        if (linkQuery.length > 0) {
          for (const record of linkQuery) {
            console.log(`     - ${record.ign} on ${record.nickname} (Active: ${record.is_active})`);
            console.log(`       Discord ID: ${record.discord_id || 'NULL'}`);
          }
          
          // Simulate the link command logic
          const activeRecords = linkQuery.filter(record => record.is_active);
          console.log(`   Active records: ${activeRecords.length}`);
          
          if (activeRecords.length > 0) {
            console.log(`   ❌ Link would be BLOCKED - IGN already linked`);
            console.log(`   Error message would show servers: ${linkQuery.map(p => p.nickname).join(', ')}`);
          } else {
            console.log(`   ✅ Link would be ALLOWED - all records inactive`);
          }
        } else {
          console.log(`   ✅ Link would be ALLOWED - no records found`);
        }
      }
    }
    
    // Check for any edge cases
    console.log(`\n🔍 EDGE CASE ANALYSIS:`);
    
    // Check for case sensitivity issues
    const [caseCheck] = await pool.query(`
      SELECT DISTINCT ign, COUNT(*) as count
      FROM players 
      WHERE ign LIKE '%${playerIgn}%' OR LOWER(ign) LIKE LOWER('%${playerIgn}%')
      GROUP BY ign
    `);
    
    console.log(`IGN variations found: ${caseCheck.length}`);
    for (const variation of caseCheck) {
      console.log(`   "${variation.ign}" - ${variation.count} record(s)`);
    }
    
    // Check for any servers with similar names
    const [serverNameCheck] = await pool.query(`
      SELECT rs.*, g.discord_id as guild_discord_id
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
      WHERE rs.nickname LIKE '%SHADOW%' OR rs.nickname LIKE '%3X%'
    `);
    
    console.log(`\nServers with similar names: ${serverNameCheck.length}`);
    for (const server of serverNameCheck) {
      console.log(`   ${server.nickname} in guild ${server.guild_discord_id}`);
    }
    
    console.log(`\n🎯 DIAGNOSIS SUMMARY:`);
    console.log(`- Player has ${allPlayerRecords.length} total record(s) across all guilds`);
    console.log(`- Found ${allGuilds.length} total guild(s) in database`);
    console.log(`- Found ${allGuilds.filter(g => g.server_count > 0).length} guild(s) with servers`);
    
    const activePlayerRecords = allPlayerRecords.filter(r => r.is_active);
    console.log(`- Player has ${activePlayerRecords.length} ACTIVE record(s)`);
    
    if (activePlayerRecords.length > 0) {
      console.log(`- Active records are in:`);
      for (const record of activePlayerRecords) {
        console.log(`  * ${record.guild_name} (${record.guild_discord_id}) on ${record.server_name}`);
      }
    }
    
    console.log('\n💡 This diagnostic shows the exact state without making any changes.');
    console.log('   Review the results to identify why linking is being blocked.');
    
  } catch (error) {
    console.error('❌ Error in safe diagnostic:', error);
  } finally {
    await pool.end();
  }
}

safeDiagnosticOnly();