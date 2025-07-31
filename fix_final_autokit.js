const pool = require('./src/db');

async function fixFinalAutokit() {
  console.log('🔧 Final Autokit Fix');
  console.log('=====================\n');

  try {
    // Step 1: Check current state
    console.log('📋 Current Database State:');
    const [servers] = await pool.execute('SELECT * FROM rust_servers');
    const [guilds] = await pool.execute('SELECT * FROM guilds');
    
    console.log(`- Servers: ${servers.length}`);
    console.log(`- Guilds: ${guilds.length}`);
    
    for (const guild of guilds) {
      console.log(`Guild: "${guild.name}" (ID: ${guild.id}, Discord: ${guild.discord_id})`);
    }

    // Step 2: Update guild with correct Discord ID
    console.log('\n🔄 Updating guild with correct Discord ID...');
    const correctGuildId = '1391149977434329230';
    
    await pool.execute(
      'UPDATE guilds SET discord_id = ? WHERE id = ?',
      [correctGuildId, guilds[0].id]
    );
    console.log(`✅ Guild updated with Discord ID: ${correctGuildId}`);

    // Step 3: Recreate the server
    console.log('\n➕ Recreating server...');
    const serverData = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
      guild_id: guilds[0].id,
      nickname: 'RISE 3X',
      ip: '149.102.132.219',
      port: 30216,
      password: 'JPMGiS0u'
    };
    
    await pool.execute(
      'INSERT INTO rust_servers (id, guild_id, nickname, ip, port, password) VALUES (?, ?, ?, ?, ?, ?)',
      [serverData.id, serverData.guild_id, serverData.nickname, serverData.ip, serverData.port, serverData.password]
    );
    console.log(`✅ Server recreated: "${serverData.nickname}"`);

    // Step 4: Create autokit configurations
    console.log('\n📦 Creating autokit configurations...');
    const autokits = [
      { kit_name: 'FREEkit1', enabled: true, cooldown: 0, game_name: 'FREEkit1' },
      { kit_name: 'FREEkit2', enabled: true, cooldown: 0, game_name: 'FREEkit2' },
      { kit_name: 'VIPkit', enabled: true, cooldown: 0, game_name: 'VIPkit' },
      { kit_name: 'ELITEkit1', enabled: true, cooldown: 0, game_name: 'ELITEkit1' },
      { kit_name: 'ELITEkit2', enabled: true, cooldown: 0, game_name: 'ELITEkit2' },
      { kit_name: 'ELITEkit3', enabled: true, cooldown: 0, game_name: 'ELITEkit3' },
      { kit_name: 'ELITEkit4', enabled: true, cooldown: 0, game_name: 'ELITEkit4' },
      { kit_name: 'ELITEkit5', enabled: true, cooldown: 0, game_name: 'ELITEkit5' }
    ];
    
    for (const autokit of autokits) {
      await pool.execute(
        'INSERT INTO autokits (server_id, kit_name, enabled, cooldown, game_name) VALUES (?, ?, ?, ?, ?)',
        [serverData.id, autokit.kit_name, autokit.enabled, autokit.cooldown, autokit.game_name]
      );
    }
    console.log(`✅ Created ${autokits.length} autokit configurations`);

    // Step 5: Verify everything works
    console.log('\n✅ Final Verification:');
    const [verifyServer] = await pool.execute(
      'SELECT rs.id, rs.nickname, rs.guild_id, g.discord_id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE rs.nickname = ?',
      ['RISE 3X']
    );
    
    if (verifyServer.length > 0) {
      console.log('✅ Server and guild are properly linked!');
      console.log(`  Server: "${verifyServer[0].nickname}"`);
      console.log(`  Guild Discord ID: ${verifyServer[0].discord_id}`);
    }

    // Step 6: Test the autokit query
    console.log('\n🧪 Testing autokit query...');
    const [autokitTest] = await pool.execute(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [correctGuildId, 'RISE 3X']
    );
    
    if (autokitTest.length > 0) {
      console.log('✅ Autokit query works!');
      console.log(`  Server ID: ${autokitTest[0].id}`);
      
      // Check autokits
      const [autokitConfigs] = await pool.execute(
        'SELECT kit_name, enabled, game_name FROM autokits WHERE server_id = ?',
        [autokitTest[0].id]
      );
      console.log(`📦 Autokits configured: ${autokitConfigs.length}`);
    } else {
      console.log('❌ Autokit query still fails');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixFinalAutokit(); 