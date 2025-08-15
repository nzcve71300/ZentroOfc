const pool = require('./src/db');

async function fixUpriseServerFinal() {
  try {
    console.log('🔧 Final fix for UPRISE 3X server...');

    // Use the actual guild_id from the database
    const actualGuildId = '1302510805853536300';
    const serverName = 'UPRISE 3X';

    console.log(`Using guild_id: ${actualGuildId}`);

    // 1. Update the correct server with proper RCON settings
    console.log('\n1. Updating server with correct RCON settings...');
    const [updateResult] = await pool.query(`
      UPDATE rust_servers 
      SET rcon_port = ?, rcon_password = ?
      WHERE guild_id = ? AND nickname = ?
    `, [30216, 'JPMGiS0u', actualGuildId, serverName]);

    if (updateResult.affectedRows > 0) {
      console.log('✅ Server updated with correct RCON settings');
    } else {
      console.log('⚠️  No server found to update');
    }

    // 2. Remove the duplicate server created by script
    console.log('\n2. Removing duplicate server...');
    const [deleteResult] = await pool.query(`
      DELETE FROM rust_servers 
      WHERE guild_id = 476 AND nickname = ?
    `, [serverName]);

    if (deleteResult.affectedRows > 0) {
      console.log('✅ Duplicate server removed');
    }

    // 3. Remove ZORP defaults for the duplicate
    console.log('\n3. Cleaning up duplicate ZORP defaults...');
    await pool.query('DELETE FROM zorp_defaults WHERE server_id = ?', ['1755275429265_4oo2qvt1o']);
    console.log('✅ Duplicate ZORP defaults removed');

    // 4. Get the correct server ID
    const [serverResult] = await pool.query(`
      SELECT * FROM rust_servers 
      WHERE guild_id = ? AND nickname = ?
    `, [actualGuildId, serverName]);

    if (serverResult.length === 0) {
      console.log('❌ No server found after cleanup!');
      return;
    }

    const correctServerId = serverResult[0].id;
    console.log(`\n4. Correct server ID: ${correctServerId}`);

    // 5. Ensure ZORP defaults exist for correct server
    console.log('\n5. Checking ZORP defaults...');
    const [zorpDefaults] = await pool.query(
      'SELECT * FROM zorp_defaults WHERE server_id = ?',
      [correctServerId]
    );

    if (zorpDefaults.length === 0) {
      console.log('Creating ZORP defaults...');
      await pool.query(`
        INSERT INTO zorp_defaults (
          server_id, size, color_online, color_offline, color_yellow,
          radiation, delay, expire, min_team, max_team, enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        correctServerId, 75, '0,255,0', '255,0,0', '255,255,0',
        0, 5, 126000, 1, 8, 1
      ]);
      console.log('✅ ZORP defaults created');
    } else {
      console.log('✅ ZORP defaults already exist');
    }

    // 6. Clean up incorrect guild entry
    console.log('\n6. Cleaning up incorrect guild entry...');
    await pool.query('DELETE FROM guilds WHERE id = 476');
    console.log('✅ Incorrect guild entry removed');

    // 7. Final verification
    console.log('\n7. Final verification...');
    const [finalCheck] = await pool.query(`
      SELECT * FROM rust_servers WHERE nickname = ?
    `, [serverName]);

    console.log('📋 Final server status:');
    finalCheck.forEach((server, index) => {
      console.log(`   Server ${index + 1}:`);
      console.log(`   - ID: ${server.id}`);
      console.log(`   - Guild ID: ${server.guild_id}`);
      console.log(`   - IP: ${server.ip}:${server.port}`);
      console.log(`   - RCON: ${server.ip}:${server.rcon_port}`);
      console.log(`   - RCON Password: ${server.rcon_password}`);
    });

    if (finalCheck.length === 1) {
      console.log('\n✅ Success! Only one UPRISE 3X server remains');
    } else {
      console.log(`\n⚠️  Found ${finalCheck.length} servers - should be 1`);
    }

    console.log('\n🎉 UPRISE 3X server fix completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Bot was already restarted');
    console.log('2. Test /edit-zorp command - UPRISE 3X should appear');
    console.log('3. RCON should work with port 30216 and password JPMGiS0u');

  } catch (error) {
    console.error('❌ Error fixing server:', error);
  } finally {
    process.exit(0);
  }
}

// Run the function
fixUpriseServerFinal();
