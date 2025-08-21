const { Client, GatewayIntentBits } = require('discord.js');
const pool = require('./src/db');
require('dotenv').config();

console.log('🚀 DEPLOYING ZENTROLINKED ROLE TO EXISTING PLAYERS');
console.log('==================================================\n');

async function deployZentroLinkedRole() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences
    ]
  });

  try {
    // Check if token exists
    if (!process.env.DISCORD_TOKEN) {
      console.log('❌ DISCORD_TOKEN not found in environment variables');
      console.log('💡 Make sure you have a .env file with DISCORD_TOKEN=your_token_here');
      console.log('💡 Or export the token: export DISCORD_TOKEN=your_token_here');
      return;
    }
    
    console.log('🔑 Token found, attempting to connect...');
    
    // Connect to Discord
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Connected to Discord');
    
    // Wait for the client to be ready and cache guilds
    await new Promise(resolve => {
      client.once('ready', () => {
        console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
        console.log(`📋 Cached ${client.guilds.cache.size} guilds\n`);
        resolve();
      });
    });

    // Get all active linked players from database
    const [linkedPlayers] = await pool.query(`
      SELECT DISTINCT 
        p.discord_id,
        p.ign,
        g.discord_id as guild_discord_id,
        g.name as guild_name
      FROM players p
      JOIN guilds g ON p.guild_id = g.id
      WHERE p.discord_id IS NOT NULL 
      AND p.is_active = true
      ORDER BY g.name, p.ign
    `);

    console.log(`📋 Found ${linkedPlayers.length} active linked players across all servers\n`);

    if (linkedPlayers.length === 0) {
      console.log('❌ No linked players found. Nothing to do.');
      return;
    }

    // Group players by guild
    const playersByGuild = {};
    linkedPlayers.forEach(player => {
      if (!playersByGuild[player.guild_discord_id]) {
        playersByGuild[player.guild_discord_id] = [];
      }
      playersByGuild[player.guild_discord_id].push(player);
    });

    console.log(`🏠 Processing ${Object.keys(playersByGuild).length} Discord servers:\n`);

    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalErrors = 0;

    // Process each guild
    for (const [guildId, players] of Object.entries(playersByGuild)) {
      try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
          console.log(`❌ Guild ${guildId} not found (${players[0].guild_name})`);
          totalErrors += players.length;
          continue;
        }

        console.log(`🏠 Processing guild: ${guild.name} (${players.length} players)`);

        // Ensure ZentroLinked role exists
        let zentroLinkedRole = guild.roles.cache.find(role => role.name === 'ZentroLinked');
        if (!zentroLinkedRole) {
          try {
            zentroLinkedRole = await guild.roles.create({
              name: 'ZentroLinked',
              color: 0xFF8C00, // Orange
              reason: 'Zentro Bot - Role for linked players (bulk deployment)'
            });
            console.log(`  ✅ Created ZentroLinked role`);
          } catch (roleCreateError) {
            console.log(`  ❌ Failed to create ZentroLinked role: ${roleCreateError.message}`);
            totalErrors += players.length;
            continue;
          }
        } else {
          console.log(`  ✅ ZentroLinked role already exists`);
        }

        // Process each player in this guild
        for (const player of players) {
          try {
            const member = await guild.members.fetch(player.discord_id);
            
            if (!member.roles.cache.has(zentroLinkedRole.id)) {
              await member.roles.add(zentroLinkedRole);
              console.log(`  ✅ Added role to ${player.ign} (${member.user.tag})`);
              totalSuccess++;
            } else {
              console.log(`  ⏭️  ${player.ign} already has ZentroLinked role`);
            }
          } catch (memberError) {
            if (memberError.code === 10007) {
              console.log(`  ❌ User ${player.ign} (${player.discord_id}) not found in guild - they may have left`);
            } else {
              console.log(`  ❌ Failed to add role to ${player.ign} (${player.discord_id}): ${memberError.message}`);
            }
            totalErrors++;
          }
          totalProcessed++;
        }

        console.log(`  📊 Guild ${guild.name}: ${players.length} players processed\n`);

      } catch (guildError) {
        console.log(`❌ Error processing guild ${guildId}: ${guildError.message}`);
        totalErrors += players.length;
      }
    }

    console.log('🎯 DEPLOYMENT SUMMARY');
    console.log('=====================');
    console.log(`Total players processed: ${totalProcessed}`);
    console.log(`Successfully added roles: ${totalSuccess}`);
    console.log(`Errors: ${totalErrors}`);
    console.log(`\n✅ ZentroLinked role deployment completed!`);

  } catch (error) {
    console.error('❌ Deployment failed:', error);
  } finally {
    client.destroy();
    process.exit(0);
  }
}

// Run the deployment
deployZentroLinkedRole();
