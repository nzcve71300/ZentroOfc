const { Client, GatewayIntentBits } = require('discord.js');
const pool = require('./src/db');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

async function checkLinkedUsersRoles() {
  try {
    console.log('🔍 Checking linked users and their roles...\n');
    
    // Get all active linked players
    const [linkedPlayers] = await pool.query(`
      SELECT DISTINCT p.discord_id, p.ign, g.discord_id as guild_discord_id
      FROM players p
      JOIN guilds g ON p.guild_id = g.id
      WHERE p.discord_id IS NOT NULL 
      AND p.is_active = true
      ORDER BY g.discord_id, p.ign
    `);
    
    console.log(`Found ${linkedPlayers.length} active linked players to check\n`);
    
    for (const player of linkedPlayers) {
      try {
        const guild = client.guilds.cache.get(player.guild_discord_id);
        if (!guild) {
          console.log(`❌ Guild not found for Discord ID: ${player.guild_discord_id}`);
          continue;
        }
        
        const member = await guild.members.fetch(player.discord_id).catch(() => null);
        if (!member) {
          console.log(`❌ Member not found: ${player.ign} (${player.discord_id})`);
          continue;
        }
        
        // Get bot's role
        const botMember = guild.members.cache.get(client.user.id);
        const botRole = botMember ? botMember.roles.highest : null;
        
        // Get member's highest role
        const highestRole = member.roles.highest;
        const canManage = botRole && botRole.position > highestRole.position;
        const status = canManage ? '✅' : '❌';
        
        console.log(`${status} ${player.ign} (${player.discord_id})`);
        console.log(`   Server: ${guild.name}`);
        console.log(`   Highest Role: ${highestRole.name} (Position: ${highestRole.position})`);
        console.log(`   Bot Role: ${botRole ? botRole.name : 'None'} (Position: ${botRole ? botRole.position : 'N/A'})`);
        
        // Show all roles for this user
        const allRoles = Array.from(member.roles.cache.values())
          .filter(role => role.name !== '@everyone')
          .sort((a, b) => b.position - a.position);
        
        console.log(`   All Roles: ${allRoles.map(r => `${r.name}(${r.position})`).join(', ')}`);
        
        // Check if user has any role with "EMPEROR" in the name
        const emperorRoles = allRoles.filter(role => 
          role.name.toLowerCase().includes('emperor')
        );
        
        if (emperorRoles.length > 0) {
          console.log(`   🎯 EMPEROR Roles Found: ${emperorRoles.map(r => `${r.name}(${r.position})`).join(', ')}`);
        }
        
        console.log('');
        
      } catch (error) {
        console.error(`❌ Error checking ${player.ign}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error in checkLinkedUsersRoles:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

client.once('ready', () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);
  checkLinkedUsersRoles();
});

client.login(process.env.DISCORD_TOKEN); 