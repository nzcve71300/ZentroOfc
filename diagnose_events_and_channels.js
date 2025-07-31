const mysql = require('mysql2/promise');
const config = require('./src/config');

async function diagnoseIssues() {
  let connection;
  
  try {
    console.log('🔍 Diagnosing events and channel issues...');
    
    // Connect to database
    connection = await mysql.createConnection({
      host: config.db.host,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      port: config.db.port
    });
    
    console.log('✅ Database connection successful');
    
    // Check if event_configs table exists
    console.log('\n📋 Checking event_configs table...');
    const [eventTables] = await connection.execute("SHOW TABLES LIKE 'event_configs'");
    if (eventTables.length === 0) {
      console.log('❌ event_configs table does not exist!');
      console.log('💡 This is why events are not working');
    } else {
      console.log('✅ event_configs table exists');
      
      // Check event configurations
      const [eventConfigs] = await connection.execute('SELECT * FROM event_configs');
      console.log(`📊 Found ${eventConfigs.length} event configurations:`);
      eventConfigs.forEach(config => {
        console.log(`  - Server ID: ${config.server_id}, Type: ${config.event_type}, Enabled: ${config.enabled}`);
      });
    }
    
    // Check if channel_settings table exists
    console.log('\n📋 Checking channel_settings table...');
    const [channelTables] = await connection.execute("SHOW TABLES LIKE 'channel_settings'");
    if (channelTables.length === 0) {
      console.log('❌ channel_settings table does not exist!');
      console.log('💡 This is why channel-set is not working');
    } else {
      console.log('✅ channel_settings table exists');
      
      // Check channel settings
      const [channelSettings] = await connection.execute('SELECT * FROM channel_settings');
      console.log(`📊 Found ${channelSettings.length} channel settings:`);
      channelSettings.forEach(setting => {
        console.log(`  - Server ID: ${setting.server_id}, Type: ${setting.channel_type}, Channel ID: ${setting.channel_id}`);
      });
    }
    
    // Check rust_servers table
    console.log('\n📋 Checking rust_servers table...');
    const [servers] = await connection.execute('SELECT id, nickname, guild_id FROM rust_servers');
    console.log(`📊 Found ${servers.length} servers:`);
    servers.forEach(server => {
      console.log(`  - ID: ${server.id}, Name: ${server.nickname}, Guild ID: ${server.guild_id}`);
    });
    
    // Check guilds table
    console.log('\n📋 Checking guilds table...');
    const [guilds] = await connection.execute('SELECT id, discord_id, name FROM guilds');
    console.log(`📊 Found ${guilds.length} guilds:`);
    guilds.forEach(guild => {
      console.log(`  - ID: ${guild.id}, Discord ID: ${guild.discord_id}, Name: ${guild.name}`);
    });
    
    // Check for invalid channel IDs
    console.log('\n🔍 Checking for invalid channel IDs...');
    const [invalidChannels] = await connection.execute(`
      SELECT cs.*, rs.nickname 
      FROM channel_settings cs 
      JOIN rust_servers rs ON cs.server_id = rs.id 
      WHERE cs.channel_id = '1400098668123783200'
    `);
    
    if (invalidChannels.length > 0) {
      console.log('❌ Found invalid channel ID (1400098668123783200):');
      invalidChannels.forEach(channel => {
        console.log(`  - Server: ${channel.nickname}, Type: ${channel.channel_type}, Channel ID: ${channel.channel_id}`);
      });
    } else {
      console.log('✅ No invalid channel IDs found');
    }
    
  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

diagnoseIssues(); 