const pool = require('./src/db');
const { sendRconCommand } = require('./src/rcon/index.js');

async function recreateZoneFix() {
  try {
    console.log('🔧 Recreating Zone with Correct Position...');
    
    const playerName = 'nzcve7130';
    
    // Get current zone data
    console.log(`\n1. Getting current zone data for ${playerName}...`);
    const [zoneResult] = await pool.query(`
      SELECT z.*, rs.nickname, rs.ip, rs.port, rs.password
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
    console.log(`Server: ${zone.nickname} (${zone.ip}:${zone.port})`);
    
    // Parse the current position
    let positionData;
    try {
      positionData = JSON.parse(zone.position);
      console.log(`Parsed position: ${JSON.stringify(positionData)}`);
    } catch (error) {
      console.log(`❌ Failed to parse position: ${error.message}`);
      return;
    }
    
    const [x, y, z] = positionData;
    const fixedPosition = `${x} ${y} ${z}`;
    console.log(`Fixed position: "${fixedPosition}"`);
    
    // Step 1: Delete the zone from the game
    console.log(`\n2. Deleting zone from game...`);
    try {
      await sendRconCommand(zone.ip, zone.port, zone.password, `zones.deletecustomzone "${zone.name}"`);
      console.log('✅ Zone deleted from game');
    } catch (error) {
      console.log(`⚠️  Zone deletion failed (might not exist): ${error.message}`);
    }
    
    // Step 2: Delete from database
    console.log(`\n3. Deleting zone from database...`);
    try {
      await pool.query('DELETE FROM zorp_zones WHERE id = ?', [zone.id]);
      console.log('✅ Zone deleted from database');
    } catch (error) {
      console.log(`❌ Database deletion failed: ${error.message}`);
      return;
    }
    
    // Step 3: Recreate zone with correct position
    console.log(`\n4. Recreating zone with correct position...`);
    
    const newZoneName = `ZORP_${Date.now()}`;
    const createCommand = `zones.addcustomzone "${newZoneName}" "${fixedPosition}" ${zone.size}`;
    
    try {
      await sendRconCommand(zone.ip, zone.port, zone.password, createCommand);
      console.log(`✅ Zone recreated in game: ${newZoneName}`);
    } catch (error) {
      console.log(`❌ Zone creation failed: ${error.message}`);
      return;
    }
    
    // Step 4: Insert new zone into database with correct position
    console.log(`\n5. Inserting new zone into database...`);
    
    const insertQuery = `
      INSERT INTO zorp_zones (
        server_id, name, owner, team, position, size, 
        color_online, color_offline, radiation, delay, expire, 
        min_team, max_team, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    
    try {
      await pool.query(insertQuery, [
        zone.server_id,
        newZoneName,
        zone.owner,
        zone.team,
        fixedPosition, // Use the fixed position format
        zone.size,
        zone.color_online,
        zone.color_offline,
        zone.radiation,
        zone.delay,
        zone.expire,
        zone.min_team,
        zone.max_team
      ]);
      console.log('✅ New zone inserted into database');
    } catch (error) {
      console.log(`❌ Database insertion failed: ${error.message}`);
      return;
    }
    
    // Step 5: Set zone to current color (green for online)
    console.log(`\n6. Setting zone color...`);
    try {
      await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${newZoneName}" allowbuilding 1`);
      await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${newZoneName}" allowbuildingdamage 1`);
      await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${newZoneName}" allowpvpdamage 1`);
      await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${newZoneName}" color (${zone.color_online})`);
      console.log('✅ Zone color set to green (online)');
    } catch (error) {
      console.log(`❌ Color setting failed: ${error.message}`);
    }
    
    console.log('\n🎉 Zone recreation completed!');
    console.log(`\n📝 New zone: ${newZoneName}`);
    console.log(`📝 Position: ${fixedPosition}`);
    console.log('\n📝 Next steps:');
    console.log('1. Restart the bot: pm2 restart zentro-bot');
    console.log('2. Test going offline to see if zone turns red');
    
  } catch (error) {
    console.error('❌ Error recreating zone:', error);
  } finally {
    await pool.end();
  }
}

recreateZoneFix(); 