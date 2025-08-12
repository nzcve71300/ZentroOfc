const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

async function checkSpecificRolePositions() {
  try {
    console.log('🔍 Checking specific role positions...\n');
    
    // Get all guilds the bot is in
    const guilds = client.guilds.cache;
    
    for (const [guildId, guild] of guilds) {
      console.log(`📋 Server: ${guild.name} (${guildId})`);
      
      // Get bot's role in this guild
      const botMember = guild.members.cache.get(client.user.id);
      const botRole = botMember ? botMember.roles.highest : null;
      
      console.log(`🤖 Bot Role: ${botRole ? botRole.name : 'None'} (Position: ${botRole ? botRole.position : 'N/A'})`);
      
      // Get all roles sorted by position (highest first)
      const roles = Array.from(guild.roles.cache.values())
        .sort((a, b) => b.position - a.position)
        .filter(role => !role.managed && role.name !== '@everyone');
      
      console.log('\n📊 ALL Roles by Position:');
      roles.forEach((role, index) => {
        const isBotRole = botRole && role.id === botRole.id;
        const marker = isBotRole ? '🤖' : '  ';
        const canManage = botRole && botRole.position > role.position;
        const status = canManage ? '✅' : '❌';
        console.log(`${marker} ${index + 1}. ${status} ${role.name} (Position: ${role.position})`);
      });
      
      // Find roles that are blocking the bot
      const blockingRoles = roles.filter(role => 
        botRole && botRole.position <= role.position && role.name !== botRole.name
      );
      
      console.log('\n🚫 Roles Blocking Bot (Higher than bot):');
      if (blockingRoles.length > 0) {
        blockingRoles.forEach(role => {
          console.log(`   ❌ ${role.name} (Position: ${role.position})`);
        });
      } else {
        console.log('   ✅ No blocking roles found!');
      }
      
      // Check specific users with EMPEROR'S role
      console.log('\n👥 Users with EMPEROR\'S role:');
      const emperorMembers = Array.from(guild.members.cache.values())
        .filter(member => 
          !member.user.bot && 
          member.roles.cache.some(role => role.name === "EMPEROR'S")
        );
      
      if (emperorMembers.length > 0) {
        emperorMembers.forEach(member => {
          const highestRole = member.roles.highest;
          const canManage = botRole && botRole.position > highestRole.position;
          const status = canManage ? '✅' : '❌';
          console.log(`   ${status} ${member.user.username}: ${highestRole.name} (Position: ${highestRole.position})`);
        });
      } else {
        console.log('   No users found with EMPEROR\'S role');
      }
      
      console.log('\n' + '='.repeat(60) + '\n');
    }
    
  } catch (error) {
    console.error('❌ Error checking role positions:', error);
  } finally {
    process.exit(0);
  }
}

client.once('ready', () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);
  checkSpecificRolePositions();
});

client.login(process.env.DISCORD_TOKEN); 