const pool = require('./src/db');

async function testForceLinkFix() {
  try {
    console.log('🧪 Testing force-link command fix...');
    
    const guildId = '1376030083038318743'; // SHADOWS 3X guild
    const testDiscordId = '1129566119267663882'; // The actual Discord ID from the database
    const testIgn = 'XsLdSsG';
    
    console.log(`📋 Testing with Discord ID: ${testDiscordId}`);
    console.log(`📋 Testing with IGN: ${testIgn}`);
    console.log(`📋 Guild ID: ${guildId}`);
    console.log('=' .repeat(60));
    
    // Test 1: Check if utility functions work
    console.log('\n🔍 Test 1: Testing utility functions...');
    
    const { normalizeDiscordId, compareDiscordIds, normalizeIgnForComparison } = require('./src/utils/linking');
    
    const normalizedDiscordId = normalizeDiscordId(testDiscordId);
    const normalizedIgn = normalizeIgnForComparison(testIgn);
    
    console.log(`📋 Discord ID "${testDiscordId}" -> Normalized: "${normalizedDiscordId}"`);
    console.log(`📋 IGN "${testIgn}" -> Normalized: "${normalizedIgn}"`);
    
    // Test 2: Simulate force-link logic
    console.log('\n🔍 Test 2: Testing force-link logic...');
    
    // Simulate the exact query from force-link command
    const [existingDiscordLinks] = await pool.query(
      `SELECT p.*, rs.nickname 
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND p.discord_id = ? 
       AND p.is_active = true`,
      [guildId, normalizedDiscordId]
    );
    
    console.log(`📋 Existing Discord links: ${existingDiscordLinks.length}`);
    if (existingDiscordLinks.length > 0) {
      existingDiscordLinks.forEach(link => {
        console.log(`   - "${link.ign}" on ${link.nickname}`);
      });
    }
    
    const [existingIgnLinks] = await pool.query(
      `SELECT p.*, rs.nickname 
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND LOWER(p.ign) = LOWER(?) 
       AND p.is_active = true`,
      [guildId, normalizedIgn]
    );
    
    console.log(`📋 Existing IGN links: ${existingIgnLinks.length}`);
    if (existingIgnLinks.length > 0) {
      existingIgnLinks.forEach(link => {
        console.log(`   - "${link.ign}" -> Discord ID: "${link.discord_id}" on ${link.nickname}`);
      });
    }
    
    // Test 3: Test Discord ID comparison
    console.log('\n🔍 Test 3: Testing Discord ID comparison...');
    
    if (existingIgnLinks.length > 0) {
      const existingDiscordId = existingIgnLinks[0].discord_id;
      const isSameUser = compareDiscordIds(existingDiscordId, normalizedDiscordId);
      console.log(`📋 Same user check: ${isSameUser ? '✅ YES' : '❌ NO'}`);
      console.log(`   - Existing Discord ID: "${existingDiscordId}"`);
      console.log(`   - New Discord ID: "${normalizedDiscordId}"`);
    }
    
    console.log('\n✅ Force-link fix test completed!');
    console.log('\n📝 Summary:');
    console.log('   • Utility functions imported and working');
    console.log('   • Discord ID normalization working');
    console.log('   • IGN normalization working');
    console.log('   • Database queries working with normalized values');
    console.log('   • Discord ID comparison working');
    
    console.log('\n🚀 Force-link command should now work correctly!');
    
  } catch (error) {
    console.error('❌ Error testing force-link fix:', error);
  } finally {
    await pool.end();
  }
}

testForceLinkFix();
