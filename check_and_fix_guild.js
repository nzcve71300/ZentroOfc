const pool = require('./src/db');

async function checkAndFixGuild() {
  console.log('🔍 Check and Fix Guild ID');
  console.log('==========================\n');

  try {
    // Check current guild data
    console.log('📋 Current Guild Data:');
    const [guilds] = await pool.execute('SELECT * FROM guilds');
    
    for (const guild of guilds) {
      console.log(`Guild: "${guild.name}" (ID: ${guild.id}, Discord: ${guild.discord_id})`);
    }

    // Check which guild the server is linked to
    console.log('\n🔍 Server-Guild Relationship:');
    const [serverGuild] = await pool.execute(
      'SELECT rs.nickname, rs.guild_id, g.discord_id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE rs.nickname = ?',
      ['RISE 3X']
    );
    
    if (serverGuild.length > 0) {
      console.log(`Server: "${serverGuild[0].nickname}"`);
      console.log(`Linked to Guild ID: ${serverGuild[0].guild_id}`);
      console.log(`Guild Discord ID: ${serverGuild[0].discord_id}`);
    }

    // Check if the Discord ID is correct
    const correctGuildId = '1391149977434329230';
    const currentGuildId = serverGuild[0]?.discord_id;
    
    console.log('\n🔍 Guild ID Check:');
    console.log(`Expected: ${correctGuildId}`);
    console.log(`Current:  ${currentGuildId}`);
    console.log(`Match:    ${currentGuildId === correctGuildId ? '✅' : '❌'}`);

    if (currentGuildId !== correctGuildId) {
      console.log('\n🔄 Fixing guild Discord ID...');
      
      // Update the guild that the server is linked to
      const serverGuildId = serverGuild[0].guild_id;
      await pool.execute(
        'UPDATE guilds SET discord_id = ? WHERE id = ?',
        [correctGuildId, serverGuildId]
      );
      console.log(`✅ Updated Guild ID ${serverGuildId} with Discord ID: ${correctGuildId}`);
      
      // Verify the fix
      const [verifyGuild] = await pool.execute(
        'SELECT discord_id FROM guilds WHERE id = ?',
        [serverGuildId]
      );
      
      if (verifyGuild.length > 0) {
        console.log(`✅ Verification: Guild Discord ID is now ${verifyGuild[0].discord_id}`);
      }
    } else {
      console.log('\n✅ Guild ID is already correct!');
    }

    // Test the autokit query
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

checkAndFixGuild(); 