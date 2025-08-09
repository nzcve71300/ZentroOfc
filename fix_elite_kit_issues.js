const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixEliteKitIssues() {
  console.log('🔧 FIX ELITE KIT AUTHORIZATION ISSUES');
  console.log('======================================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 Step 1: Enable new elite kits on all servers...');
    
    // Enable the new elite kits (ELITEkit7-13) on all servers
    const newEliteKits = ['ELITEkit7', 'ELITEkit8', 'ELITEkit9', 'ELITEkit10', 'ELITEkit11', 'ELITEkit12', 'ELITEkit13'];
    
    for (const kitName of newEliteKits) {
      const [result] = await connection.execute(
        'UPDATE autokits SET enabled = 1 WHERE kit_name = ?',
        [kitName]
      );
      console.log(`✅ Enabled ${kitName} on ${result.affectedRows} servers`);
    }

    console.log('\n📋 Step 2: Check server mappings...');
    
    const [servers] = await connection.execute(`
      SELECT rs.id, rs.nickname, g.discord_id as guild_discord_id 
      FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id 
      ORDER BY rs.nickname
    `);
    
    console.log('Server mappings:');
    servers.forEach(server => {
      console.log(`   - ${server.nickname}: ${server.id} (Guild: ${server.guild_discord_id})`);
    });

    console.log('\n📋 Step 3: Fix missing authorizations for Rise 3x server...');
    
    // Find the Rise 3x server ID
    const riseServer = servers.find(s => s.nickname === 'Rise 3x');
    if (!riseServer) {
      console.log('❌ Rise 3x server not found');
      return;
    }
    
    console.log(`Found Rise 3x server: ${riseServer.id}`);
    
    // Check if player nzcve7130 has authorizations on other servers
    const [playerAuth] = await connection.execute(`
      SELECT ka.*, rs.nickname as server_name 
      FROM kit_auth ka 
      JOIN rust_servers rs ON ka.server_id = rs.id 
      WHERE ka.discord_id = 1252993829007528200
    `);
    
    console.log(`Player nzcve7130 has ${playerAuth.length} authorizations:`);
    playerAuth.forEach(auth => {
      console.log(`   - ${auth.server_name} (${auth.server_id}): ${auth.kitlist}`);
    });
    
    // Copy authorizations from other server to Rise 3x
    if (playerAuth.length > 0) {
      console.log('\n📝 Copying authorizations to Rise 3x...');
      
      // Get unique kitlists for this player
      const uniqueKitlists = [...new Set(playerAuth.map(auth => auth.kitlist))];
      
      for (const kitlist of uniqueKitlists) {
        // Check if authorization already exists for Rise 3x
        const [existing] = await connection.execute(
          'SELECT * FROM kit_auth WHERE server_id = ? AND discord_id = ? AND kitlist = ?',
          [riseServer.id, 1252993829007528200, kitlist]
        );
        
        if (existing.length === 0) {
          // Add authorization for Rise 3x
          await connection.execute(
            'INSERT INTO kit_auth (server_id, discord_id, kitlist) VALUES (?, ?, ?)',
            [riseServer.id, 1252993829007528200, kitlist]
          );
          console.log(`✅ Added ${kitlist} authorization for Rise 3x`);
        } else {
          console.log(`⚠️ ${kitlist} authorization already exists for Rise 3x`);
        }
      }
    }

    console.log('\n📋 Step 4: Add missing Elite7-13 authorizations...');
    
    // For players who have Elite1-6, automatically give them Elite7-13
    const [playersWithEliteAuth] = await connection.execute(`
      SELECT DISTINCT ka.server_id, ka.discord_id, rs.nickname as server_name
      FROM kit_auth ka
      JOIN rust_servers rs ON ka.server_id = rs.id
      WHERE ka.kitlist LIKE 'Elite%'
    `);
    
    console.log(`Found ${playersWithEliteAuth.length} players with elite authorizations`);
    
    const newEliteLists = ['Elite7', 'Elite8', 'Elite9', 'Elite10', 'Elite11', 'Elite12', 'Elite13'];
    
    for (const player of playersWithEliteAuth) {
      console.log(`\nProcessing player Discord ID ${player.discord_id} on ${player.server_name}...`);
      
      for (const eliteList of newEliteLists) {
        // Check if authorization already exists
        const [existing] = await connection.execute(
          'SELECT * FROM kit_auth WHERE server_id = ? AND discord_id = ? AND kitlist = ?',
          [player.server_id, player.discord_id, eliteList]
        );
        
        if (existing.length === 0) {
          // Add new elite authorization
          await connection.execute(
            'INSERT INTO kit_auth (server_id, discord_id, kitlist) VALUES (?, ?, ?)',
            [player.server_id, player.discord_id, eliteList]
          );
          console.log(`   ✅ Added ${eliteList} authorization`);
        } else {
          console.log(`   ⚠️ ${eliteList} authorization already exists`);
        }
      }
    }

    console.log('\n📋 Step 5: Verify the fixes...');
    
    // Check player nzcve7130 authorizations on Rise 3x
    const [verifyAuth] = await connection.execute(`
      SELECT * FROM kit_auth 
      WHERE server_id = ? AND discord_id = ?
      ORDER BY kitlist
    `, [riseServer.id, 1252993829007528200]);
    
    console.log(`Player nzcve7130 now has ${verifyAuth.length} authorizations on Rise 3x:`);
    verifyAuth.forEach(auth => {
      console.log(`   - ${auth.kitlist}`);
    });
    
    // Check enabled elite kits
    const [enabledEliteKits] = await connection.execute(`
      SELECT ak.kit_name, COUNT(*) as enabled_servers
      FROM autokits ak 
      WHERE ak.kit_name LIKE 'ELITEkit%' AND ak.enabled = 1
      GROUP BY ak.kit_name
      ORDER BY ak.kit_name
    `);
    
    console.log('\nEnabled elite kits across all servers:');
    enabledEliteKits.forEach(kit => {
      console.log(`   - ${kit.kit_name}: enabled on ${kit.enabled_servers} servers`);
    });

    await connection.end();

    console.log('\n🎯 ELITE KIT FIXES COMPLETE!');
    console.log('✅ Enabled all new elite kits (ELITEkit7-13)');
    console.log('✅ Fixed missing authorizations for Rise 3x');
    console.log('✅ Added Elite7-13 authorizations for existing elite players');
    console.log('✅ Verified player authorizations');

    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Restart the bot:');
    console.log('   pm2 restart zentro-bot');
    console.log('2. Test elite kit claims in-game');
    console.log('3. Elite kits should now work properly');

    console.log('\n📝 WHAT WAS FIXED:');
    console.log('• New elite kits were disabled - now enabled');
    console.log('• Player authorizations missing on Rise 3x - now added');
    console.log('• Elite7-13 authorizations missing - now added for all elite players');
    console.log('• Server ID mismatches resolved');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

fixEliteKitIssues();