const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixServerName() {
  console.log('🔧 Fixing Server Name');
  console.log('=====================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    const guildId = '1387187628469653555';
    const oldServerName = '[USA]DeadOps';
    const newServerName = 'USA-DeadOps';

    console.log(`\n📋 Step 1: Finding server with old name "${oldServerName}"...`);
    
    // First, let's see what servers exist for this guild
    const [guildServers] = await connection.execute(
      'SELECT id, nickname, guild_id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)',
      [guildId]
    );

    console.log(`\n📊 Found ${guildServers.length} servers for guild ${guildId}:`);
    guildServers.forEach(server => {
      console.log(`  - ID: ${server.id}, Name: ${server.nickname}`);
    });

    // Find the specific server to update
    const [targetServer] = await connection.execute(
      'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, oldServerName]
    );

    if (targetServer.length === 0) {
      console.log(`\n❌ No server found with name "${oldServerName}"`);
      console.log('\n📋 Available server names:');
      guildServers.forEach(server => {
        console.log(`  - ${server.nickname}`);
      });
      return;
    }

    const serverId = targetServer[0].id;
    console.log(`\n✅ Found server: ID ${serverId}, Current name: "${targetServer[0].nickname}"`);

    console.log(`\n📋 Step 2: Updating server name to "${newServerName}"...`);
    
    // Update the server name
    const [updateResult] = await connection.execute(
      'UPDATE rust_servers SET nickname = ? WHERE id = ?',
      [newServerName, serverId]
    );

    if (updateResult.affectedRows > 0) {
      console.log(`✅ Successfully updated server name from "${oldServerName}" to "${newServerName}"`);
    } else {
      console.log('❌ No rows were updated');
      return;
    }

    console.log(`\n📋 Step 3: Verifying the update...`);
    
    // Verify the update
    const [verifyResult] = await connection.execute(
      'SELECT id, nickname FROM rust_servers WHERE id = ?',
      [serverId]
    );

    if (verifyResult.length > 0) {
      console.log(`✅ Verification successful! Server ${serverId} now has name: "${verifyResult[0].nickname}"`);
    }

    console.log(`\n📋 Step 4: Checking for related tables that might need updates...`);
    
    // Check if there are any other tables that reference the old server name
    const tablesToCheck = [
      'eco_games_config',
      'teleport_configs', 
      'event_configs',
      'position_configs',
      'crate_event_configs',
      'rider_config',
      'home_teleport_configs',
      'recycler_config',
      'prison_configs',
      'prison_positions',
      'prisoners',
      'bounty_configs',
      'bounty_tracking'
    ];

    for (const table of tablesToCheck) {
      try {
        const [tableCheck] = await connection.execute(
          `SELECT COUNT(*) as count FROM ${table} WHERE server_id = ?`,
          [serverId]
        );
        
        if (tableCheck[0].count > 0) {
          console.log(`  - ${table}: ${tableCheck[0].count} records found`);
        }
      } catch (error) {
        // Table might not exist, skip it
        console.log(`  - ${table}: table not found (skipping)`);
      }
    }

    console.log('\n🎉 Server name fix completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Restart the bot: pm2 restart zentro-bot');
    console.log('2. Test the new server name: /balance server: USA-DeadOps');
    console.log('3. The player nzcve7130 should now work on the new server');

  } catch (error) {
    console.error('❌ Error fixing server name:', error);
  } finally {
    process.exit();
  }
}

// Run the script
fixServerName(); 