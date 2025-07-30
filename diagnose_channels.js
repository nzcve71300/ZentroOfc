const mysql = require('mysql2/promise');
require('dotenv').config();

async function diagnoseChannels() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('🔍 Diagnosing channel configuration issues...\n');

    // 1. Check all channel settings
    console.log('1. Checking all channel settings:');
    const [channelSettings] = await connection.execute(`
      SELECT cs.*, rs.nickname, g.discord_id, g.name as guild_name
      FROM channel_settings cs
      JOIN rust_servers rs ON cs.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
    `);
    
    if (channelSettings.length === 0) {
      console.log('❌ No channel settings found!');
      console.log('This means no channels have been configured with /channel-set');
    } else {
      console.log('✅ Found channel settings:');
      channelSettings.forEach(setting => {
        console.log(`  - Guild: ${setting.guild_name} (${setting.discord_id})`);
        console.log(`  - Server: ${setting.nickname}`);
        console.log(`  - Type: ${setting.channel_type}`);
        console.log(`  - Channel ID: ${setting.channel_id}`);
        console.log('  ---');
      });
    }

    // 2. Check all servers
    console.log('\n2. Checking all servers:');
    const [servers] = await connection.execute(`
      SELECT rs.*, g.discord_id, g.name as guild_name
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
    `);
    
    console.log('Available servers:');
    servers.forEach(server => {
      console.log(`  - ID: ${server.id}`);
      console.log(`  - Name: ${server.nickname}`);
      console.log(`  - Guild: ${server.guild_name} (${server.discord_id})`);
      console.log(`  - IP: ${server.ip}:${server.port}`);
      console.log('  ---');
    });

    // 3. Check if RCON connections are working
    console.log('\n3. Testing RCON connections:');
    for (const server of servers) {
      if (server.ip === 'PLACEHOLDER_IP' || server.ip === '0.0.0.0') {
        console.log(`⚠️ Skipping ${server.nickname} - invalid IP: ${server.ip}`);
        continue;
      }
      
      try {
        const { getServerInfo } = require('./src/rcon');
        const info = await getServerInfo(server.ip, server.port, server.password);
        if (info && info.Players !== undefined) {
          console.log(`✅ ${server.nickname}: ${info.Players} players online`);
        } else {
          console.log(`❌ ${server.nickname}: Could not get player count`);
        }
      } catch (error) {
        console.log(`❌ ${server.nickname}: RCON connection failed - ${error.message}`);
      }
    }

    // 4. Check for specific issues
    console.log('\n4. Potential issues:');
    
    // Check if any servers have no channel settings
    const serversWithoutChannels = servers.filter(server => 
      !channelSettings.some(cs => cs.server_id === server.id)
    );
    
    if (serversWithoutChannels.length > 0) {
      console.log('❌ Servers without channel settings:');
      serversWithoutChannels.forEach(server => {
        console.log(`  - ${server.nickname} (${server.guild_name})`);
      });
    }

    // Check if any channel settings reference non-existent servers
    const orphanedSettings = channelSettings.filter(cs => 
      !servers.some(s => s.id === cs.server_id)
    );
    
    if (orphanedSettings.length > 0) {
      console.log('❌ Orphaned channel settings (server no longer exists):');
      orphanedSettings.forEach(cs => {
        console.log(`  - Server ID: ${cs.server_id}, Type: ${cs.channel_type}`);
      });
    }

    console.log('\n🔧 RECOMMENDATIONS:');
    console.log('1. Make sure you have set up channels using /channel-set');
    console.log('2. Ensure your server IPs are correct (not PLACEHOLDER_IP)');
    console.log('3. Check that RCON passwords are correct');
    console.log('4. Verify the bot has permissions to send messages to the channels');
    console.log('5. Check the bot logs for any error messages');

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the diagnosis
diagnoseChannels(); 