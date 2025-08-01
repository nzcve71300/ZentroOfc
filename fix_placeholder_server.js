const pool = require('./src/db');

async function fixPlaceholderServer() {
  try {
    console.log('🔧 Fixing placeholder server issues...');
    
    // Check for placeholder servers
    const [placeholderServers] = await pool.query(
      'SELECT * FROM rust_servers WHERE ip LIKE "%placeholder%" OR ip LIKE "%PLACEHOLDER%" OR nickname LIKE "%Unknown%" OR nickname LIKE "%placeholder%"'
    );
    
    console.log(`📋 Found ${placeholderServers.length} placeholder servers:`);
    placeholderServers.forEach(server => {
      console.log(`   - ID: ${server.id}, Name: ${server.nickname}, IP: ${server.ip}:${server.port}`);
    });
    
    if (placeholderServers.length > 0) {
      console.log('🗑️ Removing placeholder servers...');
      
      for (const server of placeholderServers) {
        // Remove related data first
        await pool.query('DELETE FROM eco_games WHERE server_id = ?', [server.id]);
        await pool.query('DELETE FROM eco_games_config WHERE server_id = ?', [server.id]);
        await pool.query('DELETE FROM players WHERE server_id = ?', [server.id]);
        await pool.query('DELETE FROM economy WHERE player_id IN (SELECT id FROM players WHERE server_id = ?)', [server.id]);
        await pool.query('DELETE FROM transactions WHERE player_id IN (SELECT id FROM players WHERE server_id = ?)', [server.id]);
        
        // Remove the server
        await pool.query('DELETE FROM rust_servers WHERE id = ?', [server.id]);
        console.log(`✅ Removed placeholder server: ${server.nickname}`);
      }
    }
    
    // Check for your actual server
    const guildId = '1391149977434329230';
    const [actualServers] = await pool.query(
      'SELECT rs.* FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ?',
      [guildId]
    );
    
    console.log(`\n📋 Found ${actualServers.length} actual servers for guild ${guildId}:`);
    actualServers.forEach(server => {
      console.log(`   - ID: ${server.id}, Name: ${server.nickname}, IP: ${server.ip}:${server.port}`);
    });
    
    if (actualServers.length === 0) {
      console.log('⚠️ No actual servers found for your guild!');
      console.log('💡 You need to add your server using: /add-server');
    } else {
      // Verify server configurations
      for (const server of actualServers) {
        console.log(`\n🔧 Checking configurations for ${server.nickname}:`);
        
        // Check eco_games config
        const [ecoGames] = await pool.query(
          'SELECT * FROM eco_games WHERE server_id = ?',
          [server.id]
        );
        console.log(`   📊 eco_games entries: ${ecoGames.length}`);
        
        // Check eco_games_config
        const [ecoGamesConfig] = await pool.query(
          'SELECT * FROM eco_games_config WHERE server_id = ?',
          [server.id]
        );
        console.log(`   📊 eco_games_config entries: ${ecoGamesConfig.length}`);
        
        // Check players
        const [players] = await pool.query(
          'SELECT * FROM players WHERE server_id = ?',
          [server.id]
        );
        console.log(`   👥 players entries: ${players.length}`);
      }
    }
    
    // Check guilds table
    const [guilds] = await pool.query(
      'SELECT * FROM guilds WHERE discord_id = ?',
      [guildId]
    );
    
    console.log(`\n📋 Guild record for ${guildId}:`);
    if (guilds.length > 0) {
      console.log(`   ✅ Guild found: ${guilds[0].name || 'Unknown'}`);
    } else {
      console.log(`   ❌ No guild record found for ${guildId}`);
    }
    
    console.log('\n🎉 Placeholder server cleanup complete!');
    console.log('💡 Next steps:');
    console.log('   1. Restart your bot');
    console.log('   2. If no servers show up, add your server with: /add-server');
    console.log('   3. Check that your server IP and port are correct');
    
  } catch (error) {
    console.error('❌ Error fixing placeholder server:', error);
  } finally {
    await pool.end();
  }
}

fixPlaceholderServer(); 