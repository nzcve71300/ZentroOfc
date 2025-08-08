const pool = require('./src/db');

async function checkBothGuilds() {
  try {
    console.log('🔍 Checking both guilds for Shadows 3x...\n');
    
    const guild1 = '1385691441967267953';
    const guild2 = '1391209638308872254';
    
    // Check guild 1
    console.log(`📋 Checking guild 1: ${guild1}`);
    const [guild1Result] = await pool.query(
      'SELECT id, discord_id, name FROM guilds WHERE discord_id = ?',
      [guild1]
    );
    
    if (guild1Result.length > 0) {
      const guild = guild1Result[0];
      console.log(`✅ Guild 1 found: ${guild.name} (DB ID: ${guild.id})`);
      
      const [servers1] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ?',
        [guild.id, '%Shadows%']
      );
      
      console.log(`📊 Guild 1 servers with "Shadows": ${servers1.length}`);
      servers1.forEach(server => console.log(`  - ${server.nickname}`));
    } else {
      console.log('❌ Guild 1 not found');
    }
    
    // Check guild 2
    console.log(`\n📋 Checking guild 2: ${guild2}`);
    const [guild2Result] = await pool.query(
      'SELECT id, discord_id, name FROM guilds WHERE discord_id = ?',
      [guild2]
    );
    
    if (guild2Result.length > 0) {
      const guild = guild2Result[0];
      console.log(`✅ Guild 2 found: ${guild.name} (DB ID: ${guild.id})`);
      
      const [servers2] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ?',
        [guild.id, '%Shadows%']
      );
      
      console.log(`📊 Guild 2 servers with "Shadows": ${servers2.length}`);
      servers2.forEach(server => console.log(`  - ${server.nickname}`));
    } else {
      console.log('❌ Guild 2 not found');
    }
    
    // Check all instances of Shadows 3x
    console.log('\n🔍 Checking all instances of "Shadows 3x"...');
    const [allShadows] = await pool.query(
      'SELECT rs.*, g.discord_id as guild_discord_id, g.name as guild_name FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE rs.nickname = ?',
      ['Shadows 3x']
    );
    
    console.log(`📊 Found ${allShadows.length} instances of "Shadows 3x":`);
    allShadows.forEach((server, index) => {
      console.log(`  ${index + 1}. Guild: ${server.guild_name} (${server.guild_discord_id})`);
      console.log(`     Server ID: ${server.id}`);
      console.log(`     IP: ${server.ip}:${server.port}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking guilds:', error);
  } finally {
    await pool.end();
  }
}

checkBothGuilds(); 