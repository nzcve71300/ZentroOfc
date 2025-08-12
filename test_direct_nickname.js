const { Client, GatewayIntentBits } = require('discord.js');
const pool = require('./src/db');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

async function testDirectNickname() {
  try {
    console.log('🧪 Testing direct nickname setting...\n');
    
    // Test with just one user
    const [linkedPlayers] = await pool.query(`
      SELECT DISTINCT p.discord_id, p.ign, g.discord_id as guild_discord_id
      FROM players p
      JOIN guilds g ON p.guild_id = g.id
      WHERE p.discord_id IS NOT NULL 
      AND p.is_active = true
      ORDER BY g.discord_id, p.ign
      LIMIT 1
    `);
    
    if (linkedPlayers.length === 0) {
      console.log('❌ No linked players found');
      return;
    }
    
    const player = linkedPlayers[0];
    console.log(`🧪 Testing with: ${player.ign} (${player.discord_id})`);
    
    const guild = client.guilds.cache.get(player.guild_discord_id);
    if (!guild) {
      console.log('❌ Guild not found');
      return;
    }
    
    console.log(`📋 Server: ${guild.name}`);
    
    // Get bot member
    const botMember = guild.members.cache.get(client.user.id);
    console.log(`🤖 Bot: ${botMember ? botMember.user.tag : 'Not found'}`);
    console.log(`🔑 Bot permissions: ${botMember ? botMember.permissions.toArray().join(', ') : 'None'}`);
    
    // Try to fetch the user
    console.log(`\n👤 Fetching user: ${player.discord_id}`);
    const member = await guild.members.fetch(player.discord_id).catch(err => {
      console.log(`❌ Failed to fetch member: ${err.message}`);
      return null;
    });
    
    if (!member) {
      console.log('❌ Member not found or could not be fetched');
      return;
    }
    
    console.log(`✅ Member found: ${member.user.tag}`);
    console.log(`📝 Current nickname: ${member.nickname || 'None'}`);
    
    // Try to set nickname directly without checking manageable
    console.log(`\n🔄 Attempting to set nickname directly...`);
    try {
      const newNickname = `${player.ign} 🔗`.substring(0, 28);
      console.log(`🎯 Setting nickname to: ${newNickname}`);
      
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
      }, 3000);
      
    } catch (error) {
      console.log(`❌ Failed to set nickname: ${error.message}`);
      console.log(`   Error code: ${error.code}`);
      console.log(`   Error type: ${error.constructor.name}`);
      
      // Try to get more details about the error
      if (error.code) {
        console.log(`   Discord error code: ${error.code}`);
        switch(error.code) {
          case 50013:
            console.log(`   💡 This means "Missing Permissions" - the bot doesn't have permission to manage this user`);
            break;
          case 50001:
            console.log(`   💡 This means "Missing Access" - the bot can't access this user`);
            break;
          case 10007:
            console.log(`   💡 This means "Unknown User" - the user doesn't exist`);
            break;
          default:
            console.log(`   💡 Unknown Discord error code`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error in testDirectNickname:', error);
  } finally {
    setTimeout(() => {
      pool.end();
      process.exit(0);
    }, 5000);
  }
}

client.once('ready', () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);
  testDirectNickname();
});

client.login(process.env.DISCORD_TOKEN); 