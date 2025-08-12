const { Client, GatewayIntentBits } = require('discord.js');
const pool = require('./src/db');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

async function updateNicknamesFixed() {
  try {
    console.log('🔗 Starting to update existing linked users\' nicknames...\n');
    
    // Get all active linked players
    const [linkedPlayers] = await pool.query(`
      SELECT DISTINCT p.discord_id, p.ign, g.discord_id as guild_discord_id
      FROM players p
      JOIN guilds g ON p.guild_id = g.id
      WHERE p.discord_id IS NOT NULL 
      AND p.is_active = true
      ORDER BY g.discord_id, p.ign
    `);
    
    console.log(`Found ${linkedPlayers.length} active linked players to update\n`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const player of linkedPlayers) {
      try {
        console.log(`\n🔄 Processing: ${player.ign} (${player.discord_id})`);
        
        const guild = client.guilds.cache.get(player.guild_discord_id);
        if (!guild) {
          console.log(`   ❌ Guild not found for Discord ID: ${player.guild_discord_id}`);
          skippedCount++;
          continue;
        }
        
        // Fetch the member properly
        const member = await guild.members.fetch(player.discord_id).catch(err => {
          console.log(`   ❌ Failed to fetch member: ${err.message}`);
          return null;
        });
        
        if (!member) {
          console.log(`   ❌ Member not found: ${player.ign}`);
          skippedCount++;
          continue;
        }
        
        // Skip server owners
        if (guild.ownerId === player.discord_id) {
          console.log(`   ⏭️ Skipping server owner: ${player.ign}`);
          skippedCount++;
          continue;
        }
        
        // Check if bot can manage this member
        if (!member.manageable) {
          console.log(`   ❌ Cannot manage member: ${player.ign} - Bot role too low`);
          skippedCount++;
          continue;
        }
        
        const newNickname = `${player.ign} 🔗`.substring(0, 28); // Cap at 28 characters
        
        // Only update if nickname is different
        if (member.nickname !== newNickname) {
          console.log(`   📝 Current nickname: ${member.nickname || 'None'}`);
          console.log(`   🎯 Setting nickname to: ${newNickname}`);
          
          // Use the proper method to set nickname
          await member.setNickname(newNickname);
          console.log(`   ✅ Successfully updated nickname for ${player.ign}`);
          updatedCount++;
        } else {
          console.log(`   ⏭️ Nickname already correct for ${player.ign}: ${newNickname}`);
          skippedCount++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`   ❌ Error updating ${player.ign}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Update Summary:');
    console.log(`✅ Successfully updated: ${updatedCount}`);
    console.log(`⏭️ Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📈 Total processed: ${linkedPlayers.length}`);
    
  } catch (error) {
    console.error('❌ Error in updateNicknamesFixed:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

client.once('ready', () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);
  console.log(`📊 Connected to ${client.guilds.cache.size} guilds`);
  updateNicknamesFixed();
});

client.login(process.env.DISCORD_TOKEN); 