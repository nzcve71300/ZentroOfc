const mysql = require('mysql2/promise');
require('dotenv').config();

async function testChannelMessage() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('🧪 Testing channel message system...\n');

    // Get all channel settings
    const [channelSettings] = await connection.execute(`
      SELECT cs.*, rs.nickname, g.discord_id, g.name as guild_name
      FROM channel_settings cs
      JOIN rust_servers rs ON cs.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
    `);

    if (channelSettings.length === 0) {
      console.log('❌ No channel settings found!');
      console.log('Please set up channels using /channel-set first.');
      return;
    }

    console.log('✅ Found channel settings:');
    channelSettings.forEach(setting => {
      console.log(`  - ${setting.guild_name}: ${setting.nickname} -> ${setting.channel_type} (${setting.channel_id})`);
    });

    // Test the sendFeedEmbed function
    console.log('\n🧪 Testing sendFeedEmbed function...');
    
    // Import the function
    const { sendFeedEmbed } = require('./src/rcon');
    
    // Test with the first channel setting
    const testSetting = channelSettings[0];
    const testMessage = '🧪 **TEST MESSAGE** - This is a test message to verify channel configuration is working!';
    
    console.log(`Testing with: ${testSetting.guild_name} -> ${testSetting.nickname} -> ${testSetting.channel_type}`);
    console.log(`Message: ${testMessage}`);
    
    try {
      await sendFeedEmbed(null, testSetting.discord_id, testSetting.nickname, testSetting.channel_type, testMessage);
      console.log('✅ Test message sent successfully!');
    } catch (error) {
      console.log('❌ Test message failed:', error.message);
    }

    // Test player count update
    console.log('\n🧪 Testing player count update...');
    const { updatePlayerCountChannel } = require('./src/rcon');
    
    try {
      await updatePlayerCountChannel(null, testSetting.discord_id, testSetting.nickname, 25, 5);
      console.log('✅ Player count update test completed!');
    } catch (error) {
      console.log('❌ Player count update failed:', error.message);
    }

  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the test
testChannelMessage(); 