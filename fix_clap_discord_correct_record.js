const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixClapDiscordCorrectRecord() {
  console.log('🔧 FIXING CLAP2000777 DISCORD ID - CORRECT RECORD');
  console.log('================================================');

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

    // Step 1: Show the current situation
    console.log('\n📋 Step 1: Current situation...');
    console.log('Players table (ID 18508 - Dead-ops server):');
    const [playersTable] = await connection.execute(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.id = 18508
    `);
    
    if (playersTable.length > 0) {
      const p = playersTable[0];
      console.log(`  ID: ${p.id}, IGN: "${p.ign}", Discord: ${p.discord_id}, Active: ${p.is_active}, Balance: ${p.balance || 0}, Server: ${p.nickname}`);
    }

    console.log('\nPlayer_server_links table (ID 1475 - different server):');
    const [serverLinksTable] = await connection.execute(`
      SELECT player_id, ign, discord_id, is_active, server_id
      FROM player_server_links 
      WHERE player_id = 1475
    `);
    
    if (serverLinksTable.length > 0) {
      const s = serverLinksTable[0];
      console.log(`  Player ID: ${s.player_id}, IGN: "${s.ign}", Discord: ${s.discord_id}, Active: ${s.is_active}, Server: ${s.server_id}`);
    }

    // Step 2: Update the players table record (ID 18508) with the correct Discord ID
    console.log('\n📋 Step 2: Updating players table record (ID 18508)...');
    
    const updateResult = await connection.execute(`
      UPDATE players 
      SET discord_id = 899414980355571712
      WHERE id = 18508
    `);
    
    console.log(`Update result: ${updateResult[0].affectedRows} rows affected, ${updateResult[0].changedRows} changed`);

    // Step 3: Verify the update
    console.log('\n📋 Step 3: Verifying the update...');
    const [updatedRecord] = await connection.execute(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.id = 18508
    `);
    
    if (updatedRecord.length > 0) {
      const record = updatedRecord[0];
      console.log(`Updated record:`);
      console.log(`  ID: ${record.id}, IGN: "${record.ign}", Discord: ${record.discord_id}, Active: ${record.is_active}, Balance: ${record.balance || 0}, Server: ${record.nickname}`);
      
      if (record.discord_id == 899414980355571712) {
        console.log('\n🎉 SUCCESS: Clap2000777 (ID 18508) now has the CORRECT Discord ID!');
      } else {
        console.log('\n❌ ISSUE: Discord ID was not updated correctly');
        console.log(`Expected: 899414980355571712`);
        console.log(`Actual: ${record.discord_id}`);
      }
    }

    // Step 4: Check the view result
    console.log('\n📋 Step 4: Checking the view result...');
    const [viewResult] = await connection.execute(`
      SELECT id, ign, discord_id, is_active, server_name FROM players_unified WHERE id = 18508
    `);
    
    if (viewResult.length > 0) {
      const v = viewResult[0];
      console.log(`View result: ID: ${v.id}, IGN: "${v.ign}", Discord: ${v.discord_id}, Active: ${v.is_active}, Server: ${v.server_name}`);
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

// Run the fix
if (require.main === module) {
  fixClapDiscordCorrectRecord()
    .then(() => {
      console.log('\n✅ Correct record fix completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Correct record fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixClapDiscordCorrectRecord };
