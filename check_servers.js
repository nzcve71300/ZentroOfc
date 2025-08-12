const pool = require('./src/db');

async function checkServers() {
  try {
    console.log('🔍 Checking all servers in database...');
    
    // Get all servers with their guild info
    const [servers] = await pool.query(`
      SELECT rs.*, g.discord_id as guild_discord_id, g.name as guild_name
      FROM rust_servers rs
      LEFT JOIN guilds g ON rs.guild_id = g.id
      ORDER BY rs.guild_id, rs.nickname
    `);
    
    if (servers.length === 0) {
      console.log('❌ No servers found in database');
      return;
    }
    
    console.log(`📋 Found ${servers.length} server(s):`);
    console.log('');
    
    servers.forEach((server, index) => {
      console.log(`${index + 1}. Server: ${server.nickname}`);
      console.log(`   ID: ${server.id}`);
      console.log(`   IP: ${server.ip}:${server.port}`);
      console.log(`   Guild ID: ${server.guild_id}`);
      console.log(`   Guild Discord ID: ${server.guild_discord_id}`);
      console.log(`   Guild Name: ${server.guild_name || 'Unknown'}`);
      console.log(`   Currency: ${server.currency_name || 'coins'}`);
      console.log('');
    });
    
    // Check if there are multiple servers in the same guild
    const guildCounts = {};
    servers.forEach(server => {
      const guildId = server.guild_discord_id;
      if (!guildCounts[guildId]) {
        guildCounts[guildId] = [];
      }
      guildCounts[guildId].push(server);
    });
    
    console.log('📊 Servers per Discord guild:');
    Object.entries(guildCounts).forEach(([guildId, guildServers]) => {
      console.log(`   Guild ${guildId}: ${guildServers.length} server(s)`);
      guildServers.forEach(server => {
        console.log(`     - ${server.nickname} (${server.ip}:${server.port})`);
      });
    });
    
  } catch (error) {
    console.error('❌ Error checking servers:', error);
  } finally {
    await pool.end();
  }
}

checkServers(); 