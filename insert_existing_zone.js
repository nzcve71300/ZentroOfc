const pool = require('./src/db');

async function insertExistingZone() {
  try {
    console.log('🔧 Inserting Existing Zone into Database...');
    
    const playerName = 'nzcve7130';
    const zoneName = 'ZORP_1754010669190'; // The zone that was created in-game
    const position = '8.19 69.21 -973.43';
    
    // Get server info
    console.log('\n1. Getting server info...');
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
    console.log(`✅ Found server: ${server.nickname} (ID: ${server.id})`);
    
    // Get zorp defaults
    console.log('\n2. Getting Zorp defaults...');
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
    
    // Try different position formats
    console.log('\n3. Trying different position formats...');
    
    const positionFormats = [
      '8.19 69.21 -973.43',
      '8.19,69.21,-973.43',
      '[8.19,69.21,-973.43]',
      '8.19, 69.21, -973.43',
      JSON.stringify([8.19, 69.21, -973.43])
    ];
    
    for (const posFormat of positionFormats) {
      try {
        console.log(`\nTrying position format: "${posFormat}"`);
        
        const insertQuery = `
          INSERT INTO zorp_zones (
            server_id, name, owner, team, position, size, 
            color_online, color_offline, radiation, delay, expire, 
            min_team, max_team, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;
        
        await pool.query(insertQuery, [
          server.id,
          zoneName,
          playerName,
          null, // team
          posFormat,
          defaults.size,
          defaults.color_online,
          defaults.color_offline,
          defaults.radiation,
          defaults.delay,
          defaults.expire,
          defaults.min_team,
          defaults.max_team
        ]);
        
        console.log(`✅ Successfully inserted zone with position format: "${posFormat}"`);
        
        // Verify the insertion
        const [verifyResult] = await pool.query(
          'SELECT name, position FROM zorp_zones WHERE name = ?',
          [zoneName]
        );
        
        if (verifyResult.length > 0) {
          console.log(`✅ Zone verified in database: ${verifyResult[0].name}`);
          console.log(`✅ Position stored as: "${verifyResult[0].position}"`);
        }
        
        console.log('\n🎉 Zone insertion completed!');
        console.log(`\n📝 Zone: ${zoneName}`);
        console.log(`📝 Position: ${posFormat}`);
        console.log(`📝 Server: ${server.nickname}`);
        console.log('\n📝 Next steps:');
        console.log('1. Restart the bot: pm2 restart zentro-bot');
        console.log('2. Test going offline to see if zone turns red');
        
        return; // Exit after successful insertion
        
      } catch (error) {
        console.log(`❌ Failed with format "${posFormat}": ${error.message}`);
      }
    }
    
    console.log('\n❌ All position formats failed');
    
  } catch (error) {
    console.error('❌ Error inserting zone:', error);
  } finally {
    await pool.end();
  }
}

insertExistingZone(); 