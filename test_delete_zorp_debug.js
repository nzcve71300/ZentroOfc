const pool = require('./src/db');

async function testDeleteZorpDebug() {
  console.log('🧪 Testing Delete-Zorp Debug...');
  console.log('================================\n');

  try {
    // Test 1: Check all active Zorp zones
    console.log('📋 Test 1: All Active Zorp Zones');
    const [zones] = await pool.query(`
      SELECT z.name, z.owner, rs.nickname, g.discord_id
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      ORDER BY z.created_at DESC
    `);

    if (zones.length === 0) {
      console.log('❌ No active Zorp zones found');
    } else {
      console.log(`✅ Found ${zones.length} active Zorp zones:`);
      zones.forEach((zone, index) => {
        console.log(`  ${index + 1}. Zone: ${zone.name} | Owner: "${zone.owner}" | Server: ${zone.nickname} | Guild ID: ${zone.discord_id}`);
      });
    }

    // Test 2: Test the exact query that the command uses
    console.log('\n📋 Test 2: Command Query Test');
    
    // Get a sample guild ID and player name for testing
    if (zones.length > 0) {
      const sampleZone = zones[0];
      const guildId = sampleZone.discord_id;
      const playerName = sampleZone.owner;
      
      console.log(`Testing with guild_id: ${guildId}, player_name: "${playerName}"`);
      
      const [testResult] = await pool.query(`
        SELECT z.*, rs.ip, rs.port, rs.password, rs.nickname
        FROM zorp_zones z
        JOIN rust_servers rs ON z.server_id = rs.id
        JOIN guilds g ON rs.guild_id = g.id
        WHERE g.discord_id = ? AND z.owner = ?
      `, [guildId, playerName]);
      
      console.log(`Query returned ${testResult.length} results`);
      if (testResult.length > 0) {
        console.log(`Found zone: ${testResult[0].name}`);
      }
    }

    // Test 3: Test case sensitivity
    console.log('\n📋 Test 3: Case Sensitivity Test');
    if (zones.length > 0) {
      const sampleZone = zones[0];
      const guildId = sampleZone.discord_id;
      const playerName = sampleZone.owner;
      
      console.log(`Original player name: "${playerName}"`);
      console.log(`Uppercase: "${playerName.toUpperCase()}"`);
      console.log(`Lowercase: "${playerName.toLowerCase()}"`);
      
      // Test with different cases
      const cases = [
        playerName,
        playerName.toUpperCase(),
        playerName.toLowerCase(),
        playerName.trim()
      ];
      
      for (const testCase of cases) {
        const [caseResult] = await pool.query(`
          SELECT z.*, rs.ip, rs.port, rs.password, rs.nickname
          FROM zorp_zones z
          JOIN rust_servers rs ON z.server_id = rs.id
          JOIN guilds g ON rs.guild_id = g.id
          WHERE g.discord_id = ? AND z.owner = ?
        `, [guildId, testCase]);
        
        console.log(`Case "${testCase}": ${caseResult.length} results`);
      }
    }

    // Test 4: Test with exact match vs LIKE
    console.log('\n📋 Test 4: Exact Match vs LIKE Test');
    if (zones.length > 0) {
      const sampleZone = zones[0];
      const guildId = sampleZone.discord_id;
      const playerName = sampleZone.owner;
      
      // Test exact match
      const [exactResult] = await pool.query(`
        SELECT z.*, rs.ip, rs.port, rs.password, rs.nickname
        FROM zorp_zones z
        JOIN rust_servers rs ON z.server_id = rs.id
        JOIN guilds g ON rs.guild_id = g.id
        WHERE g.discord_id = ? AND z.owner = ?
      `, [guildId, playerName]);
      
      // Test case-insensitive match
      const [likeResult] = await pool.query(`
        SELECT z.*, rs.ip, rs.port, rs.password, rs.nickname
        FROM zorp_zones z
        JOIN rust_servers rs ON z.server_id = rs.id
        JOIN guilds g ON rs.guild_id = g.id
        WHERE g.discord_id = ? AND LOWER(z.owner) = LOWER(?)
      `, [guildId, playerName]);
      
      console.log(`Exact match: ${exactResult.length} results`);
      console.log(`Case-insensitive match: ${likeResult.length} results`);
    }

    // Test 5: Common issues
    console.log('\n📋 Test 5: Common Issues Check');
    console.log('Possible issues:');
    console.log('1. Player name has extra spaces');
    console.log('2. Case sensitivity mismatch');
    console.log('3. Guild ID mismatch');
    console.log('4. Player name not found in database');
    console.log('5. Zone expired or already deleted');

    // Test 6: Show all guilds
    console.log('\n📋 Test 6: Available Guilds');
    const [guilds] = await pool.query('SELECT id, discord_id, name FROM guilds');
    console.log(`Found ${guilds.length} guilds:`);
    guilds.forEach(guild => {
      console.log(`  Guild ID: ${guild.discord_id} | Name: ${guild.name || 'Unknown'}`);
    });

  } catch (error) {
    console.error('❌ Error testing delete-zorp debug:', error);
  } finally {
    await pool.end();
  }
}

// Run test if called directly
if (require.main === module) {
  testDeleteZorpDebug()
    .then(() => {
      console.log('\n✅ DELETE-ZORP DEBUG TEST COMPLETE!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ TEST FAILED:', error);
      process.exit(1);
    });
}

module.exports = {
  testDeleteZorpDebug
};
