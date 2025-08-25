const { Client, GatewayIntentBits } = require('discord.js');
const pool = require('./src/db');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

async function fixNicknameDisplay() {
  try {
    const guildId = '1403300500719538227';
    const targetUserId = '1241672654193426434'; // Jady's Discord ID
    
    console.log(`🔍 Fixing nickname display for guild: ${guildId}`);
    console.log(`👤 Target user: ${targetUserId}`);
    
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.log('❌ Guild not found!');
      return;
    }
    
    // Get user's linked IGN from database
    const [playerData] = await pool.query(`
      SELECT p.ign, p.linked_at
      FROM players p
      JOIN guilds g ON p.guild_id = g.id
      WHERE g.discord_id = ? 
      AND p.discord_id = ?
      AND p.is_active = true
    `, [guildId, targetUserId]);
    
    if (playerData.length === 0) {
      console.log('❌ No linked player data found for this user');
      return;
    }
    
    const ign = playerData[0].ign;
    console.log(`📋 User's IGN: ${ign}`);
    
    // Fetch the member
    const member = await guild.members.fetch(targetUserId);
    console.log(`👤 Member: ${member.user.username}#${member.user.discriminator}`);
    console.log(`📛 Current nickname: ${member.nickname || 'None'}`);
    console.log(`🏷️ Display name: ${member.displayName}`);
    
    // Check all roles and their positions
    console.log(`\n📊 Role analysis:`);
    member.roles.cache.forEach(role => {
      console.log(`   • ${role.name} (ID: ${role.id}, Position: ${role.position})`);
    });
    
    // Check if any role has a higher priority than the bot's role
    const botMember = guild.members.cache.get(client.user.id);
    const botHighestPosition = botMember.roles.highest.position;
    
    console.log(`\n🤖 Bot's highest role position: ${botHighestPosition}`);
    
    const highPriorityRoles = member.roles.cache.filter(role => role.position >= botHighestPosition);
    if (highPriorityRoles.size > 0) {
      console.log(`⚠️ User has roles with higher/equal priority to bot:`);
      highPriorityRoles.forEach(role => {
        console.log(`   • ${role.name} (Position: ${role.position})`);
      });
    }
    
    // Try to force refresh the nickname
    console.log(`\n🔄 Attempting to force refresh nickname...`);
    
    try {
      // First, remove the nickname completely
      console.log(`   Step 1: Removing current nickname...`);
      await member.setNickname(null);
      console.log(`   ✅ Nickname removed`);
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Then set it again
      console.log(`   Step 2: Setting nickname to "${ign}"...`);
      await member.setNickname(ign);
      console.log(`   ✅ Nickname set to "${ign}"`);
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Fetch the member again to verify
      const refreshedMember = await guild.members.fetch(targetUserId);
      console.log(`\n📋 After refresh:`);
      console.log(`   Nickname: ${refreshedMember.nickname || 'None'}`);
      console.log(`   Display name: ${refreshedMember.displayName}`);
      
      if (refreshedMember.nickname === ign) {
        console.log(`✅ Nickname successfully set to "${ign}"`);
        console.log(`💡 If it's still not showing in chat, try:`);
        console.log(`   1. User refreshes their Discord client`);
        console.log(`   2. User rejoins the server`);
        console.log(`   3. Check if any roles have "Display role members separately" enabled`);
      } else {
        console.log(`❌ Nickname still not set correctly`);
      }
      
    } catch (nicknameError) {
      console.log(`❌ Error setting nickname: ${nicknameError.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error in fixNicknameDisplay:', error);
  }
}

client.once('ready', async () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);
  console.log(`🏛️ Connected to ${client.guilds.cache.size} guilds`);
  
  await fixNicknameDisplay();
  
  console.log('\n👋 Disconnecting...');
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
