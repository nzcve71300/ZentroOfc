const pool = require('./src/db');

async function checkZorpTeamLeave() {
  try {
    console.log('🔍 Checking Zorp Team Leave Logic...');
    
    const playerName = 'nzcve7130';
    
    // Check if player has any zones before team leave
    console.log(`\n1. Checking zones for ${playerName} before team leave simulation...`);
    const [beforeZones] = await pool.query(`
      SELECT z.*, rs.nickname 
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.owner = ? AND z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
    `, [playerName]);
    
    console.log(`Found ${beforeZones.length} active zones for ${playerName}:`);
    beforeZones.forEach(zone => {
      console.log(`  - ${zone.name} on ${zone.nickname} (ID: ${zone.id})`);
    });

    // Simulate the deleteZorpZoneOnTeamLeave function
    console.log(`\n2. Simulating deleteZorpZoneOnTeamLeave for ${playerName}...`);
    
    // Get all active zones for this player (same query as in the function)
    const [zones] = await pool.query(`
      SELECT z.*, rs.nickname, rs.ip, rs.port, rs.password, g.discord_id
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE z.owner = ? AND z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
    `, [playerName]);
    
    console.log(`Found ${zones.length} zones to potentially delete:`);
    zones.forEach(zone => {
      console.log(`  - Zone: ${zone.name}, Server: ${zone.nickname}, ID: ${zone.id}`);
      console.log(`    Server details: ${zone.ip}:${zone.port}`);
    });

    if (zones.length === 0) {
      console.log(`No active zones found for ${playerName}`);
      return;
    }

    // Check if zones would actually be deleted
    console.log(`\n3. Checking if zones would be deleted...`);
    for (const zone of zones) {
      try {
        console.log(`\nProcessing zone: ${zone.name}`);
        
        // Check if zone exists in database
        const [zoneCheck] = await pool.query('SELECT * FROM zorp_zones WHERE id = ?', [zone.id]);
        if (zoneCheck.length === 0) {
          console.log(`  ❌ Zone ${zone.name} (ID: ${zone.id}) not found in database`);
          continue;
        }
        
        console.log(`  ✅ Zone ${zone.name} (ID: ${zone.id}) found in database`);
        console.log(`  📍 Server: ${zone.nickname} (${zone.ip}:${zone.port})`);
        
        // Note: We won't actually delete the zones in this test
        console.log(`  ⚠️  Would delete zone ${zone.name} from game and database`);
        
      } catch (error) {
        console.error(`  ❌ Error processing zone ${zone.name}:`, error);
      }
    }

    // Check if there are any issues with the query
    console.log(`\n4. Testing query variations...`);
    
    // Test the exact query from deleteZorpZoneOnTeamLeave
    const [testQuery] = await pool.query(`
      SELECT z.*, rs.nickname, rs.ip, rs.port, rs.password, g.discord_id
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE z.owner = ? AND z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
    `, [playerName]);
    
    console.log(`Query result: ${testQuery.length} zones found`);
    
    // Test without the expire condition
    const [allZones] = await pool.query(`
      SELECT z.*, rs.nickname, rs.ip, rs.port, rs.password, g.discord_id
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE z.owner = ?
    `, [playerName]);
    
    console.log(`All zones (including expired): ${allZones.length} zones found`);

    console.log('\n🎉 Team leave check completed!');

  } catch (error) {
    console.error('❌ Error checking Zorp team leave:', error);
  } finally {
    await pool.end();
  }
}

checkZorpTeamLeave(); 