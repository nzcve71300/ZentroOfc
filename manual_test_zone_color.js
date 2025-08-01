const pool = require('./src/db');
const { sendRconCommand } = require('./src/rcon/index.js');

async function manualTestZoneColor() {
  try {
    console.log('🔍 Manual Zone Color Test...');
    
    const playerName = 'nzcve7130';
    
    // Get zone and server details
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
    console.log(`✅ Found zone: ${zone.name}`);
    console.log(`📍 Server: ${zone.nickname} (${zone.ip}:${zone.port})`);
    console.log(`🎨 Online color: ${zone.color_online}`);
    console.log(`🔴 Offline color: ${zone.color_offline}`);
    
    // Test RCON connection
    console.log('\n📡 Testing RCON connection...');
    try {
      const testResult = await sendRconCommand(zone.ip, zone.port, zone.password, 'echo "RCON connection test"');
      console.log('✅ RCON connection successful');
      console.log(`Response: ${testResult}`);
    } catch (error) {
      console.error('❌ RCON connection failed:', error.message);
      return;
    }
    
    // Test zone color commands
    console.log('\n🎨 Testing zone color commands...');
    
    const commands = [
      `zones.editcustomzone "${zone.name}" allowbuilding 1`,
      `zones.editcustomzone "${zone.name}" allowbuildingdamage 0`,
      `zones.editcustomzone "${zone.name}" allowpvpdamage 0`,
      `zones.editcustomzone "${zone.name}" color (${zone.color_offline})`
    ];
    
    for (const command of commands) {
      try {
        console.log(`\n📡 Sending: ${command}`);
        const result = await sendRconCommand(zone.ip, zone.port, zone.password, command);
        console.log(`✅ Success: ${result}`);
      } catch (error) {
        console.error(`❌ Failed: ${error.message}`);
      }
    }
    
    // Test zone info command
    console.log('\n📋 Getting zone info...');
    try {
      const zoneInfo = await sendRconCommand(zone.ip, zone.port, zone.password, `zones.info "${zone.name}"`);
      console.log(`Zone info: ${zoneInfo}`);
    } catch (error) {
      console.error(`❌ Failed to get zone info: ${error.message}`);
    }
    
    console.log('\n🎉 Manual zone color test completed!');
    
  } catch (error) {
    console.error('❌ Error in manual zone color test:', error);
  } finally {
    await pool.end();
  }
}

manualTestZoneColor(); 