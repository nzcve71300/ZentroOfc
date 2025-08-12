const { Client, GatewayIntentBits } = require('discord.js');
const pool = require('./src/db');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

async function checkValidDiscordUsers() {
  try {
    console.log('🔍 Checking which Discord users are still valid...\n');
    
    // Get all active linked players
    const [linkedPlayers] = await pool.query(`
      SELECT DISTINCT p.discord_id, p.ign, g.discord_id as guild_discord_id
      FROM players p
      JOIN guilds g ON p.guild_id = g.id
      WHERE p.discord_id IS NOT NULL 
      AND p.is_active = true
      ORDER BY g.discord_id, p.ign
    `);
    
    console.log(`Found ${linkedPlayers.length} active linked players in database\n`);
    
    let validUsers = 0;
    let invalidUsers = 0;
    let validUsersList = [];
    
    for (const player of linkedPlayers) {
      try {
        const guild = client.guilds.cache.get(player.guild_discord_id);
        if (!guild) {
          console.log(`❌ Guild not found for Discord ID: ${player.guild_discord_id}`);
          invalidUsers++;
          continue;
        }
        
        // Try to fetch the user
        const member = await guild.members.fetch(player.discord_id).catch(err => {
          console.log(`❌ ${player.ign}: ${err.message} (${player.discord_id})`);
          return null;
        });
        
        if (member) {
          console.log(`✅ ${player.ign}: Valid user in ${guild.name}`);
          validUsers++;
          validUsersList.push({
            discord_id: player.discord_id,
            ign: player.ign,
            guild_id: player.guild_discord_id,
            guild_name: guild.name,
            member: member
          });
        } else {
          invalidUsers++;
        }
        
      } catch (error) {
        console.error(`❌ Error checking ${player.ign}:`, error.message);
        invalidUsers++;
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Valid users: ${validUsers}`);
    console.log(`❌ Invalid users: ${invalidUsers}`);
    console.log(`📈 Total: ${linkedPlayers.length}`);
    
    if (validUsers > 0) {
      console.log('\n🎯 Valid users that can be updated:');
      validUsersList.forEach(user => {
        console.log(`   • ${user.ign} (${user.discord_id}) - ${user.guild_name}`);
      });
      
      // Test nickname change on first valid user
      if (validUsersList.length > 0) {
        console.log('\n🧪 Testing nickname change on first valid user...');
        const testUser = validUsersList[0];
        const member = testUser.member;
        
        console.log(`Testing with: ${testUser.ign} (${testUser.discord_id})`);
        console.log(`Current nickname: ${member.nickname || 'None'}`);
        console.log(`Can manage: ${member.manageable ? 'Yes' : 'No'}`);
        
        try {
          const newNickname = `${testUser.ign} 🔗`.substring(0, 28);
          await member.setNickname(newNickname);
          console.log(`✅ Successfully set nickname to: ${newNickname}`);
          
          // Change it back after 3 seconds
          setTimeout(async () => {
            try {
              await member.setNickname(member.user.username);
              console.log(`✅ Changed nickname back to: ${member.user.username}`);
            } catch (err) {
              console.log(`❌ Failed to change nickname back: ${err.message}`);
            }
          }, 3000);
          
        } catch (error) {
          console.log(`❌ Failed to set nickname: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error in checkValidDiscordUsers:', error);
  } finally {
    setTimeout(() => {
      pool.end();
      process.exit(0);
    }, 5000);
  }
}

client.once('ready', () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);
  checkValidDiscordUsers();
});

client.login(process.env.DISCORD_TOKEN); 