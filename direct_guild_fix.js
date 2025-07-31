const pool = require('./src/db');

async function directGuildFix() {
  console.log('🔧 Direct Guild ID Fix');
  console.log('======================\n');

  try {
    // Step 1: Check current state
    console.log('📋 Current Guild Data:');
    const [guilds] = await pool.execute('SELECT * FROM guilds');
    
    for (const guild of guilds) {
      console.log(`Guild: "${guild.name}" (ID: ${guild.id}, Discord: ${guild.discord_id})`);
    }

    // Step 2: Direct update with explicit values
    console.log('\n🔄 Direct Update:');
    const correctGuildId = '1391149977434329230';
    const targetGuildId = 176; // The guild that the server is linked to
    
    console.log(`Updating Guild ID ${targetGuildId} with Discord ID: ${correctGuildId}`);
    
    const [updateResult] = await pool.execute(
      'UPDATE guilds SET discord_id = ? WHERE id = ?',
      [correctGuildId, targetGuildId]
    );
    
    console.log(`Rows affected: ${updateResult.affectedRows}`);

    // Step 3: Verify the update
    console.log('\n✅ Verification:');
    const [verifyGuild] = await pool.execute(
      'SELECT id, name, discord_id FROM guilds WHERE id = ?',
      [targetGuildId]
    );
    
    if (verifyGuild.length > 0) {
      console.log(`Guild: "${verifyGuild[0].name}" (ID: ${verifyGuild[0].id})`);
      console.log(`Discord ID: ${verifyGuild[0].discord_id}`);
      console.log(`Expected: ${correctGuildId}`);
      console.log(`Match: ${verifyGuild[0].discord_id === correctGuildId ? '✅' : '❌'}`);
    }

    // Step 4: Test server-guild relationship
    console.log('\n🔍 Server-Guild Relationship:');
    const [serverGuild] = await pool.execute(
      'SELECT rs.nickname, rs.guild_id, g.discord_id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE rs.nickname = ?',
      ['RISE 3X']
    );
    
    if (serverGuild.length > 0) {
      console.log(`Server: "${serverGuild[0].nickname}"`);
      console.log(`Guild ID: ${serverGuild[0].guild_id}`);
      console.log(`Discord ID: ${serverGuild[0].discord_id}`);
    }

    // Step 5: Test autokit query
    console.log('\n🧪 Testing autokit query:');
    const [autokitTest] = await pool.execute(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [correctGuildId, 'RISE 3X']
    );
    
    if (autokitTest.length > 0) {
      console.log('✅ Autokit query works!');
      console.log(`  Server ID: ${autokitTest[0].id}`);
    } else {
      console.log('❌ Autokit query fails');
    }

    console.log('\n🚀 Now restart the bot:');
    console.log('pm2 stop zentro-bot');
    console.log('pm2 start zentro-bot');
    console.log('pm2 logs zentro-bot');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

directGuildFix(); 