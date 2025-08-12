const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

async function testSimpleNickname() {
  try {
    console.log('🧪 Testing simple nickname change...\n');
    
    // Test with a specific user (replace with an actual Discord ID from your server)
    const testUserId = '1231311936474583300'; // x2sweat11 from your list
    const testGuildId = '1342235198175182921'; // EMPEROR 3X server
    
    const guild = client.guilds.cache.get(testGuildId);
    if (!guild) {
      console.log('❌ Guild not found');
      return;
    }
    
    console.log(`📋 Testing on server: ${guild.name}`);
    
    // Get bot member
    const botMember = guild.members.cache.get(client.user.id);
    console.log(`🤖 Bot: ${botMember ? botMember.user.tag : 'Not found'}`);
    console.log(`🔑 Bot permissions: ${botMember ? botMember.permissions.toArray().join(', ') : 'None'}`);
    
    // Try to fetch the test user
    console.log(`\n👤 Fetching user: ${testUserId}`);
    const member = await guild.members.fetch(testUserId).catch(err => {
      console.log(`❌ Failed to fetch member: ${err.message}`);
      return null;
    });
    
    if (!member) {
      console.log('❌ Member not found or could not be fetched');
      return;
    }
    
    console.log(`✅ Member found: ${member.user.tag}`);
    console.log(`📝 Current nickname: ${member.nickname || 'None'}`);
    console.log(`🎭 Roles: ${member.roles.cache.map(r => r.name).join(', ')}`);
    
    // Check if bot can manage this member
    console.log(`\n🔍 Checking if bot can manage this member...`);
    console.log(`   Bot role position: ${botMember ? botMember.roles.highest.position : 'N/A'}`);
    console.log(`   Member highest role position: ${member.roles.highest.position}`);
    console.log(`   Can manage: ${member.manageable ? 'Yes' : 'No'}`);
    
    // Try to set nickname
    console.log(`\n🔄 Attempting to set nickname...`);
    try {
      const newNickname = 'TestNickname 🔗';
      await member.setNickname(newNickname);
      console.log(`✅ Successfully set nickname to: ${newNickname}`);
      
      // Wait a moment then change it back
      setTimeout(async () => {
        try {
          await member.setNickname(member.user.username);
          console.log(`✅ Changed nickname back to: ${member.user.username}`);
        } catch (err) {
          console.log(`❌ Failed to change nickname back: ${err.message}`);
        }
      }, 2000);
      
    } catch (error) {
      console.log(`❌ Failed to set nickname: ${error.message}`);
      console.log(`   Error code: ${error.code}`);
      console.log(`   Error type: ${error.constructor.name}`);
    }
    
  } catch (error) {
    console.error('❌ Error in test:', error);
  } finally {
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  }
}

client.once('ready', () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);
  testSimpleNickname();
});

client.login(process.env.DISCORD_TOKEN); 