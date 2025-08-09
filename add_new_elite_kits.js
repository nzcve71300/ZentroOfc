const mysql = require('mysql2/promise');
require('dotenv').config();

async function addNewEliteKits() {
  console.log('🔧 Add New Elite Kits (ELITEkit7-13)');
  console.log('====================================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 Step 1: Getting all servers...');
    const [servers] = await connection.execute(`
      SELECT rs.id, rs.nickname, g.discord_id as guild_id
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
    `);

    console.log(`Found ${servers.length} servers:`);
    servers.forEach(server => {
      console.log(`   - ${server.nickname} (Guild: ${server.guild_id})`);
    });

    // New elite kits to add
    const newEliteKits = [
      { kit_name: 'ELITEkit7', game_name: 'Elite Kit 7', cooldown: 60, enabled: false },
      { kit_name: 'ELITEkit8', game_name: 'Elite Kit 8', cooldown: 60, enabled: false },
      { kit_name: 'ELITEkit9', game_name: 'Elite Kit 9', cooldown: 60, enabled: false },
      { kit_name: 'ELITEkit10', game_name: 'Elite Kit 10', cooldown: 60, enabled: false },
      { kit_name: 'ELITEkit11', game_name: 'Elite Kit 11', cooldown: 60, enabled: false },
      { kit_name: 'ELITEkit12', game_name: 'Elite Kit 12', cooldown: 60, enabled: false },
      { kit_name: 'ELITEkit13', game_name: 'Elite Kit 13', cooldown: 60, enabled: false }
    ];

    console.log('\n📋 Step 2: Adding new elite kits to autokits table...');
    
    for (const server of servers) {
      console.log(`\n   Processing server: ${server.nickname}`);
      
      for (const kit of newEliteKits) {
        // Check if kit already exists for this server
        const [existing] = await connection.execute(
          'SELECT id FROM autokits WHERE server_id = ? AND kit_name = ?',
          [server.id, kit.kit_name]
        );

        if (existing.length > 0) {
          console.log(`     - ${kit.kit_name}: Already exists, skipping`);
        } else {
          // Insert new kit
          await connection.execute(
            'INSERT INTO autokits (server_id, kit_name, game_name, cooldown, enabled) VALUES (?, ?, ?, ?, ?)',
            [server.id, kit.kit_name, kit.game_name, kit.cooldown, kit.enabled]
          );
          console.log(`     - ${kit.kit_name}: Added successfully`);
        }
      }
    }

    console.log('\n📋 Step 3: Verifying the additions...');
    const [allKits] = await connection.execute(`
      SELECT ak.kit_name, ak.game_name, ak.enabled, ak.cooldown, rs.nickname as server_name
      FROM autokits ak
      JOIN rust_servers rs ON ak.server_id = rs.id
      WHERE ak.kit_name IN ('ELITEkit7', 'ELITEkit8', 'ELITEkit9', 'ELITEkit10', 'ELITEkit11', 'ELITEkit12', 'ELITEkit13')
      ORDER BY rs.nickname, ak.kit_name
    `);

    console.log(`\nFound ${allKits.length} new elite kit entries:`);
    allKits.forEach(kit => {
      console.log(`   - ${kit.server_name}: ${kit.kit_name} (${kit.game_name}) - Enabled: ${kit.enabled}, Cooldown: ${kit.cooldown}min`);
    });

    await connection.end();

    console.log('\n🎯 SUMMARY:');
    console.log('✅ Added 7 new elite kits (ELITEkit7-13) to all servers');
    console.log('✅ All kits are disabled by default with 60-minute cooldown');
    console.log('✅ Updated Discord command choices to include new kits');
    console.log('✅ Updated RCON emote mappings for new kits');

    console.log('\n📝 EMOTE MAPPINGS ADDED:');
    console.log('   - ELITEkit7: d11_quick_chat_i_have_phrase_format metal.refined');
    console.log('   - ELITEkit8: d11_quick_chat_i_have_phrase_format d11_Scrap');
    console.log('   - ELITEkit9: d11_quick_chat_i_have_phrase_format lowgradefuel');
    console.log('   - ELITEkit10: d11_quick_chat_i_have_phrase_format d11_Food');
    console.log('   - ELITEkit11: d11_quick_chat_i_have_phrase_format d11_Water');
    console.log('   - ELITEkit12: d11_quick_chat_i_have_phrase_format bow.hunting');
    console.log('   - ELITEkit13: d11_quick_chat_i_have_phrase_format pickaxe');

    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Restart the bot to load new commands:');
    console.log('   pm2 stop zentro-bot');
    console.log('   pm2 start zentro-bot');
    console.log('2. Use /autokits-setup to configure each new kit:');
    console.log('   - Set enabled to "on"');
    console.log('   - Adjust cooldown as needed');
    console.log('   - Set proper game names');
    console.log('3. Use /add-to-kit-list to authorize players for Elite Lists 7-13');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

addNewEliteKits();