const mysql = require('mysql2/promise');
require('dotenv').config();

async function diagnosePlayerSystem() {
  console.log('🔍 Diagnosing Player System');
  console.log('============================\n');

  let connection; // Declared outside try block for finally access
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 Step 1: Checking database structure...');
    
    // Check what tables exist
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('📊 Available tables:');
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`  - ${tableName}`);
    });

    console.log('\n📋 Step 2: Checking guilds...');
    const [guilds] = await connection.execute('SELECT * FROM guilds');
    console.log(`📊 Found ${guilds.length} guilds:`);
    guilds.forEach(guild => {
      console.log(`  - ID: ${guild.id}, Discord ID: ${guild.discord_id}, Name: ${guild.name}`);
    });

    console.log('\n📋 Step 3: Checking rust servers...');
    const [servers] = await connection.execute('SELECT * FROM rust_servers');
    console.log(`📊 Found ${servers.length} servers:`);
    servers.forEach(server => {
      console.log(`  - ID: ${server.id}, Guild ID: ${server.guild_id}, Nickname: ${server.nickname}`);
    });

    console.log('\n📋 Step 4: Checking players...');
    const [players] = await connection.execute('SELECT * FROM players');
    console.log(`📊 Found ${players.length} players:`);
    players.forEach(player => {
      console.log(`  - ID: ${player.id}, IGN: ${player.ign}, Discord ID: ${player.discord_id}, Server ID: ${player.server_id}, Guild ID: ${player.guild_id}, Active: ${player.is_active}`);
    });

    console.log('\n📋 Step 5: Checking economy...');
    const [economy] = await connection.execute('SELECT * FROM economy');
    console.log(`📊 Found ${economy.length} economy records:`);
    economy.forEach(econ => {
      console.log(`  - Player ID: ${econ.player_id}, Balance: ${econ.balance}`);
    });

    console.log('\n📋 Step 6: Testing player lookup...');
    
    // Test the specific case mentioned in the error
    const guildId = '1387187628469653555';
    const serverName = 'USA-DeadOps';
    
    console.log(`Testing lookup for guild ${guildId} and server ${serverName}...`);
    
    // Get guild ID
    const [guildResult] = await connection.execute(
      'SELECT id FROM guilds WHERE discord_id = ?',
      [guildId]
    );
    
    if (guildResult.length === 0) {
      console.log('❌ Guild not found!');
    } else {
      const guildIdNum = guildResult[0].id;
      console.log(`✅ Guild found with ID: ${guildIdNum}`);
      
      // Get server ID
      const [serverResult] = await connection.execute(
        'SELECT id FROM rust_servers WHERE guild_id = ? AND nickname = ?',
        [guildIdNum, serverName]
      );
      
      if (serverResult.length === 0) {
        console.log('❌ Server not found!');
      } else {
        const serverId = serverResult[0].id;
        console.log(`✅ Server found with ID: ${serverId}`);
        
        // Get players for this server
        const [serverPlayers] = await connection.execute(
          'SELECT * FROM players WHERE guild_id = ? AND server_id = ? AND is_active = true',
          [guildIdNum, serverId]
        );
        
        console.log(`📊 Found ${serverPlayers.length} active players on this server:`);
        serverPlayers.forEach(player => {
          console.log(`  - ${player.ign} (Discord: ${player.discord_id})`);
        });
      }
    }

    console.log('\n🎉 Diagnosis Complete!');

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  } finally {
    if (connection) { // Check if connection was successfully established
      await connection.end();
    }
    process.exit();
  }
}

// Run the script
diagnosePlayerSystem();
