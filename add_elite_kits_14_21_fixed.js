const mysql = require('mysql2/promise');
require('dotenv').config();

const newEliteKits = [
  {
    kit_name: 'ELITEkit14',
    game_name: 'Elite Kit 14',
    emote: 'd11_quick_chat_activities_phrase_format d11_Metal_Fragments'
  },
  {
    kit_name: 'ELITEkit15',
    game_name: 'Elite Kit 15',
    emote: 'd11_quick_chat_activities_phrase_format d11_Medicine'
  },
  {
    kit_name: 'ELITEkit16',
    game_name: 'Elite Kit 16',
    emote: 'd11_quick_chat_activities_phrase_format d11_Stone'
  },
  {
    kit_name: 'ELITEkit17',
    game_name: 'Elite Kit 17',
    emote: 'd11_quick_chat_activities_phrase_format d11_Wood'
  },
  {
    kit_name: 'ELITEkit18',
    game_name: 'Elite Kit 18',
    emote: 'd11_quick_chat_activities_phrase_format d11_Metal'
  },
  {
    kit_name: 'ELITEkit19',
    game_name: 'Elite Kit 19',
    emote: 'd11_quick_chat_activities_phrase_format d11_Food'
  },
  {
    kit_name: 'ELITEkit20',
    game_name: 'Elite Kit 20',
    emote: 'd11_quick_chat_activities_phrase_format d11_Water'
  },
  {
    kit_name: 'ELITEkit21',
    game_name: 'Elite Kit 21',
    emote: 'd11_quick_chat_activities_phrase_format d11_Scrap'
  }
];

async function addNewEliteKits() {
  console.log('🚀 Adding 8 New Elite Kits (14-21)');
  console.log('=====================================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    // Get all servers (removed the enabled filter)
    const [servers] = await connection.execute('SELECT id, nickname FROM rust_servers');
    console.log(`📡 Found ${servers.length} servers`);

    let totalKitsAdded = 0;
    let totalAuthEntriesAdded = 0;

    for (const server of servers) {
      console.log(`\n🏠 Processing server: ${server.nickname}`);
      
      for (const kit of newEliteKits) {
        try {
          // Add autokit entry
          const [autokitResult] = await connection.execute(`
            INSERT INTO autokits (server_id, kit_name, enabled, cooldown, game_name, emote)
            VALUES (?, ?, true, 60, ?, ?)
            ON DUPLICATE KEY UPDATE
            enabled = true,
            cooldown = 60,
            game_name = VALUES(game_name),
            emote = VALUES(emote)
          `, [server.id, kit.kit_name, kit.game_name, kit.emote]);

          if (autokitResult.affectedRows > 0) {
            console.log(`  ✅ Added ${kit.kit_name} to ${server.nickname}`);
            totalKitsAdded++;
          }

          // Add kit authorization entry
          const authKitName = kit.kit_name.replace('ELITEkit', 'Elite');
          const [authResult] = await connection.execute(`
            INSERT INTO kit_auth (server_id, kitlist, discord_id)
            VALUES (?, ?, NULL)
            ON DUPLICATE KEY UPDATE
            server_id = VALUES(server_id),
            kitlist = VALUES(kitlist)
          `, [server.id, authKitName]);

          if (authResult.affectedRows > 0) {
            console.log(`  ✅ Added ${authKitName} authorization to ${server.nickname}`);
            totalAuthEntriesAdded++;
          }

        } catch (error) {
          console.error(`  ❌ Error adding ${kit.kit_name} to ${server.nickname}:`, error.message);
        }
      }
    }

    console.log('\n📊 Summary:');
    console.log(`✅ Total autokit entries added: ${totalKitsAdded}`);
    console.log(`✅ Total authorization entries added: ${totalAuthEntriesAdded}`);
    console.log(`✅ New elite kits added: ${newEliteKits.length}`);
    console.log(`✅ Servers updated: ${servers.length}`);

    // Verify the additions
    console.log('\n🔍 Verification:');
    for (const kit of newEliteKits) {
      const [count] = await connection.execute(`
        SELECT COUNT(*) as count FROM autokits 
        WHERE kit_name = ? AND enabled = true
      `, [kit.kit_name]);
      console.log(`  ${kit.kit_name}: ${count[0].count} servers`);
    }

    await connection.end();
    console.log('\n✅ Database connection closed');
    console.log('\n🎉 Elite Kits 14-21 have been successfully added!');
    console.log('📝 Next steps:');
    console.log('   1. Restart the bot: pm2 restart zentro-bot');
    console.log('   2. Test the new kits with /autokits-setup');
    console.log('   3. Test adding players with /add-to-kit-list');

  } catch (error) {
    console.error('❌ Error adding elite kits:', error);
  }
}

addNewEliteKits();
