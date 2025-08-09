const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugLinkingSystem() {
  console.log('🔧 DEBUG LINKING SYSTEM');
  console.log('========================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 Step 1: Check what player tables exist...');
    const [tables] = await connection.execute("SHOW TABLES LIKE '%player%'");
    console.log('Player-related tables found:');
    tables.forEach(table => {
      console.log(`   - ${Object.values(table)[0]}`);
    });

    console.log('\n📋 Step 2: Check players table structure...');
    try {
      const [playersStructure] = await connection.execute('DESCRIBE players');
      console.log('players table structure:');
      playersStructure.forEach(col => {
        console.log(`   - ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
      });
    } catch (e) {
      console.log('❌ players table does not exist');
    }

    console.log('\n📋 Step 3: Check player_links table structure...');
    try {
      const [playerLinksStructure] = await connection.execute('DESCRIBE player_links');
      console.log('player_links table structure:');
      playerLinksStructure.forEach(col => {
        console.log(`   - ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
      });
    } catch (e) {
      console.log('❌ player_links table does not exist');
    }

    console.log('\n📋 Step 4: Check economy table structure...');
    try {
      const [economyStructure] = await connection.execute('DESCRIBE economy');
      console.log('economy table structure:');
      economyStructure.forEach(col => {
        console.log(`   - ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
      });
    } catch (e) {
      console.log('❌ economy table does not exist');
    }

    console.log('\n📋 Step 5: Check sample data from players table...');
    try {
      const [playersData] = await connection.execute('SELECT * FROM players LIMIT 5');
      console.log(`Found ${playersData.length} sample records in players table:`);
      playersData.forEach((player, index) => {
        console.log(`   ${index + 1}. ID: ${player.id}, Guild: ${player.guild_id}, Server: ${player.server_id}, Discord: ${player.discord_id}, IGN: ${player.ign}, Active: ${player.is_active}`);
      });
    } catch (e) {
      console.log('❌ Cannot query players table:', e.message);
    }

    console.log('\n📋 Step 6: Check sample data from player_links table...');
    try {
      const [playerLinksData] = await connection.execute('SELECT * FROM player_links LIMIT 5');
      console.log(`Found ${playerLinksData.length} sample records in player_links table:`);
      playerLinksData.forEach((link, index) => {
        console.log(`   ${index + 1}. ID: ${link.id}, Guild: ${link.guild_id}, Discord: ${link.discord_id}, IGN: ${link.ign}, Server: ${link.server_id}, Active: ${link.is_active}`);
      });
    } catch (e) {
      console.log('❌ Cannot query player_links table:', e.message);
    }

    console.log('\n📋 Step 7: Check for orphaned economy records...');
    try {
      const [orphanedEconomy] = await connection.execute(`
        SELECT e.*, p.ign as player_ign 
        FROM economy e 
        LEFT JOIN players p ON e.player_id = p.id 
        WHERE p.id IS NULL 
        LIMIT 5
      `);
      console.log(`Found ${orphanedEconomy.length} orphaned economy records (no matching player)`);
    } catch (e) {
      console.log('❌ Cannot check orphaned economy records:', e.message);
    }

    console.log('\n📋 Step 8: Check for duplicate players...');
    try {
      const [duplicates] = await connection.execute(`
        SELECT guild_id, discord_id, COUNT(*) as count 
        FROM players 
        WHERE is_active = true 
        GROUP BY guild_id, discord_id 
        HAVING COUNT(*) > 1
      `);
      console.log(`Found ${duplicates.length} Discord IDs with multiple active links`);
      duplicates.forEach(dup => {
        console.log(`   - Guild: ${dup.guild_id}, Discord: ${dup.discord_id}, Count: ${dup.count}`);
      });
    } catch (e) {
      console.log('❌ Cannot check duplicates:', e.message);
    }

    console.log('\n📋 Step 9: Check guilds table...');
    try {
      const [guilds] = await connection.execute('SELECT * FROM guilds');
      console.log(`Found ${guilds.length} guilds:`);
      guilds.forEach(guild => {
        console.log(`   - ID: ${guild.id}, Discord ID: ${guild.discord_id}, Name: ${guild.name}`);
      });
    } catch (e) {
      console.log('❌ Cannot query guilds table:', e.message);
    }

    await connection.end();

    console.log('\n🎯 ANALYSIS:');
    console.log('This will show us exactly what database structure you have');
    console.log('and where the linking system is failing.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

debugLinkingSystem();