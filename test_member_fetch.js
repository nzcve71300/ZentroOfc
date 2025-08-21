const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

console.log('🔍 TESTING MEMBER FETCHING');
console.log('==========================\n');

async function testMemberFetch() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences
    ],
    partials: ['GuildMember']
  });

  try {
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Connected to Discord');
    
    await new Promise(resolve => {
      client.once('ready', () => {
        console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
        console.log(`📋 Cached ${client.guilds.cache.size} guilds\n`);
        resolve();
      });
    });

    // Test with a specific guild and user
    const testGuildId = '1406308741628039228'; // Atlantis 18x
    const testUserId = '1252993829007528200'; // nzcve7130
    
    const guild = client.guilds.cache.get(testGuildId);
    if (!guild) {
      console.log(`❌ Guild ${testGuildId} not found`);
      return;
    }
    
    console.log(`🏠 Testing guild: ${guild.name}`);
    console.log(`👤 Testing user: ${testUserId}`);
    
    // Check if user is in cache
    const cachedMember = guild.members.cache.get(testUserId);
    if (cachedMember) {
      console.log('✅ User found in cache');
      console.log(`   Username: ${cachedMember.user.tag}`);
      console.log(`   Roles: ${cachedMember.roles.cache.size} roles`);
    } else {
      console.log('❌ User not in cache, attempting to fetch...');
    }
    
    // Try to fetch the member
    try {
      const member = await guild.members.fetch(testUserId);
      console.log('✅ Member fetched successfully');
      console.log(`   Username: ${member.user.tag}`);
      console.log(`   Roles: ${member.roles.cache.size} roles`);
      console.log(`   Roles object: ${typeof member.roles}`);
      console.log(`   Roles.cache: ${typeof member.roles.cache}`);
      
      // Test role operations
      const testRole = guild.roles.cache.find(role => role.name === 'ZentroLinked');
      if (testRole) {
        console.log(`   Has ZentroLinked role: ${member.roles.cache.has(testRole.id)}`);
      }
      
    } catch (fetchError) {
      console.log(`❌ Failed to fetch member: ${fetchError.message}`);
      console.log(`   Error code: ${fetchError.code}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.destroy();
    process.exit(0);
  }
}

testMemberFetch();
