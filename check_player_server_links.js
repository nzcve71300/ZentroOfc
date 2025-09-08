const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkPlayerServerLinks() {
  console.log('🔍 CHECKING PLAYER_SERVER_LINKS TABLE');
  console.log('=====================================');

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

    // Check all records in player_server_links
    console.log('\n📋 All records in player_server_links:');
    const [allLinks] = await connection.execute(`
      SELECT * FROM player_server_links 
      ORDER BY player_id
    `);
    
    console.log(`Found ${allLinks.length} total records in player_server_links:`);
    for (const link of allLinks) {
      console.log(`  Player ID: ${link.player_id}, Discord ID: ${link.discord_id}, IGN: "${link.ign}", Server: ${link.server_id}, Active: ${link.is_active}`);
    }

    // Check for any records with the target Discord ID
    console.log('\n📋 Records with target Discord ID 899414980355571712:');
    const [targetDiscord] = await connection.execute(`
      SELECT * FROM player_server_links 
      WHERE discord_id = 899414980355571712
    `);
    
    if (targetDiscord.length > 0) {
      console.log(`Found ${targetDiscord.length} records with target Discord ID:`);
      for (const link of targetDiscord) {
        console.log(`  Player ID: ${link.player_id}, Discord ID: ${link.discord_id}, IGN: "${link.ign}", Server: ${link.server_id}, Active: ${link.is_active}`);
      }
    } else {
      console.log('❌ No records found with target Discord ID 899414980355571712');
    }

    // Check for any records with Clap2000777
    console.log('\n📋 Records with IGN Clap2000777:');
    const [clapRecords] = await connection.execute(`
      SELECT * FROM player_server_links 
      WHERE LOWER(ign) = LOWER('Clap2000777')
    `);
    
    if (clapRecords.length > 0) {
      console.log(`Found ${clapRecords.length} Clap2000777 records:`);
      for (const link of clapRecords) {
        console.log(`  Player ID: ${link.player_id}, Discord ID: ${link.discord_id}, IGN: "${link.ign}", Server: ${link.server_id}, Active: ${link.is_active}`);
      }
    } else {
      console.log('❌ No Clap2000777 records found in player_server_links');
    }

    // Check the view again to see what it's actually showing
    console.log('\n📋 What the view is actually showing:');
    const [viewResult] = await connection.execute(`
      SELECT id, ign, discord_id, is_active, server_name FROM players_unified WHERE id = 18508
    `);
    
    if (viewResult.length > 0) {
      const v = viewResult[0];
      console.log(`View result: ID: ${v.id}, IGN: "${v.ign}", Discord: ${v.discord_id}, Active: ${v.is_active}, Server: ${v.server_name}`);
    } else {
      console.log('❌ No records found in view for ID 18508');
    }

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
  checkPlayerServerLinks()
    .then(() => {
      console.log('\n✅ Player server links check completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Player server links check failed:', error);
      process.exit(1);
    });
}

module.exports = { checkPlayerServerLinks };
