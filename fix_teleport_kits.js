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
    console.log('🔍 Checking teleport configurations...\n');

    // Check current values
    const [rows] = await connection.execute(`
      SELECT server_id, teleport_name, use_kit, kit_name, enabled 
      FROM teleport_configs 
      WHERE teleport_name IN ('tpw', 'tps', 'default') 
      AND server_id = '1754071898933_jg45hm1wj'
    `);

    console.log('📋 Current teleport configurations:');
    rows.forEach(row => {
      console.log(`${row.teleport_name.toUpperCase()}:`);
      console.log(`  - use_kit: ${row.use_kit} (type: ${typeof row.use_kit})`);
      console.log(`  - kit_name: ${row.kit_name}`);
      console.log(`  - enabled: ${row.enabled}`);
      console.log('');
    });

    // Update TPW and TPS to have use_kit = 1
    console.log('🔧 Updating TPW and TPS use_kit to 1...');
    
    await connection.execute(`
      UPDATE teleport_configs 
      SET use_kit = 1 
      WHERE teleport_name IN ('tpw', 'tps') 
      AND server_id = '1754071898933_jg45hm1wj'
    `);

    console.log('✅ Updated TPW and TPS use_kit settings');

    // Check updated values
    const [updatedRows] = await connection.execute(`
      SELECT server_id, teleport_name, use_kit, kit_name, enabled 
      FROM teleport_configs 
      WHERE teleport_name IN ('tpw', 'tps', 'default') 
      AND server_id = '1754071898933_jg45hm1wj'
    `);

    console.log('\n📋 Updated teleport configurations:');
    updatedRows.forEach(row => {
      console.log(`${row.teleport_name.toUpperCase()}:`);
      console.log(`  - use_kit: ${row.use_kit} (type: ${typeof row.use_kit})`);
      console.log(`  - kit_name: ${row.kit_name}`);
      console.log(`  - enabled: ${row.enabled}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

fixTeleportKits();
