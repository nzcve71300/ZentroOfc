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

async function assignZentroLinkedRole() {
  try {
    console.log('🔍 Starting ZentroLinked role assignment...');
    
    // Get all unique Discord IDs that are actively linked
    const [linkedPlayers] = await pool.query(`
      SELECT DISTINCT p.discord_id, g.discord_id as guild_discord_id, g.name as guild_name
      FROM players p
      JOIN guilds g ON p.guild_id = g.id
      WHERE p.discord_id IS NOT NULL 
      AND p.is_active = true
      ORDER BY g.discord_id, p.discord_id
    `);

    console.log(`📋 Found ${linkedPlayers.length} unique linked players across all guilds`);

    const guildGroups = {};
    linkedPlayers.forEach(player => {
      if (!guildGroups[player.guild_discord_id]) {
        guildGroups[player.guild_discord_id] = {
          guildName: player.guild_name,
          players: []
        };
      }
      guildGroups[player.guild_discord_id].players.push(player.discord_id);
    });

    console.log(`🏛️ Processing ${Object.keys(guildGroups).length} guilds...`);

    for (const [guildId, guildData] of Object.entries(guildGroups)) {
      try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
          console.log(`❌ Guild not found: ${guildData.guildName} (${guildId})`);
          continue;
        }

        console.log(`\n🏛️ Processing guild: ${guild.name} (${guildId})`);
        console.log(`👥 Found ${guildData.players.length} linked players`);

        // Create ZentroLinked role if it doesn't exist
        let zentroLinkedRole = guild.roles.cache.find(role => role.name === 'ZentroLinked');
        
        if (!zentroLinkedRole) {
          console.log(`🔧 Creating ZentroLinked role for ${guild.name}...`);
          zentroLinkedRole = await guild.roles.create({
            name: 'ZentroLinked',
            color: '#00ff00', // Green color
            reason: 'Auto-created role for linked players'
          });
          console.log(`✅ Created ZentroLinked role with ID: ${zentroLinkedRole.id}`);
        } else {
          console.log(`✅ ZentroLinked role already exists with ID: ${zentroLinkedRole.id}`);
        }

        // Assign role to all linked players
        let assignedCount = 0;
        let alreadyAssignedCount = 0;
        let errorCount = 0;

        for (const discordId of guildData.players) {
          try {
            const member = await guild.members.fetch(discordId);
            
            if (member.roles.cache.has(zentroLinkedRole.id)) {
              alreadyAssignedCount++;
            } else {
              await member.roles.add(zentroLinkedRole);
              assignedCount++;
              console.log(`✅ Assigned role to: ${member.user.username} (${discordId})`);
            }
          } catch (memberError) {
            errorCount++;
            console.log(`❌ Could not assign role to ${discordId}: ${memberError.message}`);
          }
        }

        console.log(`📊 Guild ${guild.name} summary:`);
        console.log(`   ✅ Newly assigned: ${assignedCount}`);
        console.log(`   ⚠️ Already assigned: ${alreadyAssignedCount}`);
        console.log(`   ❌ Errors: ${errorCount}`);

      } catch (guildError) {
        console.log(`❌ Error processing guild ${guildId}: ${guildError.message}`);
      }
    }

    console.log('\n🎉 ZentroLinked role assignment completed!');

  } catch (error) {
    console.error('❌ Error in assignZentroLinkedRole:', error);
  }
}

client.once('ready', async () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);
  console.log(`🏛️ Connected to ${client.guilds.cache.size} guilds`);
  
  await assignZentroLinkedRole();
  
  console.log('👋 Disconnecting...');
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
