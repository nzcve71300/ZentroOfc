const pool = require('./src/db');

async function fixGuildIdFinal() {
  console.log('🔧 Final Guild ID Fix');
  console.log('=====================\n');

  try {
    // Step 1: Check current state
    console.log('📋 Current Database State:');
    const [servers] = await pool.execute('SELECT * FROM rust_servers');
    const [guilds] = await pool.execute('SELECT * FROM guilds');
    
    console.log(`- Servers: ${servers.length}`);
    console.log(`- Guilds: ${guilds.length}`);
    
    for (const server of servers) {
      console.log(`Server: "${server.nickname}" (guild_id: ${server.guild_id})`);
    }
    
    for (const guild of guilds) {
      console.log(`Guild: "${guild.name}" (ID: ${guild.id}, Discord: ${guild.discord_id})`);
    }

    // Step 2: Update the guild with the correct Discord ID
    console.log('\n🔄 Updating guild with correct Discord ID...');
    const correctGuildId = '1391149977434329230';
    
    // Update the guild that the server is linked to (ID: 176)
    await pool.execute(
      'UPDATE guilds SET discord_id = ? WHERE id = ?',
      [correctGuildId, 176]
    );
    console.log(`✅ Guild ID 176 updated with Discord ID: ${correctGuildId}`);

    // Step 3: Verify the fix
    console.log('\n✅ Verification:');
    const [verifyServer] = await pool.execute(
      'SELECT rs.nickname, rs.guild_id, g.discord_id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE rs.nickname = ?',
      ['RISE 3X']
    );
    
    if (verifyServer.length > 0) {
      console.log('✅ Server and guild are properly linked!');
      console.log(`  Server: "${verifyServer[0].nickname}"`);
      console.log(`  Guild ID: ${verifyServer[0].guild_id}`);
      console.log(`  Discord ID: ${verifyServer[0].discord_id}`);
    }

    // Step 4: Test the autokit query
    console.log('\n🧪 Testing autokit query...');
    const [autokitTest] = await pool.execute(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [correctGuildId, 'RISE 3X']
    );
    
    if (autokitTest.length > 0) {
      console.log('✅ Autokit query works!');
      console.log(`  Server ID: ${autokitTest[0].id}`);
    } else {
      console.log('❌ Autokit query still fails');
    }

    // Step 5: Instructions for restart
    console.log('\n🚀 Now restart the bot:');
    console.log('pm2 stop zentro-bot');
    console.log('pm2 start zentro-bot');
    console.log('pm2 logs zentro-bot');
    console.log('');
    console.log('✅ After restart, you should see:');
    console.log('- "🔥 Connected to RCON: RISE 3X (1391149977434329230)"');
    console.log('');
    console.log('🎯 Then test the autokit emotes again!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixGuildIdFinal(); 