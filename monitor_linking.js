const mysql = require('mysql2/promise');
require('dotenv').config();

async function monitorLinking() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    // Check for duplicates
    const [duplicates] = await connection.execute(`
      SELECT 
        discord_id,
        guild_id,
        COUNT(*) as count
      FROM players 
      WHERE discord_id IS NOT NULL AND discord_id != '000000000000000000'
      GROUP BY discord_id, guild_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);

    if (duplicates.length > 0) {
      console.log(`[${new Date().toISOString()}] ⚠️  Found ${duplicates.length} duplicate Discord IDs - running auto-fix...`);
      
      // Run auto-fix
      await connection.execute('CALL auto_fix_linking_duplicates()');
      
      console.log(`[${new Date().toISOString()}] ✅ Auto-fix completed`);
    } else {
      console.log(`[${new Date().toISOString()}] ✅ No duplicates found - system healthy`);
    }

  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Monitoring error:`, error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

monitorLinking();
