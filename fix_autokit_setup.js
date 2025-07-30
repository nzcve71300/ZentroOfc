const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
});

async function fixAutokitSetup() {
  console.log('🔧 Fixing Autokit Setup...\n');
  
  try {
    // Parameters
    const guildId = '1391149977434329230';
    const serverName = 'RISE 3X';
    const kitKey = 'FREEkit1';
    
    console.log('📋 Fixing autokit for:');
    console.log(`   Guild ID: ${guildId}`);
    console.log(`   Server: ${serverName}`);
    console.log(`   Kit: ${kitKey}\n`);
    
    // Step 1: Get or create guild
    console.log('✅ Step 1: Ensuring guild exists');
    let [guilds] = await pool.execute(
      'SELECT * FROM guilds WHERE discord_id = ?',
      [guildId]
    );
    
    let guildId_db;
    if (guilds.length === 0) {
      console.log('   Creating guild...');
      const [insertResult] = await pool.execute(
        'INSERT INTO guilds (discord_id, name) VALUES (?, ?)',
        [guildId, 'RISE Guild']
      );
      guildId_db = insertResult.insertId;
      console.log(`   ✅ Guild created with ID: ${guildId_db}`);
    } else {
      guildId_db = guilds[0].id;
      console.log(`   ✅ Guild exists with ID: ${guildId_db}`);
    }
    
    // Step 2: Get or create server
    console.log('\n✅ Step 2: Ensuring server exists');
    let [servers] = await pool.execute(
      'SELECT * FROM rust_servers WHERE guild_id = ? AND nickname = ?',
      [guildId_db, serverName]
    );
    
    let serverId;
    if (servers.length === 0) {
      console.log('   Creating server...');
      const [insertResult] = await pool.execute(
        'INSERT INTO rust_servers (id, guild_id, nickname, ip, port, password) VALUES (?, ?, ?, ?, ?, ?)',
        [Date.now().toString(), guildId_db, serverName, '127.0.0.1', 28016, 'password']
      );
      serverId = Date.now().toString();
      console.log(`   ✅ Server created with ID: ${serverId}`);
    } else {
      serverId = servers[0].id;
      console.log(`   ✅ Server exists with ID: ${serverId}`);
    }
    
    // Step 3: Create or update autokit
    console.log('\n✅ Step 3: Setting up autokit');
    const [autokits] = await pool.execute(
      'SELECT * FROM autokits WHERE server_id = ? AND kit_name = ?',
      [serverId, kitKey]
    );
    
    if (autokits.length === 0) {
      console.log('   Creating autokit configuration...');
      await pool.execute(
        'INSERT INTO autokits (server_id, kit_name, enabled, cooldown, game_name) VALUES (?, ?, ?, ?, ?)',
        [serverId, kitKey, true, 300, 'FREEkit1']
      );
      console.log('   ✅ Autokit created and enabled');
    } else {
      console.log('   Updating existing autokit...');
      await pool.execute(
        'UPDATE autokits SET enabled = ?, cooldown = ?, game_name = ? WHERE server_id = ? AND kit_name = ?',
        [true, 300, 'FREEkit1', serverId, kitKey]
      );
      console.log('   ✅ Autokit updated and enabled');
    }
    
    // Step 4: Verify the fix
    console.log('\n✅ Step 4: Verifying the fix');
    const [verifyAutokits] = await pool.execute(
      'SELECT * FROM autokits WHERE server_id = ? AND kit_name = ?',
      [serverId, kitKey]
    );
    
    if (verifyAutokits.length > 0 && verifyAutokits[0].enabled) {
      console.log('   🎉 SUCCESS! Autokit is now properly configured and enabled');
      console.log(`   Kit: ${verifyAutokits[0].kit_name}`);
      console.log(`   Status: ${verifyAutokits[0].enabled ? '🟢 Enabled' : '🔴 Disabled'}`);
      console.log(`   Cooldown: ${verifyAutokits[0].cooldown} seconds`);
      console.log(`   Game Name: ${verifyAutokits[0].game_name}`);
    } else {
      console.log('   ❌ Something went wrong with the fix');
    }
    
    // Step 5: Show all autokits for this server
    console.log('\n✅ Step 5: All autokits for this server');
    const [allAutokits] = await pool.execute(
      'SELECT * FROM autokits WHERE server_id = ?',
      [serverId]
    );
    
    if (allAutokits.length > 0) {
      console.log(`   Found ${allAutokits.length} autokit(s):`);
      allAutokits.forEach(ak => {
        console.log(`   - ${ak.kit_name}: ${ak.enabled ? '🟢' : '🔴'} ${ak.enabled ? 'Enabled' : 'Disabled'} (${ak.cooldown}s cooldown)`);
      });
    } else {
      console.log('   No autokits found (this shouldn\'t happen)');
    }
    
    console.log('\n🎉 Autokit setup complete!');
    console.log('Try using the emote again - it should work now.');
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  } finally {
    await pool.end();
  }
}

fixAutokitSetup(); 