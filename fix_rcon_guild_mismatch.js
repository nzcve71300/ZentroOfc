const pool = require('./src/db');

async function fixRconGuildMismatch() {
  console.log('🔧 Fixing RCON Guild ID Mismatch');
  console.log('==================================\n');

  try {
    // Step 1: Check current database state
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

    // Step 2: Verify the server-guild relationship
    console.log('\n🔍 Verifying server-guild relationship:');
    const [serverGuildCheck] = await pool.execute(
      'SELECT rs.nickname, rs.guild_id, g.discord_id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE rs.nickname = ?',
      ['RISE 3X']
    );
    
    if (serverGuildCheck.length > 0) {
      console.log('✅ Server and guild are properly linked in database:');
      console.log(`  Server: "${serverGuildCheck[0].nickname}"`);
      console.log(`  Guild ID: ${serverGuildCheck[0].guild_id}`);
      console.log(`  Discord ID: ${serverGuildCheck[0].discord_id}`);
    } else {
      console.log('❌ Server-guild relationship not found!');
      return;
    }

    // Step 3: Test the autokit query
    console.log('\n🧪 Testing autokit query:');
    const correctGuildId = '1391149977434329230';
    const [autokitTest] = await pool.execute(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [correctGuildId, 'RISE 3X']
    );
    
    if (autokitTest.length > 0) {
      console.log('✅ Autokit query works in database!');
      console.log(`  Server ID: ${autokitTest[0].id}`);
    } else {
      console.log('❌ Autokit query fails in database!');
      return;
    }

    // Step 4: The issue is that the RCON connection is using the old guild ID
    console.log('\n🔍 The Problem:');
    console.log('The RCON connection is established with the OLD guild ID (1391149977434329300)');
    console.log('But the database query is looking for the NEW guild ID (1391149977434329230)');
    console.log('This creates a mismatch in the server lookup.\n');

    console.log('🚀 Solution:');
    console.log('1. Stop the bot');
    console.log('2. Clear any cached RCON connections');
    console.log('3. Restart the bot');
    console.log('4. The bot will reconnect with the correct guild ID\n');

    console.log('📋 Commands to run:');
    console.log('pm2 stop zentro-bot');
    console.log('pm2 start zentro-bot');
    console.log('pm2 logs zentro-bot');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixRconGuildMismatch(); 