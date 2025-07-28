const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
});

async function fixZoneExpire() {
  try {
    console.log('🔧 Fixing zone expiration values...');
    
    // Update zones table to use 35 hours (126000 seconds)
    console.log('Updating zones table expire values...');
    const zonesResult = await pool.query(`
      UPDATE zones 
      SET expire = 126000 
      WHERE expire = 115200 OR expire IS NULL
    `);
    console.log(`✅ Updated ${zonesResult.rowCount} zones to use 35-hour expiration`);

    // Update zorp_defaults table to use 35 hours (126000 seconds)
    console.log('Updating zorp_defaults table expire values...');
    const defaultsResult = await pool.query(`
      UPDATE zorp_defaults 
      SET expire = 126000 
      WHERE expire = 115200 OR expire IS NULL
    `);
    console.log(`✅ Updated ${defaultsResult.rowCount} server defaults to use 35-hour expiration`);

    // Check current values
    console.log('\n📊 Current zone expiration values:');
    const zonesCheck = await pool.query('SELECT id, name, expire FROM zones ORDER BY id');
    zonesCheck.rows.forEach(zone => {
      const hours = zone.expire / 3600;
      console.log(`Zone ${zone.name}: ${zone.expire} seconds (${hours} hours)`);
    });

    console.log('\n📊 Current server default expiration values:');
    const defaultsCheck = await pool.query('SELECT server_id, expire FROM zorp_defaults ORDER BY server_id');
    defaultsCheck.rows.forEach(defaults => {
      const hours = defaults.expire / 3600;
      console.log(`Server ${defaults.server_id}: ${defaults.expire} seconds (${hours} hours)`);
    });

    console.log('\n🎉 Zone expiration fix complete!');
    
  } catch (error) {
    console.error('❌ Error fixing zone expiration:', error);
  } finally {
    await pool.end();
  }
}

fixZoneExpire(); 