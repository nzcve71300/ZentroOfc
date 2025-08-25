const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixTeleportKits() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('🔍 Checking teleport configurations for ALL servers...\n');

    // Get all servers
    const [servers] = await connection.execute(`
      SELECT id, nickname FROM rust_servers
    `);

    for (const server of servers) {
      console.log(`🏠 Server: ${server.nickname} (ID: ${server.id})`);
      
      // Check current values for this server
      const [rows] = await connection.execute(`
        SELECT teleport_name, use_kit, kit_name, enabled 
        FROM teleport_configs 
        WHERE server_id = ?
        ORDER BY teleport_name
      `, [server.id]);

      if (rows.length === 0) {
        console.log('  ❌ No teleport configs found\n');
        continue;
      }

      console.log('  📋 Current teleport configurations:');
      rows.forEach(row => {
        console.log(`    ${row.teleport_name.toUpperCase()}:`);
        console.log(`      - use_kit: ${row.use_kit} (type: ${typeof row.use_kit})`);
        console.log(`      - kit_name: ${row.kit_name}`);
        console.log(`      - enabled: ${row.enabled}`);
      });

      // Find teleports that have kit names but use_kit = 0
      const teleportsToFix = rows.filter(row => 
        row.kit_name && row.kit_name.trim() !== '' && row.use_kit === 0
      );

      if (teleportsToFix.length > 0) {
        console.log(`  🔧 Updating ${teleportsToFix.length} teleport(s) to enable kits...`);
        
        const teleportNames = teleportsToFix.map(row => row.teleport_name);
        await connection.execute(`
          UPDATE teleport_configs 
          SET use_kit = 1 
          WHERE server_id = ? AND teleport_name IN (?)
        `, [server.id, teleportNames]);

        console.log(`  ✅ Updated: ${teleportNames.join(', ')}`);
      } else {
        console.log('  ✅ All teleports with kit names already have use_kit enabled');
      }

      console.log('');
    }

    console.log('🎯 Summary: All servers processed!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

fixTeleportKits();
