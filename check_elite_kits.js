const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkEliteKits() {
  console.log('🔍 Checking Available Elite Kits');
  console.log('================================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 Step 1: Checking all elite kit configurations...');
    const [eliteKits] = await connection.execute(`
      SELECT 
        rs.nickname as server_name,
        ak.kit_name,
        ak.enabled,
        ak.cooldown,
        ak.game_name
      FROM autokits ak
      JOIN rust_servers rs ON ak.server_id = rs.id
      WHERE ak.kit_name LIKE 'ELITEkit%'
      ORDER BY rs.nickname, ak.kit_name
    `);

    console.log(`\n🎯 Found ${eliteKits.length} elite kit configurations:`);
    
    if (eliteKits.length === 0) {
      console.log('❌ No elite kits found in the database');
      return;
    }

    // Group by server
    const servers = {};
    eliteKits.forEach(kit => {
      if (!servers[kit.server_name]) {
        servers[kit.server_name] = [];
      }
      servers[kit.server_name].push(kit);
    });

    Object.keys(servers).forEach(serverName => {
      console.log(`\n🏠 Server: ${serverName}`);
      console.log('─'.repeat(50));
      
      servers[serverName].forEach(kit => {
        const status = kit.enabled ? '✅ Enabled' : '❌ Disabled';
        const cooldown = kit.cooldown ? `${kit.cooldown} minutes` : 'No cooldown';
        console.log(`  ${kit.kit_name}: ${status} | Cooldown: ${cooldown} | Game Name: ${kit.game_name || 'N/A'}`);
      });
    });

    console.log('\n📋 Step 2: Checking kit authorization entries...');
    const [authEntries] = await connection.execute(`
      SELECT 
        rs.nickname as server_name,
        ka.kitlist,
        COUNT(*) as authorized_players
      FROM kit_auth ka
      JOIN rust_servers rs ON ka.server_id = rs.id
      WHERE ka.kitlist LIKE 'Elite%'
      GROUP BY rs.nickname, ka.kitlist
      ORDER BY rs.nickname, ka.kitlist
    `);

    console.log(`\n👥 Found ${authEntries.length} elite kit authorization groups:`);
    
    if (authEntries.length === 0) {
      console.log('❌ No elite kit authorizations found');
    } else {
      authEntries.forEach(auth => {
        console.log(`  ${auth.server_name} - ${auth.kitlist}: ${auth.authorized_players} players`);
      });
    }

    console.log('\n📋 Step 3: Summary of Elite Kits Available:');
    console.log('─'.repeat(50));
    
    // Count unique elite kits across all servers
    const uniqueEliteKits = [...new Set(eliteKits.map(kit => kit.kit_name))];
    console.log(`Total unique elite kits: ${uniqueEliteKits.length}`);
    console.log('Elite kits available:');
    uniqueEliteKits.sort().forEach(kit => {
      console.log(`  - ${kit}`);
    });

    console.log(`\nTotal servers with elite kits: ${Object.keys(servers).length}`);
    console.log(`Total elite kit configurations: ${eliteKits.length}`);
    console.log(`Total elite kit authorizations: ${authEntries.length}`);

    await connection.end();
    console.log('\n✅ Database connection closed');

  } catch (error) {
    console.error('❌ Error checking elite kits:', error);
  }
}

checkEliteKits();
