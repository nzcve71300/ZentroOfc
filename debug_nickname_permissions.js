const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const pool = require('./src/db');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

async function debugNicknamePermissions() {
  try {
    const guildId = '1403300500719538227';
    console.log(`🔍 Debugging nickname permissions for guild: ${guildId}`);
    
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.log('❌ Guild not found!');
      return;
    }
    
    console.log(`\n🏛️ Guild: ${guild.name} (${guild.id})`);
    
    // Check bot's permissions
    const botMember = guild.members.cache.get(client.user.id);
    if (!botMember) {
      console.log('❌ Bot member not found in guild!');
      return;
    }
    
    console.log(`\n🤖 Bot permissions in ${guild.name}:`);
    console.log(`   Manage Nicknames: ${botMember.permissions.has(PermissionFlagsBits.ManageNicknames) ? '✅ YES' : '❌ NO'}`);
    console.log(`   Manage Roles: ${botMember.permissions.has(PermissionFlagsBits.ManageRoles) ? '✅ YES' : '❌ NO'}`);
    console.log(`   Administrator: ${botMember.permissions.has(PermissionFlagsBits.Administrator) ? '✅ YES' : '❌ NO'}`);
    
    // Check bot's role hierarchy
    console.log(`\n📊 Bot role hierarchy:`);
    console.log(`   Bot's highest role: ${botMember.roles.highest.name} (${botMember.roles.highest.id})`);
    console.log(`   Bot's position: ${botMember.roles.highest.position}`);
    
    // Get recent linked players
    const [linkedPlayers] = await pool.query(`
      SELECT p.discord_id, p.ign, p.linked_at, g.name as guild_name
      FROM players p
      JOIN guilds g ON p.guild_id = g.id
      WHERE g.discord_id = ? 
      AND p.discord_id IS NOT NULL 
      AND p.is_active = true
      ORDER BY p.linked_at DESC
      LIMIT 5
    `, [guildId]);
    
    console.log(`\n👥 Recent linked players in ${guild.name}:`);
    if (linkedPlayers.length === 0) {
      console.log('   No linked players found');
    } else {
      for (const player of linkedPlayers) {
        try {
          const member = await guild.members.fetch(player.discord_id);
          console.log(`   • ${member.user.username} (${player.discord_id})`);
          console.log(`     IGN: ${player.ign}`);
          console.log(`     Current nickname: ${member.nickname || 'None'}`);
          console.log(`     Linked at: ${player.linked_at}`);
          console.log(`     Manageable: ${member.manageable ? '✅ YES' : '❌ NO'}`);
          console.log(`     Is owner: ${guild.ownerId === player.discord_id ? '✅ YES' : '❌ NO'}`);
          console.log(`     Highest role: ${member.roles.highest.name} (position: ${member.roles.highest.position})`);
          console.log(`     Can bot manage: ${member.roles.highest.position < botMember.roles.highest.position ? '✅ YES' : '❌ NO'}`);
        } catch (memberError) {
          console.log(`   • ${player.discord_id} - Could not fetch member: ${memberError.message}`);
        }
      }
    }
    
    // Test nickname setting on a recent player
    if (linkedPlayers.length > 0) {
      const testPlayer = linkedPlayers[0];
      console.log(`\n🧪 Testing nickname setting for: ${testPlayer.ign} (${testPlayer.discord_id})`);
      
      try {
        const member = await guild.members.fetch(testPlayer.discord_id);
        
        if (!member.manageable) {
          console.log('❌ Member is not manageable by bot');
          console.log(`   Reason: Bot's highest role (${botMember.roles.highest.position}) <= Member's highest role (${member.roles.highest.position})`);
        } else if (guild.ownerId === testPlayer.discord_id) {
          console.log('❌ Cannot change server owner nickname');
        } else {
          console.log('✅ Member is manageable - attempting to set nickname...');
          
          const currentNickname = member.nickname;
          const newNickname = testPlayer.ign;
          
          if (currentNickname === newNickname) {
            console.log('✅ Nickname is already set correctly');
          } else {
            console.log(`🔄 Setting nickname from "${currentNickname || 'None'}" to "${newNickname}"...`);
            await member.setNickname(newNickname);
            console.log('✅ Nickname set successfully!');
          }
        }
      } catch (testError) {
        console.log(`❌ Error testing nickname: ${testError.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error in debugNicknamePermissions:', error);
  }
}

client.once('ready', async () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);
  console.log(`🏛️ Connected to ${client.guilds.cache.size} guilds`);
  
  await debugNicknamePermissions();
  
  console.log('\n👋 Disconnecting...');
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
