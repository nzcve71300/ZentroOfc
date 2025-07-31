const pool = require('./src/db');

async function testZorpSystem() {
  try {
    console.log('🔍 Testing Zorp System...\n');

    // 1. Check if zorp_defaults table exists
    console.log('1. Checking zorp_defaults table...');
    const [tables] = await pool.query("SHOW TABLES LIKE 'zorp_defaults'");
    if (tables.length === 0) {
      console.log('❌ zorp_defaults table does not exist');
      console.log('💡 Run: node create_zorp_tables.js');
      return;
    }
    console.log('✅ zorp_defaults table exists');

    // 2. Check if zorp_zones table exists
    console.log('\n2. Checking zorp_zones table...');
    const [zonesTables] = await pool.query("SHOW TABLES LIKE 'zorp_zones'");
    if (zonesTables.length === 0) {
      console.log('❌ zorp_zones table does not exist');
      console.log('💡 Run: node create_zorp_tables.js');
      return;
    }
    console.log('✅ zorp_zones table exists');

    // 3. Check zorp_defaults structure
    console.log('\n3. Checking zorp_defaults structure...');
    const [defaultsColumns] = await pool.query("SHOW COLUMNS FROM zorp_defaults");
    console.log('Columns in zorp_defaults:');
    defaultsColumns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type}`);
    });

    // 4. Check zorp_zones structure
    console.log('\n4. Checking zorp_zones structure...');
    const [zonesColumns] = await pool.query("SHOW COLUMNS FROM zorp_zones");
    console.log('Columns in zorp_zones:');
    zonesColumns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type}`);
    });

    // 5. Check for enabled column in zorp_defaults
    console.log('\n5. Checking for enabled column...');
    const [enabledColumn] = await pool.query("SHOW COLUMNS FROM zorp_defaults LIKE 'enabled'");
    if (enabledColumn.length === 0) {
      console.log('❌ enabled column missing from zorp_defaults');
      console.log('💡 Run: node add_zorp_enabled_migration.js');
    } else {
      console.log('✅ enabled column exists in zorp_defaults');
    }

    // 6. Check current servers and their Zorp defaults
    console.log('\n6. Checking servers and their Zorp defaults...');
    const [servers] = await pool.query(`
      SELECT rs.id, rs.nickname, zd.enabled, zd.size, zd.color_online, zd.color_offline
      FROM rust_servers rs
      LEFT JOIN zorp_defaults zd ON rs.id = zd.server_id
      ORDER BY rs.nickname
    `);

    if (servers.length === 0) {
      console.log('❌ No servers found in database');
      return;
    }

    console.log('Servers and their Zorp settings:');
    servers.forEach(server => {
      const status = server.enabled === null ? 'Not configured' : 
                    server.enabled ? '🟢 Enabled' : '🔴 Disabled';
      console.log(`  - ${server.nickname}: ${status}`);
      if (server.enabled !== null) {
        console.log(`    Size: ${server.size || 'default'}, Online: ${server.color_online || 'default'}, Offline: ${server.color_offline || 'default'}`);
      }
    });

    // 7. Check active zones
    console.log('\n7. Checking active Zorp zones...');
    const [zones] = await pool.query(`
      SELECT z.name, z.owner, rs.nickname, z.created_at, z.expire
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      ORDER BY z.created_at DESC
    `);

    if (zones.length === 0) {
      console.log('ℹ️ No active Zorp zones found');
    } else {
      console.log(`Found ${zones.length} active zones:`);
      zones.forEach(zone => {
        const created = new Date(zone.created_at).toLocaleString();
        console.log(`  - ${zone.name} (${zone.owner}) on ${zone.nickname} - Created: ${created}`);
      });
    }

    // 8. Check for any issues
    console.log('\n8. Checking for potential issues...');
    
    // Check servers without Zorp defaults
    const [serversWithoutDefaults] = await pool.query(`
      SELECT rs.nickname
      FROM rust_servers rs
      LEFT JOIN zorp_defaults zd ON rs.id = zd.server_id
      WHERE zd.server_id IS NULL
    `);

    if (serversWithoutDefaults.length > 0) {
      console.log('⚠️ Servers without Zorp defaults:');
      serversWithoutDefaults.forEach(server => {
        console.log(`  - ${server.nickname}`);
      });
      console.log('💡 Use /edit-zorp to configure defaults for these servers');
    } else {
      console.log('✅ All servers have Zorp defaults configured');
    }

    console.log('\n🎉 Zorp system test completed!');

  } catch (error) {
    console.error('❌ Error testing Zorp system:', error);
  }
}

testZorpSystem(); 