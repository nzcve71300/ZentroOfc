const pool = require('./src/db');

async function fixGuildMismatch() {
  console.log('🔧 Fixing Guild Mismatch Issue');
  console.log('================================\n');

  try {
    // Step 1: Check current state
    console.log('📋 Current Database State:');
    const [servers] = await pool.execute('SELECT * FROM rust_servers');
    const [guilds] = await pool.execute('SELECT * FROM guilds');
    
    console.log(`- Servers: ${servers.length}`);
    console.log(`- Guilds: ${guilds.length}`);
    
    for (const server of servers) {
      console.log(`  Server: "${server.nickname}" (guild_id: ${server.guild_id})`);
    }
    
    for (const guild of guilds) {
      console.log(`  Guild: "${guild.name}" (discord_id: ${guild.discord_id})`);
    }

    // Step 2: Get the correct Discord guild ID from the server
    if (servers.length === 0) {
      console.log('❌ No servers found!');
      return;
    }

    const server = servers[0];
    console.log(`\n🎯 Target Server: "${server.nickname}"`);
    console.log(`🎯 Target Discord Guild ID: 1391149977434329300`);

    // Step 3: Clear guilds table
    console.log('\n🧹 Clearing guilds table...');
    await pool.execute('DELETE FROM guilds');
    console.log('✅ Guilds table cleared');

    // Step 4: Insert the correct guild
    console.log('\n➕ Inserting correct guild...');
    await pool.execute(
      'INSERT INTO guilds (discord_id, name) VALUES (?, ?)',
      ['1391149977434329300', 'Zentro Guild']
    );
    console.log('✅ Guild inserted');

    // Step 5: Update server guild_id
    console.log('\n🔄 Updating server guild_id...');
    const [newGuild] = await pool.execute(
      'SELECT id FROM guilds WHERE discord_id = ?',
      ['1391149977434329300']
    );
    
    if (newGuild.length > 0) {
      await pool.execute(
        'UPDATE rust_servers SET guild_id = ? WHERE id = ?',
        [newGuild[0].id, server.id]
      );
      console.log(`✅ Server guild_id updated to ${newGuild[0].id}`);
    } else {
      console.log('❌ Failed to get new guild ID');
      return;
    }

    // Step 6: Verify the fix
    console.log('\n✅ Verification:');
    const [verifyServer] = await pool.execute(
      'SELECT rs.id, rs.nickname, rs.guild_id, g.discord_id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE rs.id = ?',
      [server.id]
    );
    
    if (verifyServer.length > 0) {
      console.log('✅ Server and guild are now properly linked!');
      console.log(`  Server: "${verifyServer[0].nickname}"`);
      console.log(`  Guild Discord ID: ${verifyServer[0].discord_id}`);
    } else {
      console.log('❌ Verification failed');
    }

    // Step 7: Test the autokit query
    console.log('\n🧪 Testing autokit query...');
    const [testResult] = await pool.execute(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      ['1391149977434329300', server.nickname]
    );
    
    if (testResult.length > 0) {
      console.log('✅ Autokit query now works!');
      console.log(`  Server ID: ${testResult[0].id}`);
    } else {
      console.log('❌ Autokit query still fails');
    }

  } catch (error) {
    console.error('❌ Error during fix:', error.message);
  } finally {
    await pool.end();
  }
}

fixGuildMismatch(); 