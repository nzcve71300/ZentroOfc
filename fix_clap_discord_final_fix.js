const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixClapDiscordFinalFix() {
  console.log('🔧 FINAL FIX - SYNC PLAYERS TABLE WITH PLAYER_SERVER_LINKS');
  console.log('=========================================================');

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

    // Step 1: Check what's in player_server_links
    console.log('\n📋 Step 1: Checking player_server_links table...');
    const [serverLinks] = await connection.execute(`
      SELECT * FROM player_server_links 
      WHERE player_id = 18508
    `);
    
    if (serverLinks.length > 0) {
      console.log(`Found ${serverLinks.length} records in player_server_links:`);
      for (const link of serverLinks) {
        console.log(`  Player ID: ${link.player_id}, Discord ID: ${link.discord_id}, IGN: "${link.ign}", Server: ${link.server_id}, Active: ${link.is_active}`);
      }
    } else {
      console.log('❌ No records found in player_server_links for ID 18508');
      return;
    }

    // Step 2: Update the players table to match player_server_links
    console.log('\n📋 Step 2: Updating players table to match player_server_links...');
    
    const correctDiscordId = serverLinks[0].discord_id;
    console.log(`Using Discord ID from player_server_links: ${correctDiscordId}`);
    
    const updateResult = await connection.execute(`
      UPDATE players 
      SET discord_id = ?
      WHERE id = 18508
    `, [correctDiscordId]);
    
    console.log(`Update result: ${updateResult[0].affectedRows} rows affected, ${updateResult[0].changedRows} changed`);

    // Step 3: Verify both tables now match
    console.log('\n📋 Step 3: Verifying both tables match...');
    
    const [playersTable] = await connection.execute(`
      SELECT id, ign, discord_id, is_active FROM players WHERE id = 18508
    `);
    
    const [serverLinksTable] = await connection.execute(`
      SELECT player_id, ign, discord_id, is_active FROM player_server_links WHERE player_id = 18508
    `);
    
    console.log('Players table:');
    if (playersTable.length > 0) {
      const p = playersTable[0];
      console.log(`  ID: ${p.id}, IGN: "${p.ign}", Discord: ${p.discord_id}, Active: ${p.is_active}`);
    }
    
    console.log('Player_server_links table:');
    if (serverLinksTable.length > 0) {
      const s = serverLinksTable[0];
      console.log(`  Player ID: ${s.player_id}, IGN: "${s.ign}", Discord: ${s.discord_id}, Active: ${s.is_active}`);
    }
    
    // Step 4: Check the view now
    console.log('\n📋 Step 4: Checking the view result...');
    const [viewResult] = await connection.execute(`
      SELECT id, ign, discord_id, is_active, server_name FROM players_unified WHERE id = 18508
    `);
    
    if (viewResult.length > 0) {
      const v = viewResult[0];
      console.log(`View result: ID: ${v.id}, IGN: "${v.ign}", Discord: ${v.discord_id}, Active: ${v.is_active}, Server: ${v.server_name}`);
      
      if (v.discord_id == 899414980355571712) {
        console.log('\n🎉 SUCCESS: All tables now show the correct Discord ID!');
      } else {
        console.log('\n❌ View still shows incorrect Discord ID');
      }
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
  fixClapDiscordFinalFix()
    .then(() => {
      console.log('\n✅ Final fix completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Final fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixClapDiscordFinalFix };
