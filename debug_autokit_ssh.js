const pool = require('./src/db');

async function debugAutokitSSH() {
  console.log('🔍 Autokit Debug - SSH Version');
  console.log('================================\n');

  try {
    // Check servers and guilds
    const [servers] = await pool.execute('SELECT * FROM rust_servers');
    const [guilds] = await pool.execute('SELECT * FROM guilds');
    
    console.log(`📊 Database Status:`);
    console.log(`- Servers: ${servers.length}`);
    console.log(`- Guilds: ${guilds.length}\n`);
    
    if (servers.length === 0) {
      console.log('❌ No servers found in database!');
      return;
    }
    
    // Test the problematic query
    const testServer = servers[0];
    console.log(`🧪 Testing with server: "${testServer.nickname}"`);
    
    // Get guild discord_id
    const [guildResult] = await pool.execute(
      'SELECT discord_id FROM guilds WHERE id = ?',
      [testServer.guild_id]
    );
    
    if (guildResult.length === 0) {
      console.log(`❌ Guild not found for guild_id: ${testServer.guild_id}`);
      return;
    }
    
    const guildDiscordId = guildResult[0].discord_id;
    console.log(`📋 Guild Discord ID: ${guildDiscordId}`);
    
    // Test the exact query from handleKitClaim
    const [serverResult] = await pool.execute(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildDiscordId, testServer.nickname]
    );
    
    if (serverResult.length > 0) {
      console.log(`✅ Server found! ID: ${serverResult[0].id}`);
      
      // Check autokits
      const [autokits] = await pool.execute(
        'SELECT * FROM autokits WHERE server_id = ?',
        [serverResult[0].id]
      );
      
      console.log(`📦 Autokits found: ${autokits.length}`);
      autokits.forEach(kit => {
        console.log(`  - ${kit.kit_name}: ${kit.enabled ? '🟢' : '🔴'} (${kit.game_name})`);
      });
      
    } else {
      console.log(`❌ Server NOT found! This is the issue.`);
      console.log(`🔍 Debugging query failure...`);
      
      // Check individual parts
      const [guildCheck] = await pool.execute('SELECT id FROM guilds WHERE discord_id = ?', [guildDiscordId]);
      const [serverCheck] = await pool.execute('SELECT id FROM rust_servers WHERE guild_id = ? AND nickname = ?', [testServer.guild_id, testServer.nickname]);
      
      console.log(`- Guild exists: ${guildCheck.length > 0}`);
      console.log(`- Server exists: ${serverCheck.length > 0}`);
      
      if (serverCheck.length > 0) {
        console.log(`⚠️ Server exists but query failed - possible guild_id mismatch`);
        console.log(`  Expected guild_id: ${testServer.guild_id}`);
        console.log(`  Actual guild_id: ${serverCheck[0].guild_id}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugAutokitSSH(); 