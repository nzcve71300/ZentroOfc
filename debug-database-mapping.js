const mysql = require('mysql2/promise');

async function debugDatabaseMapping() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'zentro_bot',
    password: 'Zandewet@123',
    database: 'zentro_bot'
  });

  try {
    console.log('🔍 Debugging database mapping...\n');

    // Check servers table
    console.log('📋 SERVERS TABLE:');
    const [servers] = await connection.execute('SELECT * FROM servers WHERE id = 1');
    console.table(servers);

    // Check rust_servers table
    console.log('\n📋 RUST_SERVERS TABLE:');
    const [rustServers] = await connection.execute('SELECT * FROM rust_servers LIMIT 5');
    console.table(rustServers);

    // Check the JOIN that's failing
    console.log('\n🔗 JOIN TEST:');
    const [joinTest] = await connection.execute(`
      SELECT s.*, rs.id as rust_server_id
      FROM servers s
      LEFT JOIN rust_servers rs ON s.guild_id = rs.guild_id AND s.name = rs.nickname
      WHERE s.id = 1
    `);
    console.table(joinTest);

    // Check shop_categories
    console.log('\n📋 SHOP_CATEGORIES:');
    const [categories] = await connection.execute('SELECT * FROM shop_categories LIMIT 5');
    console.table(categories);

    // Check what rust_servers entries exist for guild_id 337
    console.log('\n🔍 RUST_SERVERS for guild_id 337:');
    const [guildServers] = await connection.execute('SELECT * FROM rust_servers WHERE guild_id = 337');
    console.table(guildServers);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

debugDatabaseMapping();
