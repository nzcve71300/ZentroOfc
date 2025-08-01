const pool = require('./src/db');
const { sendRconCommand } = require('./src/rcon/index.js');

async function checkAndRecreateZone() {
  try {
    console.log('🔍 Checking and Recreating Zone...');
    
    const playerName = 'nzcve7130';
    
    // Check all zones for this player (including expired)
    console.log(`\n1. Checking all zones for ${playerName}...`);
    const [allZones] = await pool.query(`
      SELECT z.*, rs.nickname, rs.ip, rs.port, rs.password
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.owner = ?
      ORDER BY z.created_at DESC
    `, [playerName]);
    
    console.log(`Found ${allZones.length} total zones for ${playerName}:`);
    allZones.forEach(zone => {
      const expireTime = new Date(new Date(zone.created_at).getTime() + zone.expire * 1000);
      const isExpired = new Date() > expireTime;
      console.log(`  - ${zone.name} (created: ${zone.created_at}, expired: ${isExpired})`);
    });
    
    // Get server info
    console.log(`\n2. Getting server info...`);
    const [serverResult] = await pool.query(`
      SELECT rs.*, g.discord_id
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
      WHERE rs.nickname = 'Rise 3x'
      LIMIT 1
    `);
    
    if (serverResult.length === 0) {
      console.log('❌ Server not found');
      return;
    }
    
    const server = serverResult[0];
    console.log(`✅ Found server: ${server.nickname} (${server.ip}:${server.port})`);
    
    // Get zorp defaults
    console.log(`\n3. Getting Zorp defaults...`);
    const [defaultsResult] = await pool.query(
      'SELECT * FROM zorp_defaults WHERE server_id = ?',
      [server.id]
    );
    
    if (defaultsResult.length === 0) {
      console.log('❌ No Zorp defaults found for server');
      return;
    }
    
    const defaults = defaultsResult[0];
    console.log(`✅ Found Zorp defaults: size=${defaults.size}, expire=${defaults.expire}s`);
    
    // Create a new zone
    console.log(`\n4. Creating new zone...`);
    
    const newZoneName = `ZORP_${Date.now()}`;
    const position = "8.19 69.21 -973.43"; // Use the fixed position format
    const createCommand = `zones.addcustomzone "${newZoneName}" "${position}" ${defaults.size}`;
    
    console.log(`Creating zone: ${newZoneName}`);
    console.log(`Position: ${position}`);
    console.log(`Size: ${defaults.size}`);
    
    try {
      await sendRconCommand(server.ip, server.port, server.password, createCommand);
      console.log('✅ Zone created in game');
    } catch (error) {
      console.log(`❌ Zone creation failed: ${error.message}`);
      return;
    }
    
    // Insert zone into database
    console.log(`\n5. Inserting zone into database...`);
    
    const insertQuery = `
      INSERT INTO zorp_zones (
        server_id, name, owner, team, position, size, 
        color_online, color_offline, radiation, delay, expire, 
        min_team, max_team, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    
    try {
      await pool.query(insertQuery, [
        server.id,
        newZoneName,
        playerName,
        null, // team
        position,
        defaults.size,
        defaults.color_online,
        defaults.color_offline,
        defaults.radiation,
        defaults.delay,
        defaults.expire,
        defaults.min_team,
        defaults.max_team
      ]);
      console.log('✅ Zone inserted into database');
    } catch (error) {
      console.log(`❌ Database insertion failed: ${error.message}`);
      return;
    }
    
    // Set zone to green (online)
    console.log(`\n6. Setting zone color to green...`);
    try {
      await sendRconCommand(server.ip, server.port, server.password, `zones.editcustomzone "${newZoneName}" allowbuilding 1`);
      await sendRconCommand(server.ip, server.port, server.password, `zones.editcustomzone "${newZoneName}" allowbuildingdamage 1`);
      await sendRconCommand(server.ip, server.port, server.password, `zones.editcustomzone "${newZoneName}" allowpvpdamage 1`);
      await sendRconCommand(server.ip, server.port, server.password, `zones.editcustomzone "${newZoneName}" color (${defaults.color_online})`);
      console.log('✅ Zone color set to green (online)');
    } catch (error) {
      console.log(`❌ Color setting failed: ${error.message}`);
    }
    
    console.log('\n🎉 Zone creation completed!');
    console.log(`\n📝 New zone: ${newZoneName}`);
    console.log(`📝 Position: ${position}`);
    console.log(`📝 Server: ${server.nickname}`);
    console.log('\n📝 Next steps:');
    console.log('1. Restart the bot: pm2 restart zentro-bot');
    console.log('2. Test going offline to see if zone turns red');
    
  } catch (error) {
    console.error('❌ Error creating zone:', error);
  } finally {
    await pool.end();
  }
}

checkAndRecreateZone(); 