const mysql = require('mysql2/promise');

async function fixServerMapping() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'zentro_bot',
    password: 'Zandewet@123',
    database: 'zentro_bot'
  });

  try {
    console.log('🔧 Fixing server mapping...\n');

    // Get all servers from the unified table
    const [servers] = await connection.execute('SELECT * FROM servers');
    console.log('📋 Unified servers:', servers.length);

    // Get all rust_servers
    const [rustServers] = await connection.execute('SELECT * FROM rust_servers');
    console.log('📋 Rust servers:', rustServers.length);

    // Try to map them
    for (const server of servers) {
      console.log(`\n🔍 Mapping server: ${server.name} (guild: ${server.guild_id})`);
      
      // Find matching rust_server
      const matchingRustServer = rustServers.find(rs => 
        rs.guild_id == server.guild_id && rs.nickname === server.name
      );
      
      if (matchingRustServer) {
        console.log(`✅ Found match: rust_servers.id = ${matchingRustServer.id}`);
      } else {
        console.log(`❌ No match found for server: ${server.name}`);
        console.log('Available rust_servers for this guild:');
        const guildRustServers = rustServers.filter(rs => rs.guild_id == server.guild_id);
        guildRustServers.forEach(rs => console.log(`  - ${rs.nickname} (id: ${rs.id})`));
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

fixServerMapping();
