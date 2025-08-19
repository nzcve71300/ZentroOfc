const pool = require('./src/db');

async function fixServerGuildAssignment() {
  try {
    console.log('🔧 Fixing server guild assignment...');
    
    const yourGuildId = '1391149977434329230';
    const shadowsServerId = '1755639661476_0fkb3dtwc';
    const otherGuildId = '1376030083038318743';
    
    // Check current state
    console.log('\n🔍 Current state:');
    
    const [yourGuild] = await pool.query('SELECT * FROM guilds WHERE discord_id = ?', [yourGuildId]);
    const [otherGuild] = await pool.query('SELECT * FROM guilds WHERE discord_id = ?', [otherGuildId]);
    const [shadowsServer] = await pool.query('SELECT * FROM rust_servers WHERE id = ?', [shadowsServerId]);
    
    console.log(`Your Guild: ${yourGuild[0]?.name} (DB ID: ${yourGuild[0]?.id})`);
    console.log(`Other Guild: ${otherGuild[0]?.name} (DB ID: ${otherGuild[0]?.id})`);
    console.log(`SHADOWS 3X Server: Currently in guild DB ID ${shadowsServer[0]?.guild_id}`);
    
    // Count players in the other guild for SHADOWS 3X
    const [playerCount] = await pool.query(
      'SELECT COUNT(*) as count FROM players WHERE server_id = ? AND is_active = true',
      [shadowsServerId]
    );
    
    console.log(`\n📊 SHADOWS 3X has ${playerCount[0].count} active players`);
    
    // Show the options
    console.log('\n🔧 SOLUTION OPTIONS:');
    console.log('Option 1: Move SHADOWS 3X server to your guild (this will affect all existing players)');
    console.log('Option 2: Create a duplicate SHADOWS 3X server in your guild');
    console.log('Option 3: Add your Discord to the other guild instead');
    
    console.log('\n⚠️ IMPORTANT: This script will show you the options but NOT make changes automatically.');
    console.log('   You need to decide which approach is best for your setup.');
    
    // Show what each option would do
    console.log('\n📋 If you choose Option 1 (Move server):');
    console.log('   - All existing players on SHADOWS 3X will be moved to your guild');
    console.log('   - XsLdSsG will be in your guild and can use your bot commands');
    console.log('   - The other guild will lose access to SHADOWS 3X');
    
    console.log('\n📋 If you choose Option 2 (Duplicate server):');
    console.log('   - Create a new SHADOWS 3X entry in your guild');
    console.log('   - Players can link fresh in your guild');
    console.log('   - Both guilds have their own SHADOWS 3X');
    
    console.log('\n📋 If you choose Option 3 (Join other guild):');
    console.log('   - You join the other guild that has SHADOWS 3X');
    console.log('   - XsLdSsG can immediately use commands');
    console.log('   - No database changes needed');
    
    // Show the commands to execute each option
    console.log('\n🛠️ TO EXECUTE YOUR CHOICE:');
    console.log('\nOption 1 - Move server to your guild:');
    console.log(`UPDATE rust_servers SET guild_id = ${yourGuild[0]?.id} WHERE id = '${shadowsServerId}';`);
    console.log(`UPDATE players SET guild_id = ${yourGuild[0]?.id} WHERE server_id = '${shadowsServerId}';`);
    console.log(`UPDATE economy SET guild_id = ${yourGuild[0]?.id} WHERE player_id IN (SELECT id FROM players WHERE server_id = '${shadowsServerId}');`);
    
    console.log('\nOption 2 - Create duplicate server in your guild:');
    console.log(`INSERT INTO rust_servers (id, guild_id, nickname, ip, port, rcon_password) 
SELECT CONCAT(id, '_copy'), ${yourGuild[0]?.id}, nickname, ip, port, rcon_password 
FROM rust_servers WHERE id = '${shadowsServerId}';`);
    
    console.log('\nOption 3 - No database changes needed, just join the other Discord guild');
    
    console.log('\n💡 RECOMMENDATION: Option 1 is probably what you want if SHADOWS 3X is your server.');
    
  } catch (error) {
    console.error('❌ Error analyzing server guild assignment:', error);
  } finally {
    await pool.end();
  }
}

fixServerGuildAssignment();
