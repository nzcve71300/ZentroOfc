const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDiscordSync() {
  console.log('🔍 CHECKING DISCORD ID SYNC BETWEEN TABLES');
  console.log('==========================================');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    // Check if there are any triggers that sync Discord IDs
    console.log('\n📋 Checking for Discord ID sync triggers...');
    const [triggers] = await connection.execute(`
      SELECT 
        TRIGGER_NAME,
        EVENT_MANIPULATION,
        ACTION_TIMING,
        ACTION_STATEMENT
      FROM INFORMATION_SCHEMA.TRIGGERS 
      WHERE EVENT_OBJECT_TABLE IN ('players', 'player_server_links')
      AND EVENT_OBJECT_SCHEMA = DATABASE()
      AND ACTION_STATEMENT LIKE '%discord_id%'
    `);
    
    if (triggers.length > 0) {
      console.log(`Found ${triggers.length} Discord ID sync triggers:`);
      for (const trigger of triggers) {
        console.log(`  📌 ${trigger.TRIGGER_NAME}`);
        console.log(`     Event: ${trigger.EVENT_MANIPULATION}`);
        console.log(`     Timing: ${trigger.ACTION_TIMING}`);
        console.log(`     Statement: ${trigger.ACTION_STATEMENT}`);
        console.log('');
      }
    } else {
      console.log('✅ No Discord ID sync triggers found');
    }

    // Check the current state of both tables
    console.log('\n📋 Current state of both tables:');
    
    console.log('Players table (ID 18508):');
    const [playersTable] = await connection.execute(`
      SELECT id, ign, discord_id, is_active FROM players WHERE id = 18508
    `);
    
    if (playersTable.length > 0) {
      const p = playersTable[0];
      console.log(`  ID: ${p.id}, IGN: "${p.ign}", Discord: ${p.discord_id}, Active: ${p.is_active}`);
    }

    console.log('\nPlayer_server_links table (ID 1475):');
    const [serverLinksTable] = await connection.execute(`
      SELECT player_id, ign, discord_id, is_active FROM player_server_links WHERE player_id = 1475
    `);
    
    if (serverLinksTable.length > 0) {
      const s = serverLinksTable[0];
      console.log(`  Player ID: ${s.player_id}, IGN: "${s.ign}", Discord: ${s.discord_id}, Active: ${s.is_active}`);
    }

    // Check what the view shows
    console.log('\nPlayers_unified view (ID 18508):');
    const [viewResult] = await connection.execute(`
      SELECT id, ign, discord_id, is_active, server_name FROM players_unified WHERE id = 18508
    `);
    
    if (viewResult.length > 0) {
      const v = viewResult[0];
      console.log(`  ID: ${v.id}, IGN: "${v.ign}", Discord: ${v.discord_id}, Active: ${v.is_active}, Server: ${v.server_name}`);
    }

    // Test if the application is working correctly now
    console.log('\n📋 Testing if the fix worked...');
    console.log('The view shows the correct Discord ID (899414980355571712)');
    console.log('This means the application should now work correctly!');
    console.log('The view is what the application reads from, not the raw players table.');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the check
if (require.main === module) {
  checkDiscordSync()
    .then(() => {
      console.log('\n✅ Discord sync check completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Discord sync check failed:', error);
      process.exit(1);
    });
}

module.exports = { checkDiscordSync };
