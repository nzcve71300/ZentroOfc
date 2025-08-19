const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account with your in-game name (ONE TIME ONLY)')
    .addStringOption(opt =>
      opt.setName('in-game-name')
        .setDescription('Your in-game name')
        .setRequired(true)
        .setMaxLength(32)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    const guildId = interaction.guildId;
    const discordId = interaction.user.id;
    const ign = interaction.options.getString('in-game-name').trim();

    // Validate IGN
    if (!ign || ign.length < 2) {
      return await interaction.editReply({
        embeds: [errorEmbed('Invalid Name', 'Please provide a valid in-game name (at least 2 characters).')]
      });
    }

    try {
      // Get all servers for this guild
      const [servers] = await pool.query(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
        [guildId]
      );

      if (servers.length === 0) {
        return await interaction.editReply({
          embeds: [orangeEmbed('No Server Found', 'No Rust server found for this Discord. Contact an admin.')]
        });
      }

      // CRITICAL CHECK 1: Check if this Discord ID has EVER been linked (active OR inactive)
      const [anyDiscordLinks] = await pool.query(
        `SELECT p.*, rs.nickname 
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
         AND p.discord_id = ?`,
        [guildId, discordId]
      );

      console.log(`[LINK DEBUG] Found ${anyDiscordLinks.length} existing links for Discord ID ${discordId}`);

      if (anyDiscordLinks.length > 0) {
        const currentIgn = anyDiscordLinks[0].ign;
        const serverList = anyDiscordLinks.map(p => p.nickname).join(', ');
        const isActive = anyDiscordLinks[0].is_active;
        
        if (isActive) {
          return await interaction.editReply({
            embeds: [orangeEmbed('Already Linked', `You are already linked to **${currentIgn}** on: ${serverList}\n\n**⚠️ ONE-TIME LINKING:** You can only link once. Contact an admin to unlink you if you need to change your name.`)]
          });
        } else {
          // User was previously linked but is now inactive - allow them to relink
          console.log(`[LINK] User ${discordId} was previously linked to ${currentIgn} but is inactive - allowing relink to ${ign}`);
          // Continue to IGN check instead of blocking
        }
      } else {
        // Brand new user - no previous links found, allow them to continue
        console.log(`[LINK] Brand new user ${discordId} - no previous links found, proceeding with IGN check`);
      }

      // CRITICAL CHECK 2: Check if this EXACT IGN has EVER been linked (active OR inactive)
      const [anyIgnLinks] = await pool.query(
        `SELECT p.*, rs.nickname 
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
         AND LOWER(p.ign) = LOWER(?)`,
        [guildId, ign]
      );

      if (anyIgnLinks.length > 0) {
        console.log(`[LINK DEBUG] Found ${anyIgnLinks.length} existing records for IGN ${ign}`);
        
        // Check if there are any ACTIVE records for this IGN
        const activeRecords = anyIgnLinks.filter(record => record.is_active);
        const serverList = anyIgnLinks.map(p => p.nickname).join(', ');
        
        console.log(`[LINK DEBUG] Active records: ${activeRecords.length}, Total records: ${anyIgnLinks.length}`);
        
        if (activeRecords.length > 0) {
          // There are active records - check if any belong to this user
          const userActiveRecord = activeRecords.find(record => record.discord_id === discordId);
          
          if (userActiveRecord) {
            // User already has active link with this IGN
            return await interaction.editReply({
              embeds: [orangeEmbed('Already Linked', `You are already linked to **${ign}** on: ${serverList}\n\n**⚠️ ONE-TIME LINKING:** You can only link once. Contact an admin to unlink you if you need to change your name.`)]
            });
          } else {
            // IGN is actively linked to someone else
            const existingDiscordId = activeRecords[0].discord_id;
            console.log(`[LINK DEBUG] IGN ${ign} is actively linked to Discord ID ${existingDiscordId}, blocking new user ${discordId}`);
            return await interaction.editReply({
              embeds: [orangeEmbed('IGN Already Linked', `The in-game name **${ign}** is already linked to another Discord account on: ${serverList}\n\nPlease use a different in-game name or contact an admin.`)]
            });
          }
        } else {
          // All records are inactive - allow linking
          console.log(`[LINK] IGN ${ign} has ${anyIgnLinks.length} inactive record(s) - allowing new user ${discordId} to link`);
          // Continue to confirmation
        }
      }

      // All checks passed - show confirmation
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`link_confirm_${guildId}_${discordId}_${ign}`)
          .setLabel('Confirm Link')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('link_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
      );

      const confirmEmbed = orangeEmbed(
        'Confirm Link', 
        `Are you sure you want to link your Discord account to **${ign}**?\n\nThis will link your account across **${servers.length} server(s)**:\n${servers.map(s => `• ${s.nickname}`).join('\n')}\n\n**⚠️ CRITICAL:** This is a **ONE-TIME LINK**. You cannot change your linked name later without admin help!\n\n**Make sure this is the correct in-game name!**`
      );
      
      await interaction.editReply({ embeds: [confirmEmbed], components: [row] });
    } catch (error) {
      console.error('Error in /link:', error);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to process link request. Please try again.')] });
    }
  }
};
