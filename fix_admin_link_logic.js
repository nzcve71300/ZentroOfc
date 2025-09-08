const pool = require('./src/db');

/**
 * Test the admin-link logic to identify issues
 */
async function testAdminLinkLogic() {
  try {
    console.log('🔍 Testing admin-link logic...\n');
    
    // Simulate what happens when admin-link is called
    const testDiscordId = '1234567890123456789'; // Test Discord ID
    const testIgn = 'TestPlayer123';
    const testGuildId = '1234567890123456789'; // Test Guild ID
    
    console.log('📋 Simulating admin-link process:');
    console.log(`  Discord ID: ${testDiscordId}`);
    console.log(`  IGN: ${testIgn}`);
    console.log(`  Guild ID: ${testGuildId}`);
    
    // Step 1: Check for existing Discord links
    console.log('\n🔍 Step 1: Checking for existing Discord links...');
    const [existingDiscordLinks] = await pool.query(`
      SELECT p.*, rs.nickname 
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
      AND p.discord_id = ? 
      AND p.is_active = true
    `, [testGuildId, testDiscordId]);
    
    console.log(`  Found ${existingDiscordLinks.length} existing active Discord links`);
    
    // Step 2: Check IGN availability
    console.log('\n🔍 Step 2: Checking IGN availability...');
    const [guildResult] = await pool.query(
      'SELECT id FROM guilds WHERE discord_id = ?',
      [testGuildId]
    );
    
    if (guildResult.length > 0) {
      const dbGuildId = guildResult[0].id;
      
      // Check if IGN is already linked to someone else
      const [ignLinks] = await pool.query(`
        SELECT p.id, p.ign, p.discord_id, p.is_active, rs.nickname
        FROM players p
        JOIN rust_servers rs ON p.server_id = rs.id
        WHERE p.guild_id = ? AND p.normalized_ign = ? AND p.is_active = true
      `, [dbGuildId, testIgn.toLowerCase()]);
      
      console.log(`  Found ${ignLinks.length} existing IGN links`);
      
      for (const link of ignLinks) {
        const discordInfo = link.discord_id ? `Discord=${link.discord_id}` : 'Discord=null';
        console.log(`    ID=${link.id}, IGN="${link.ign}", ${discordInfo}, Server=${link.nickname}`);
      }
    }
    
    // Step 3: Check for inactive records
    console.log('\n🔍 Step 3: Checking for inactive records...');
    const [inactiveRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, rs.nickname
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
      AND (p.discord_id = ? OR p.normalized_ign = ?)
      AND p.is_active = false
    `, [testGuildId, testDiscordId, testIgn.toLowerCase()]);
    
    console.log(`  Found ${inactiveRecords.length} inactive records`);
    
    for (const record of inactiveRecords) {
      const discordInfo = record.discord_id ? `Discord=${record.discord_id}` : 'Discord=null';
      console.log(`    ID=${record.id}, IGN="${record.ign}", ${discordInfo}, Server=${record.nickname}`);
    }
    
    console.log('\n✅ Admin-link logic test completed');
    
  } catch (error) {
    console.error('❌ Error testing admin-link logic:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testAdminLinkLogic();
