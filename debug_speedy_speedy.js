const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugSpeedySpeedy() {
  console.log('🔍 Debugging "speedy speedy" Player Issue');
  console.log('========================================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!\n');

    // Step 1: Find the DeadOps server
    console.log('📋 Step 1: Finding DeadOps Server...\n');
    
    const [servers] = await connection.execute(`
      SELECT id, nickname, guild_id 
      FROM rust_servers 
      WHERE nickname LIKE '%DeadOps%' OR nickname LIKE '%Dead-ops%'
      ORDER BY nickname
    `);

    if (servers.length === 0) {
      console.log('❌ No DeadOps servers found!');
      return;
    }

    console.log(`Found ${servers.length} DeadOps servers:`);
    for (const server of servers) {
      console.log(`   Server: ${server.nickname} (ID: ${server.id})`);
    }

    // Step 2: Search for "speedy speedy" player
    console.log('\n📋 Step 2: Searching for "speedy speedy" Player...\n');
    
    const playerName = 'speedy speedy';
    
    // Search in players table
    const [playerResults] = await connection.execute(`
      SELECT 
        p.id,
        p.ign,
        p.discord_id,
        p.server_id,
        rs.nickname as server_name,
        g.discord_id as guild_discord_id
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE LOWER(p.ign) LIKE LOWER(?)
      ORDER BY rs.nickname, p.ign
    `, [`%${playerName}%`]);

    console.log(`Found ${playerResults.length} player records for "${playerName}":`);
    if (playerResults.length === 0) {
      console.log('   ❌ No players found with that name!');
    } else {
      for (const player of playerResults) {
        console.log(`   ✅ ${player.ign} on ${player.server_name} (Discord: ${player.discord_id || 'Not linked'})`);
      }
    }

    // Step 3: Check VIP authorization on DeadOps
    console.log('\n📋 Step 3: Checking VIP Authorization on DeadOps...\n');
    
    for (const server of servers) {
      console.log(`🔍 Checking VIP status on ${server.nickname}:`);
      
      // Check VIP kit authorization
      const [vipAuth] = await connection.execute(`
        SELECT 
          ka.id,
          ka.discord_id,
          ka.player_name,
          ka.kitlist,
          ka.server_id
        FROM kit_auth ka
        WHERE ka.server_id = ? AND ka.kitlist = 'VIPkit'
        ORDER BY ka.player_name
      `, [server.id]);

      console.log(`   VIP Authorizations: ${vipAuth.length}`);
      for (const auth of vipAuth) {
        console.log(`     - ${auth.player_name || 'Discord ID: ' + auth.discord_id} (${auth.kitlist})`);
      }

      // Check if "speedy speedy" is authorized
      const [speedyAuth] = await connection.execute(`
        SELECT ka.*, p.ign
        FROM kit_auth ka
        LEFT JOIN players p ON ka.discord_id = p.discord_id
        WHERE ka.server_id = ? 
        AND ka.kitlist = 'VIPkit'
        AND (LOWER(p.ign) LIKE LOWER(?) OR ka.player_name LIKE ?)
      `, [server.id, `%${playerName}%`, `%${playerName}%`]);

      if (speedyAuth.length > 0) {
        console.log(`   ✅ "speedy speedy" is VIP authorized on ${server.nickname}!`);
        for (const auth of speedyAuth) {
          console.log(`     - Auth ID: ${auth.id}, Player: ${auth.ign || auth.player_name}`);
        }
      } else {
        console.log(`   ❌ "speedy speedy" is NOT VIP authorized on ${server.nickname}`);
      }
    }

    // Step 4: Check for similar player names
    console.log('\n📋 Step 4: Searching for Similar Player Names...\n');
    
    const [similarPlayers] = await connection.execute(`
      SELECT 
        p.ign,
        p.server_id,
        rs.nickname as server_name
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE LOWER(p.ign) LIKE LOWER('speedy%') 
         OR LOWER(p.ign) LIKE LOWER('%speedy%')
         OR LOWER(p.ign) LIKE LOWER('speedy speedy')
      ORDER BY rs.nickname, p.ign
    `);

    console.log(`Found ${similarPlayers.length} players with similar names:`);
    for (const player of similarPlayers) {
      console.log(`   - ${player.ign} on ${player.server_name}`);
    }

    // Step 5: Check kit_auth table structure
    console.log('\n📋 Step 5: Checking kit_auth Table Structure...\n');
    
    try {
      const [tableStructure] = await connection.execute(`
        DESCRIBE kit_auth
      `);
      
      console.log('kit_auth table structure:');
      for (const column of tableStructure) {
        console.log(`   - ${column.Field}: ${column.Type} ${column.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
      }
    } catch (error) {
      console.log(`   ❌ Error checking table structure: ${error.message}`);
    }

    // Step 6: Show current VIP players on DeadOps
    console.log('\n📋 Step 6: Current VIP Players on DeadOps...\n');
    
    for (const server of servers) {
      console.log(`VIP Players on ${server.nickname}:`);
      
      const [vipPlayers] = await connection.execute(`
        SELECT 
          ka.player_name,
          ka.discord_id,
          p.ign,
          ka.created_at
        FROM kit_auth ka
        LEFT JOIN players p ON ka.discord_id = p.discord_id
        WHERE ka.server_id = ? AND ka.kitlist = 'VIPkit'
        ORDER BY COALESCE(p.ign, ka.player_name)
      `, [server.id]);

      if (vipPlayers.length === 0) {
        console.log(`   ❌ No VIP players found`);
      } else {
        for (const vip of vipPlayers) {
          const displayName = vip.ign || vip.player_name || `Discord ID: ${vip.discord_id}`;
          console.log(`   ✅ ${displayName}`);
        }
      }
    }

    // Step 7: Recommendations
    console.log('\n🎯 **Recommendations:**');
    console.log('======================');
    
    if (playerResults.length === 0) {
      console.log('1. ❌ Player "speedy speedy" not found in database');
      console.log('2. 🔍 Check if player name is spelled correctly');
      console.log('3. 📝 Player may need to join the server first to be added');
      console.log('4. 🎮 Use `/add-to-kit-list` command to add them to VIP');
    } else {
      console.log('1. ✅ Player found in database');
      console.log('2. 🔗 Check if Discord account is linked');
      console.log('3. 🎯 Use `/add-to-kit-list` to add to VIP list');
    }

    console.log('\n🔧 **To Add "speedy speedy" to VIP:**');
    console.log('1. Use Discord command: `/add-to-kit-list`');
    console.log('2. Select server: DeadOps');
    console.log('3. Enter name: speedy speedy');
    console.log('4. Select: VIP Kits');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

debugSpeedySpeedy();
