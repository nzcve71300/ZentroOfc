const mysql = require('mysql2/promise');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

async function diagnoseChannelIssues() {
  console.log('🔍 Comprehensive Channel Issue Diagnosis\n');
  
  // Test 1: Database Connection
  console.log('1️⃣ Testing Database Connection...');
  let dbConnection;
  try {
    dbConnection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    console.log('✅ Database connection successful');
    
    // Check channel settings
    const [channelSettings] = await dbConnection.execute('SELECT * FROM channel_settings ORDER BY channel_type');
    console.log(`📋 Found ${channelSettings.length} channel settings:`);
    channelSettings.forEach(setting => {
      console.log(`   - ${setting.channel_type}: ${setting.channel_id || 'NULL'} (Server: ${setting.server_id})`);
    });
    
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
    return;
  }
  
  // Test 2: Discord Bot Connection
  console.log('\n2️⃣ Testing Discord Bot Connection...');
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });
  
  try {
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Discord bot connection successful');
    
    // Get guilds
    const guilds = client.guilds.cache;
    console.log(`📋 Connected to ${guilds.size} guild(s):`);
    guilds.forEach(guild => {
      console.log(`   - ${guild.name} (${guild.id})`);
    });
    
    // Test 3: Channel Access
    console.log('\n3️⃣ Testing Channel Access...');
    const testChannelIds = [
      '1400098489311953007', // playercount
      '1396872848748052581', // playerfeed
      '1400098668123783268', // adminfeed
      '1397975202184429618'  // notefeed
    ];
    
    for (const channelId of testChannelIds) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (channel) {
          console.log(`✅ Channel ${channelId}: Found #${channel.name}`);
          
          // Check permissions
          const permissions = channel.permissionsFor(client.user);
          console.log(`   - View Channel: ${permissions.has('ViewChannel') ? '✅' : '❌'}`);
          console.log(`   - Send Messages: ${permissions.has('SendMessages') ? '✅' : '❌'}`);
          console.log(`   - Embed Links: ${permissions.has('EmbedLinks') ? '✅' : '❌'}`);
          
        } else {
          console.log(`❌ Channel ${channelId}: Not found`);
        }
      } catch (error) {
        console.log(`❌ Channel ${channelId}: Error - ${error.message}`);
      }
    }
    
    // Test 4: Try sending a test message
    console.log('\n4️⃣ Testing Message Sending...');
    try {
      const testChannel = await client.channels.fetch('1400098668123783268'); // adminfeed
      if (testChannel && testChannel.isTextBased()) {
        const message = await testChannel.send('🧪 Test message from diagnostic script');
        console.log('✅ Test message sent successfully');
        // Clean up after 5 seconds
        setTimeout(() => {
          message.delete().catch(() => {});
        }, 5000);
      } else {
        console.log('❌ Cannot send test message - channel not accessible');
      }
    } catch (error) {
      console.log('❌ Failed to send test message:', error.message);
    }
    
  } catch (error) {
    console.log('❌ Discord bot connection failed:', error.message);
  } finally {
    await client.destroy();
  }
  
  // Test 5: Check RCON functions
  console.log('\n5️⃣ Checking RCON Functions...');
  try {
    const { sendFeedEmbed, updatePlayerCountChannel } = require('./src/rcon/index.js');
    console.log('✅ RCON functions imported successfully');
    console.log('   - sendFeedEmbed:', typeof sendFeedEmbed);
    console.log('   - updatePlayerCountChannel:', typeof updatePlayerCountChannel);
  } catch (error) {
    console.log('❌ RCON functions import failed:', error.message);
  }
  
  // Cleanup
  if (dbConnection) {
    await dbConnection.end();
  }
  
  console.log('\n📋 Summary:');
  console.log('If all tests pass but channels still don\'t work, the issue might be:');
  console.log('1. Bot not restarted after database changes');
  console.log('2. RCON events not triggering properly');
  console.log('3. Server configuration issues');
  console.log('4. Environment variables not loaded correctly');
}

diagnoseChannelIssues(); 