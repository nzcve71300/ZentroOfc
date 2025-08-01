const pool = require('./src/db');

console.log('🔧 Adding missing Discord guilds to database...');

async function addMissingGuilds() {
  try {
    // Add the missing Discord guilds
    const guildsToAdd = [
      { discord_id: '1391149977434329230', name: 'Rise 3x Server' },
      { discord_id: '1342235198175182921', name: 'EMPEROR 3X Server' }
    ];
    
    console.log('\n📋 Adding guilds to database...');
    
    for (const guild of guildsToAdd) {
      // Check if guild already exists
      const [existing] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [guild.discord_id]);
      
      if (existing.length === 0) {
        // Add the guild
        const [result] = await pool.query(
          'INSERT INTO guilds (discord_id, name) VALUES (?, ?)',
          [guild.discord_id, guild.name]
        );
        console.log(`✅ Added guild: ${guild.name} (Discord ID: ${guild.discord_id})`);
      } else {
        console.log(`⚠️  Guild already exists: ${guild.name} (Discord ID: ${guild.discord_id})`);
      }
    }
    
    // Update the servers to use the correct guild_ids
    console.log('\n🔧 Updating server guild_ids...');
    
    // Get the guild IDs we just added
    const [guilds] = await pool.query('SELECT id, discord_id FROM guilds WHERE discord_id IN (?, ?)', 
      ['1391149977434329230', '1342235198175182921']);
    
    console.log('Found guilds:', guilds);
    
    // Update Rise 3x server
    const riseGuild = guilds.find(g => g.discord_id === '1391149977434329230');
    if (riseGuild) {
      await pool.query('UPDATE rust_servers SET guild_id = ? WHERE nickname = ?', 
        [riseGuild.id, 'Rise 3x']);
      console.log(`✅ Updated Rise 3x server to use guild_id: ${riseGuild.id}`);
    }
    
    // Update EMPEROR 3X server
    const emperorGuild = guilds.find(g => g.discord_id === '1342235198175182921');
    if (emperorGuild) {
      await pool.query('UPDATE rust_servers SET guild_id = ? WHERE nickname = ?', 
        [emperorGuild.id, 'EMPEROR 3X']);
      console.log(`✅ Updated EMPEROR 3X server to use guild_id: ${emperorGuild.id}`);
    }
    
    // Verify the changes
    console.log('\n✅ Verifying changes...');
    const [servers] = await pool.query('SELECT id, nickname, guild_id FROM rust_servers');
    servers.forEach(server => {
      console.log(`Server: ${server.nickname}, Guild ID: ${server.guild_id}`);
    });
    
    // Test server autocomplete for both guilds
    console.log('\n🔧 Testing server autocomplete...');
    for (const guild of guilds) {
      const [serverResults] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ? LIMIT 25',
        [guild.id, '%']
      );
      console.log(`Guild ${guild.discord_id} has ${serverResults.length} servers:`, serverResults.map(r => r.nickname));
    }
    
    console.log('\n🎉 All guilds and servers are now properly configured!');
    console.log('✅ Server autocomplete should now work for both Discord servers!');
    
  } catch (error) {
    console.error('❌ Error adding guilds:', error);
  } finally {
    process.exit(0);
  }
}

addMissingGuilds(); 