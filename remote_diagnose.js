const mysql = require('mysql2/promise');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

async function remoteDiagnose() {
  console.log('🔍 Remote Server Channel Diagnosis\n');
  
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
    
    // Check if any channels are NULL
    const nullChannels = channelSettings.filter(s => !s.channel_id);
    if (nullChannels.length > 0) {
      console.log('\n⚠️  Found channels with NULL IDs:');
      nullChannels.forEach(channel => {
        console.log(`   - ${channel.channel_type} (Server: ${channel.server_id})`);
      });
      console.log('\n💡 You need to use /channel-set to configure these channels');
    }
    
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
    console.log('💡 Make sure your database server is running on the remote machine');
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
    
  } catch (error) {
    console.log('❌ Discord bot connection failed:', error.message);
  } finally {
    await client.destroy();
  }
  
  // Cleanup
  if (dbConnection) {
    await dbConnection.end();
  }
  
  console.log('\n📋 Next Steps:');
  console.log('1. If channels have NULL IDs, use /channel-set to configure them');
  console.log('2. If bot permissions are missing, check bot role permissions in Discord');
  console.log('3. Restart your bot after making any changes');
  console.log('4. Test with /test-message command');
}

remoteDiagnose(); 