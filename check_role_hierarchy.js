const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

async function checkRoleHierarchy() {
  try {
    console.log('🔍 Checking role hierarchy...\n');
    
    // Get all guilds the bot is in
    const guilds = client.guilds.cache;
    
    for (const [guildId, guild] of guilds) {
      console.log(`📋 Server: ${guild.name} (${guildId})`);
      console.log(`👑 Owner: ${guild.ownerId}`);
      
      // Get bot's role in this guild
      const botMember = guild.members.cache.get(client.user.id);
      const botRole = botMember ? botMember.roles.highest : null;
      
      console.log(`🤖 Bot Role: ${botRole ? botRole.name : 'None'} (Position: ${botRole ? botRole.position : 'N/A'})`);
      console.log(`🔑 Bot Permissions: ${botMember ? botMember.permissions.toArray().join(', ') : 'None'}`);
      
      // Get all roles sorted by position (highest first)
      const roles = Array.from(guild.roles.cache.values())
        .sort((a, b) => b.position - a.position)
        .filter(role => !role.managed && role.name !== '@everyone');
      
      console.log('\n📊 Role Hierarchy (Top 10):');
      roles.slice(0, 10).forEach((role, index) => {
        const isBotRole = botRole && role.id === botRole.id;
        const marker = isBotRole ? '🤖' : '  ';
        console.log(`${marker} ${index + 1}. ${role.name} (Position: ${role.position})`);
      });
      
      if (roles.length > 10) {
        console.log(`   ... and ${roles.length - 10} more roles`);
      }
      
      // Check if bot can manage nicknames
      const canManageNicknames = botMember && botMember.permissions.has('ManageNicknames');
      console.log(`\n✅ Can Manage Nicknames: ${canManageNicknames ? 'Yes' : 'No'}`);
      
      // Show some example users and their highest roles
      console.log('\n👥 Sample Users and Their Highest Roles:');
      const members = guild.members.cache
        .filter(member => !member.user.bot)
        .slice(0, 5);
      
      members.forEach(member => {
        const highestRole = member.roles.highest;
        const canManage = botRole && botRole.position > highestRole.position;
        const status = canManage ? '✅' : '❌';
        console.log(`${status} ${member.user.username}: ${highestRole.name} (Position: ${highestRole.position})`);
      });
      
      console.log('\n' + '='.repeat(50) + '\n');
    }
    
  } catch (error) {
    console.error('❌ Error checking role hierarchy:', error);
  } finally {
    process.exit(0);
  }
}

client.once('ready', () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);
  checkRoleHierarchy();
});

client.login(process.env.DISCORD_TOKEN); 