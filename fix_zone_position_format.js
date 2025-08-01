const pool = require('./src/db');

async function fixZonePositionFormat() {
  try {
    console.log('🔧 Fixing Zone Position Format...');
    
    // Get the current zone
    console.log('\n1. Getting current zone...');
    const [zoneResult] = await pool.query(`
      SELECT * FROM zorp_zones WHERE name = 'ZORP_1754010669190'
    `);
    
    if (zoneResult.length === 0) {
      console.log('❌ Zone not found');
      return;
    }
    
    const zone = zoneResult[0];
    console.log(`Current zone: ${zone.name}`);
    console.log(`Current position: ${zone.position}`);
    
    // Parse the current position (array format)
    let positionArray;
    try {
      positionArray = JSON.parse(zone.position);
      console.log(`Parsed position array: ${JSON.stringify(positionArray)}`);
    } catch (error) {
      console.log(`❌ Failed to parse position: ${error.message}`);
      return;
    }
    
    // Convert to object format that restoration code expects
    const positionObject = {
      x: positionArray[0],
      y: positionArray[1], 
      z: positionArray[2]
    };
    
    console.log(`\n2. Converting to object format...`);
    console.log(`Position object: ${JSON.stringify(positionObject)}`);
    
    // Update the zone with the correct format
    console.log(`\n3. Updating zone position...`);
    try {
      await pool.query(
        'UPDATE zorp_zones SET position = ? WHERE id = ?',
        [JSON.stringify(positionObject), zone.id]
      );
      console.log('✅ Zone position updated successfully');
      
      // Verify the update
      const [updatedZone] = await pool.query(
        'SELECT position FROM zorp_zones WHERE id = ?',
        [zone.id]
      );
      console.log(`Updated position: ${updatedZone[0].position}`);
      
    } catch (error) {
      console.log(`❌ Failed to update position: ${error.message}`);
      return;
    }
    
    console.log('\n🎉 Zone position format fix completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Restart the bot: pm2 restart zentro-bot');
    console.log('2. Check if zone restoration works');
    console.log('3. Test going offline to see if zone turns red');
    
  } catch (error) {
    console.error('❌ Error fixing zone position format:', error);
  } finally {
    await pool.end();
  }
}

fixZonePositionFormat(); 