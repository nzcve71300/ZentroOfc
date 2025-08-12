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

async function updateExistingLinkedNicknames() {
  try {
    console.log('🔗 Starting to update existing linked users\' nicknames...');
    
    // Get all active linked players
    const [linkedPlayers] = await pool.query(`
      SELECT DISTINCT p.discord_id, p.ign, g.discord_id as guild_discord_id
      FROM players p
      JOIN guilds g ON p.guild_id = g.id
      WHERE p.discord_id IS NOT NULL 
      AND p.is_active = true
      ORDER BY g.discord_id, p.ign
    `);
    
    console.log(`Found ${linkedPlayers.length} active linked players to update`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const player of linkedPlayers) {
      try {
        const guild = client.guilds.cache.get(player.guild_discord_id);
        if (!guild) {
          console.log(`❌ Guild not found for Discord ID: ${player.guild_discord_id}`);
          skippedCount++;
          continue;
        }
        
        const member = await guild.members.fetch(player.discord_id).catch(() => null);
        if (!member) {
          console.log(`❌ Member not found: ${player.ign} (${player.discord_id})`);
          skippedCount++;
          continue;
        }
        
        // Skip server owners
        if (guild.ownerId === player.discord_id) {
          console.log(`⏭️ Skipping server owner: ${player.ign} (${player.discord_id})`);
          skippedCount++;
          continue;
        }
        
        // Check if bot can manage this member
        if (!member.manageable) {
          console.log(`❌ Cannot manage member: ${player.ign} (${player.discord_id}) - Bot role too low`);
          skippedCount++;
          continue;
        }
        
        const newNickname = `${player.ign} 🔗`.substring(0, 28); // Cap at 28 characters
        
        // Only update if nickname is different
        if (member.nickname !== newNickname) {
          await member.setNickname(newNickname);
          console.log(`✅ Updated nickname for ${player.ign}: ${newNickname}`);
          updatedCount++;
        } else {
          console.log(`⏭️ Nickname already correct for ${player.ign}: ${newNickname}`);
          skippedCount++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error updating ${player.ign} (${player.discord_id}):`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Update Summary:');
    console.log(`✅ Successfully updated: ${updatedCount}`);
    console.log(`⏭️ Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📈 Total processed: ${linkedPlayers.length}`);
    
  } catch (error) {
    console.error('❌ Error in updateExistingLinkedNicknames:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

client.once('ready', () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);
  console.log(`📊 Connected to ${client.guilds.cache.size} guilds`);
  updateExistingLinkedNicknames();
});

client.login(process.env.DISCORD_TOKEN); 