const pool = require('./src/db');

async function fixServerNames() {
  try {
    console.log('🔧 SSH: Fixing Server Name Mismatches...');

    // Server name corrections needed
    const serverNameCorrections = {
      'EMPEROR 3X': 'Emperor 3x',
      'SNB1': 'Snowy Billiards 2x'
    };

    console.log('\n📋 Server Name Updates to Apply:');
    Object.entries(serverNameCorrections).forEach(([oldName, newName]) => {
      console.log(`   "${oldName}" -> "${newName}"`);
    });

    // Check current state
    console.log('\n🔍 Current Server Names:');
    const [currentServers] = await pool.query('SELECT id, nickname, guild_id FROM rust_servers');
    currentServers.forEach(server => {
      console.log(`   ID: ${server.id}, Name: "${server.nickname}", Guild ID: ${server.guild_id}`);
    });

    // Apply corrections
    console.log('\n🔄 Applying server name corrections...');
    for (const [oldName, newName] of Object.entries(serverNameCorrections)) {
      try {
        const [updateResult] = await pool.query(
          'UPDATE rust_servers SET nickname = ? WHERE nickname = ?',
          [newName, oldName]
        );
        
        if (updateResult.affectedRows > 0) {
          console.log(`✅ Updated server name: "${oldName}" -> "${newName}"`);
        } else {
          console.log(`⚠️  Server "${oldName}" not found in database`);
        }
      } catch (error) {
        console.error(`❌ Error updating server name "${oldName}":`, error.message);
      }
    }

    // Verify the changes
    console.log('\n✅ Verifying server name changes...');
    const [updatedServers] = await pool.query(`
      SELECT rs.id, rs.nickname, rs.guild_id, g.discord_id 
      FROM rust_servers rs 
      LEFT JOIN guilds g ON rs.guild_id = g.id
    `);
    
    console.log('\nFinal Server Configuration:');
    updatedServers.forEach(server => {
      console.log(`   "${server.nickname}":`);
      console.log(`     ID: ${server.id}`);
      console.log(`     Guild ID: ${server.guild_id}`);
      console.log(`     Discord ID: ${server.discord_id}`);
    });

    // Final verification against expected mappings
    const expectedMappings = {
      'Emperor 3x': '1342235198175182921',
      'Rise 3x': '1391149977434329230', 
      'Snowy Billiards 2x': '1379533411009560626',
      'Shadows 3x': '1391209638308872254'
    };

    console.log('\n🔍 Final Guild ID Verification:');
    updatedServers.forEach(server => {
      const expectedDiscordId = expectedMappings[server.nickname];
      if (expectedDiscordId) {
        const match = server.discord_id === expectedDiscordId;
        console.log(`   ${server.nickname}:`);
        console.log(`     Current Discord ID: ${server.discord_id}`);
        console.log(`     Expected Discord ID: ${expectedDiscordId}`);
        console.log(`     Status: ${match ? '✅ CORRECT' : '❌ MISMATCH'}`);
      }
    });

    console.log('\n🎉 Server name fix completed!');
    console.log('💡 All servers should now be properly mapped to their guild IDs.');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixServerNames().catch(console.error);