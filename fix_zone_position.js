const pool = require('./src/db');

async function fixZonePosition() {
  try {
    console.log('🔧 Fixing Zone Position Data...');
    
    const playerName = 'nzcve7130';
    
    // Check current zone data
    console.log(`\n1. Checking current zone data for ${playerName}...`);
    const [zoneResult] = await pool.query(`
      SELECT z.*, rs.nickname
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.owner = ? AND z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
    `, [playerName]);
    
    if (zoneResult.length === 0) {
      console.log('❌ No active zone found for player');
      return;
    }
    
    const zone = zoneResult[0];
    console.log(`Current zone: ${zone.name}`);
    console.log(`Current position: ${zone.position}`);
    console.log(`Current size: ${zone.size}`);
    
    // The issue is that the position data is stored as a JSON array string
    // but the zone restoration code expects a different format
    console.log(`\n2. Position data type: ${typeof zone.position}`);
    console.log(`Position data: ${zone.position}`);
    
    // Parse the position data
    let positionData;
    try {
      positionData = JSON.parse(zone.position);
      console.log(`Parsed position: ${JSON.stringify(positionData)}`);
    } catch (error) {
      console.log(`❌ Failed to parse position: ${error.message}`);
      return;
    }
    
    // Check if position data is valid
    if (!Array.isArray(positionData) || positionData.length !== 3) {
      console.log('❌ Invalid position data format');
      return;
    }
    
    const [x, y, z] = positionData;
    console.log(`X: ${x}, Y: ${y}, Z: ${z}`);
    
    // Check if coordinates are reasonable
    if (Math.abs(x) > 10000 || Math.abs(y) > 10000 || Math.abs(z) > 10000) {
      console.log('⚠️  Position coordinates seem very large - this might be the issue');
    }
    
    // The problem might be that the position is stored as a JSON array
    // but the zone restoration expects a different format
    console.log(`\n3. Attempting to fix position data...`);
    
    // Convert to the expected format (space-separated string)
    const fixedPosition = `${x} ${y} ${z}`;
    console.log(`Fixed position format: "${fixedPosition}"`);
    
    // Update the zone with the fixed position
    try {
      await pool.query(
        'UPDATE zorp_zones SET position = ? WHERE id = ?',
        [fixedPosition, zone.id]
      );
      console.log('✅ Position data updated successfully');
      
      // Verify the update
      const [updatedZone] = await pool.query(
        'SELECT position FROM zorp_zones WHERE id = ?',
        [zone.id]
      );
      console.log(`Updated position: ${updatedZone[0].position}`);
      
    } catch (error) {
      console.error('❌ Failed to update position:', error.message);
    }
    
    console.log('\n🎉 Zone position fix completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Restart the bot: pm2 restart zentro-bot');
    console.log('2. Check if zone is restored properly');
    console.log('3. Test going offline to see if zone turns red');
    
  } catch (error) {
    console.error('❌ Error fixing zone position:', error);
  } finally {
    await pool.end();
  }
}

fixZonePosition(); 