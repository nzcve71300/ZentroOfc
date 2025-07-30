const mysql = require('mysql2/promise');
require('dotenv').config();

async function diagnoseLiveBot() {
  let connection;
  
  try {
    console.log('🔍 Diagnosing live bot messaging issues...\n');
    
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('1. Checking database configuration...');
    
    // Check channel settings
    const [channelSettings] = await connection.execute(`
      SELECT cs.*, rs.nickname, g.discord_id, g.name as guild_name
      FROM channel_settings cs
      JOIN rust_servers rs ON cs.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
    `);

    if (channelSettings.length === 0) {
      console.log('❌ No channel settings found!');
      console.log('   → Use /channel-set to configure channels');
      return;
    }

    console.log('✅ Channel settings found:');
    channelSettings.forEach(setting => {
      console.log(`   - ${setting.guild_name}: ${setting.nickname} -> ${setting.channel_type} (${setting.channel_id})`);
    });

    console.log('\n2. Checking server configurations...');
    
    // Check servers
    const [servers] = await connection.execute(`
      SELECT rs.*, g.discord_id, g.name as guild_name
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
    `);

    console.log('✅ Servers found:');
    servers.forEach(server => {
      console.log(`   - ${server.guild_name}: ${server.nickname} (${server.ip}:${server.port})`);
    });

    console.log('\n3. Checking for potential issues...');
    
    // Check for invalid server configurations
    const invalidServers = servers.filter(s => 
      !s.ip || s.ip === 'PLACEHOLDER_IP' || s.ip === '0.0.0.0' || s.ip === 'localhost' || s.ip === '127.0.0.1'
    );
    
    if (invalidServers.length > 0) {
      console.log('⚠️  Invalid server configurations found:');
      invalidServers.forEach(server => {
        console.log(`   - ${server.nickname}: ${server.ip}:${server.port}`);
      });
      console.log('   → These servers will not connect to RCON');
    }

    // Check for missing guild configurations
    const missingGuilds = channelSettings.filter(cs => !cs.discord_id);
    if (missingGuilds.length > 0) {
      console.log('⚠️  Channel settings with missing guild IDs:');
      missingGuilds.forEach(cs => {
        console.log(`   - ${cs.nickname} -> ${cs.channel_type}`);
      });
    }

    console.log('\n4. Recommendations for fixing messaging issues:');
    console.log('');
    console.log('🔧 IMMEDIATE ACTIONS:');
    console.log('   1. Check bot permissions in Discord:');
    console.log('      - Go to each configured channel');
    console.log('      - Verify bot has "Send Messages" permission');
    console.log('      - Verify bot has "Embed Links" permission');
    console.log('      - For voice channels, verify bot has "Manage Channels" permission');
    console.log('');
    console.log('   2. Check bot logs for errors:');
    console.log('      pm2 logs zentro-bot --lines 100');
    console.log('      Look for: "Error sending feed embed:", "Channel not found:", "Channel is not a voice channel:"');
    console.log('');
    console.log('   3. Test with Discord command:');
    console.log('      Use /test-message in Discord to manually trigger a message');
    console.log('');
    console.log('   4. Verify bot is in the correct Discord server:');
    console.log('      Check that the bot is actually in the Discord server with ID:', channelSettings[0]?.discord_id);
    console.log('');
    console.log('   5. Check channel IDs are correct:');
    console.log('      Verify these channel IDs exist in Discord:');
    channelSettings.forEach(cs => {
      console.log(`      - ${cs.channel_type}: ${cs.channel_id}`);
    });

    console.log('\n5. Common causes of messaging failures:');
    console.log('   ❌ Bot not in the Discord server');
    console.log('   ❌ Bot lacks permissions in the channels');
    console.log('   ❌ Channel IDs are incorrect');
    console.log('   ❌ Bot is not running or has crashed');
    console.log('   ❌ Discord API rate limiting');
    console.log('   ❌ Network connectivity issues');

    console.log('\n6. Next steps:');
    console.log('   1. Run: pm2 logs zentro-bot --lines 200');
    console.log('   2. Look for any error messages related to channels or Discord API');
    console.log('   3. Try the /test-message command in Discord');
    console.log('   4. Check bot permissions in Discord server settings');
    console.log('   5. Verify the bot is online and connected to Discord');

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the diagnosis
diagnoseLiveBot(); 