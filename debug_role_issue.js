const { Client, GatewayIntentBits } = require('discord.js');
const pool = require('./src/db');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

async function debugRoleIssue() {
  try {
    console.log('🔍 Debugging role hierarchy issue...\n');
    
    // Test with first few users
    const [linkedPlayers] = await pool.query(`
      SELECT DISTINCT p.discord_id, p.ign, g.discord_id as guild_discord_id
      FROM players p
      JOIN guilds g ON p.guild_id = g.id
      WHERE p.discord_id IS NOT NULL 
      AND p.is_active = true
      ORDER BY g.discord_id, p.ign
      LIMIT 5
    `);
    
    for (const player of linkedPlayers) {
      try {
        console.log(`\n👤 Analyzing: ${player.ign} (${player.discord_id})`);
        
        const guild = client.guilds.cache.get(player.guild_discord_id);
        if (!guild) {
          console.log(`   ❌ Guild not found`);
          continue;
        }
        
        // Get bot member
        const botMember = guild.members.cache.get(client.user.id);
        const botRole = botMember ? botMember.roles.highest : null;
        
        console.log(`   🤖 Bot role: ${botRole ? botRole.name : 'None'} (Position: ${botRole ? botRole.position : 'N/A'})`);
        
        // Fetch the user
        const member = await guild.members.fetch(player.discord_id).catch(err => {
          console.log(`   ❌ Failed to fetch member: ${err.message}`);
          return null;
        });
        
        if (!member) {
          console.log(`   ❌ Member not found`);
          continue;
        }
        
        // Get member's highest role
        const highestRole = member.roles.highest;
        console.log(`   👤 Member highest role: ${highestRole.name} (Position: ${highestRole.position})`);
        
        // Check if bot can manage this member
        console.log(`   🔍 Can manage: ${member.manageable ? 'Yes' : 'No'}`);
        
        // Show all roles for this user
        const allRoles = Array.from(member.roles.cache.values())
          .filter(role => role.name !== '@everyone')
          .sort((a, b) => b.position - a.position);
        
        console.log(`   🎭 All roles: ${allRoles.map(r => `${r.name}(${r.position})`).join(', ')}`);
        
        // Check which roles are higher than bot
        const blockingRoles = allRoles.filter(role => 
          botRole && role.position >= botRole.position
        );
        
        if (blockingRoles.length > 0) {
          console.log(`   🚫 Blocking roles (higher than bot): ${blockingRoles.map(r => `${r.name}(${r.position})`).join(', ')}`);
        } else {
          console.log(`   ✅ No blocking roles found`);
        }
        
        // Check if user has any role with "EMPEROR" in the name
        const emperorRoles = allRoles.filter(role => 
          role.name.toLowerCase().includes('emperor')
        );
        
        if (emperorRoles.length > 0) {
          console.log(`   🎯 EMPEROR roles: ${emperorRoles.map(r => `${r.name}(${r.position})`).join(', ')}`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error analyzing ${player.ign}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error in debugRoleIssue:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

client.once('ready', () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);
  debugRoleIssue();
});

client.login(process.env.DISCORD_TOKEN); 