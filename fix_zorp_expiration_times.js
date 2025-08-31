const pool = require('./src/db');

async function fixZorpExpirationTimes() {
  try {
    console.log('🔧 Fixing Zorp zone expiration times...\n');
    
    // Check current zorp_defaults
    console.log('1. Checking current zorp_defaults...');
    const [defaults] = await pool.query('SELECT * FROM zorp_defaults');
    console.log(`Found ${defaults.length} server defaults:`);
    defaults.forEach(def => {
      const hours = def.expire / 3600;
      console.log(`  - Server ID: ${def.server_id}, Expire: ${def.expire} seconds (${hours} hours)`);
    });
    
    // Update zorp_defaults to use 35 hours (126000 seconds)
    console.log('\n2. Updating zorp_defaults to use 35 hours...');
    const [updateDefaults] = await pool.query(`
      UPDATE zorp_defaults 
      SET expire = 126000 
      WHERE expire != 126000 OR expire IS NULL
    `);
    console.log(`✅ Updated ${updateDefaults.affectedRows} server defaults to use 35-hour expiration`);
    
    // Check current zorp_zones
    console.log('\n3. Checking current zorp_zones...');
    const [zones] = await pool.query(`
      SELECT z.*, rs.nickname 
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      ORDER BY z.created_at DESC
    `);
    console.log(`Found ${zones.length} active zones:`);
    zones.forEach(zone => {
      const hours = zone.expire / 3600;
      const expireTime = new Date(new Date(zone.created_at).getTime() + zone.expire * 1000);
      console.log(`  - ${zone.name} (${zone.owner} on ${zone.nickname}): ${zone.expire} seconds (${hours} hours), expires: ${expireTime}`);
    });
    
    // Update zorp_zones to use 35 hours (126000 seconds) for zones that don't already have it
    console.log('\n4. Updating zorp_zones to use 35 hours...');
    const [updateZones] = await pool.query(`
      UPDATE zorp_zones 
      SET expire = 126000 
      WHERE expire != 126000 OR expire IS NULL
    `);
    console.log(`✅ Updated ${updateZones.affectedRows} zones to use 35-hour expiration`);
    
    // Show final status
    console.log('\n5. Final status after updates:');
    const [finalDefaults] = await pool.query('SELECT * FROM zorp_defaults');
    console.log(`Server defaults: ${finalDefaults.length} servers using 35-hour expiration`);
    
    const [finalZones] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM zorp_zones 
      WHERE created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP
    `);
    console.log(`Active zones: ${finalZones[0].count} zones using 35-hour expiration`);
    
    console.log('\n🎉 Zorp expiration time fix complete!');
    console.log('All zones and defaults now use 35-hour (126000 seconds) expiration time.');
    
  } catch (error) {
    console.error('❌ Error fixing Zorp expiration times:', error);
  } finally {
    await pool.end();
  }
}

fixZorpExpirationTimes();
