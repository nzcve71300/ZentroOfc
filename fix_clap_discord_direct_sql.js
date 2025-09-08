const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixClapDiscordDirectSQL() {
  console.log('🔧 DIRECT SQL FIX FOR CLAP2000777');
  console.log('=================================');

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

    // Step 1: Check if there's a view interfering
    console.log('\n📋 Step 1: Checking for interfering views...');
    const [views] = await connection.execute(`
      SELECT TABLE_NAME, VIEW_DEFINITION
      FROM INFORMATION_SCHEMA.VIEWS 
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME LIKE '%player%'
    `);

    if (views.length > 0) {
      console.log(`Found ${views.length} player-related views:`);
      for (const view of views) {
        console.log(`- ${view.TABLE_NAME}: ${view.VIEW_DEFINITION.substring(0, 100)}...`);
      }
    } else {
      console.log('✅ No player-related views found');
    }

    // Step 2: Try a completely different approach - delete and recreate
    console.log('\n📋 Step 2: Trying delete and recreate approach...');
    
    // First, get all the data we need to preserve
    const [playerData] = await connection.execute(`
      SELECT * FROM players WHERE id = 18508
    `);
    
    if (playerData.length === 0) {
      console.log('❌ Player record not found!');
      return;
    }
    
    const player = playerData[0];
    console.log(`Current player data: IGN="${player.ign}", Discord=${player.discord_id}, Active=${player.is_active}`);
    
    // Get economy data
    const [economyData] = await connection.execute(`
      SELECT * FROM economy WHERE player_id = 18508
    `);
    
    console.log(`Economy data: ${economyData.length} records found`);
    
    // Step 3: Delete the old record and create a new one
    console.log('\n📋 Step 3: Deleting old record and creating new one...');
    
    // Delete economy first
    if (economyData.length > 0) {
      await connection.execute('DELETE FROM economy WHERE player_id = 18508');
      console.log('✅ Deleted economy record');
    }
    
    // Delete player
    await connection.execute('DELETE FROM players WHERE id = 18508');
    console.log('✅ Deleted old player record');
    
    // Create new player record with correct Discord ID
    await connection.execute(`
      INSERT INTO players (
        id, guild_id, server_id, discord_id, ign, normalized_ign, 
        linked_at, is_active, unlinked_at, unlinked_by, unlink_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      18508, // Same ID
      player.guild_id,
      player.server_id,
      899414980355571712, // CORRECT Discord ID
      player.ign,
      player.normalized_ign,
      player.linked_at,
      player.is_active,
      player.unlinked_at,
      player.unlinked_by,
      player.unlink_reason
    ]);
    
    console.log('✅ Created new player record with correct Discord ID');
    
    // Recreate economy record
    if (economyData.length > 0) {
      await connection.execute(`
        INSERT INTO economy (player_id, balance, guild_id)
        VALUES (?, ?, ?)
      `, [18508, economyData[0].balance, economyData[0].guild_id]);
      console.log('✅ Recreated economy record');
    }
    
    // Step 4: Verify the fix
    console.log('\n📋 Step 4: Verifying the fix...');
    const [newPlayer] = await connection.execute(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.id = 18508
    `);
    
    if (newPlayer.length > 0) {
      const record = newPlayer[0];
      console.log(`New record:`);
      console.log(`- ID: ${record.id}, IGN: "${record.ign}", Discord: ${record.discord_id}, Active: ${record.is_active}, Balance: ${record.balance || 0}, Server: ${record.nickname}`);
      
      if (record.discord_id == 899414980355571712) {
        console.log('\n🎉 SUCCESS: Clap2000777 now has the CORRECT Discord ID!');
      } else {
        console.log('\n❌ ISSUE: Discord ID was not set correctly');
        console.log(`Expected: 899414980355571712`);
        console.log(`Actual: ${record.discord_id}`);
      }
    }

  } catch (error) {
    console.error('❌ Error in direct SQL fix:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
if (require.main === module) {
  fixClapDiscordDirectSQL()
    .then(() => {
      console.log('\n✅ Direct SQL fix completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Direct SQL fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixClapDiscordDirectSQL };
