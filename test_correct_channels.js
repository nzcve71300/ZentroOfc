const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

// Correct channel IDs
const channelIds = {
  playercount: '1400098489311953007',
  playerfeed: '1396872848748052581', 
  adminfeed: '1400098668123783268',
  notefeed: '1397975202184429618'
};

async function testChannels() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  try {
    console.log('🔍 Testing channel access with correct IDs...');
    
    await client.login(process.env.DISCORD_TOKEN);
    
    // Get the guild (server)
    const guild = client.guilds.cache.first();
    if (!guild) {
      console.log('❌ No guild found');
      return;
    }
    
    console.log(`✅ Connected to guild: ${guild.name}`);
    
    // Test each channel
    for (const [channelType, channelId] of Object.entries(channelIds)) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (channel) {
          console.log(`✅ ${channelType}: Found channel #${channel.name} (${channelId})`);
          
          // Test if we can send a message (optional)
          if (channel.isTextBased()) {
            console.log(`   - Channel is text-based and can receive messages`);
          } else {
            console.log(`   - Channel is not text-based`);
          }
        } else {
          console.log(`❌ ${channelType}: Channel not found (${channelId})`);
        }
      } catch (error) {
        console.log(`❌ ${channelType}: Error accessing channel (${channelId}) - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.destroy();
  }
}

testChannels(); 