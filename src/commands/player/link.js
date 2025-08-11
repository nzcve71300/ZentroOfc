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

      if (anyDiscordLinks.length > 0) {
        const currentIgn = anyDiscordLinks[0].ign;
        const serverList = anyDiscordLinks.map(p => p.nickname).join(', ');
        const isActive = anyDiscordLinks[0].is_active;
        
        if (isActive) {
          return await interaction.editReply({
            embeds: [orangeEmbed('Already Linked', `You are already linked to **${currentIgn}** on: ${serverList}\n\n**⚠️ ONE-TIME LINKING:** You can only link once. Contact an admin to unlink you if you need to change your name.`)]
          });
        } else {
          return await interaction.editReply({
            embeds: [orangeEmbed('Previously Linked', `You were previously linked to **${currentIgn}** on: ${serverList}\n\n**⚠️ ONE-TIME LINKING:** You can only link once. Contact an admin to unlink you if you need to link again.`)]
          });
        }
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
        const existingDiscordId = anyIgnLinks[0].discord_id;
        const serverList = anyIgnLinks.map(p => p.nickname).join(', ');
        const isActive = anyIgnLinks[0].is_active;
        
        if (existingDiscordId === discordId) {
          if (isActive) {
            return await interaction.editReply({
              embeds: [orangeEmbed('Already Linked', `You are already linked to **${ign}** on: ${serverList}\n\n**⚠️ ONE-TIME LINKING:** You can only link once. Contact an admin to unlink you if you need to change your name.`)]
            });
          } else {
            return await interaction.editReply({
              embeds: [orangeEmbed('Previously Linked', `You were previously linked to **${ign}** on: ${serverList}\n\n**⚠️ ONE-TIME LINKING:** You can only link once. Contact an admin to unlink you if you need to link again.`)]
            });
          }
        } else {
          if (isActive) {
            return await interaction.editReply({
              embeds: [orangeEmbed('IGN Already Linked', `The in-game name **${ign}** is already linked to another Discord account on: ${serverList}\n\nPlease use a different in-game name or contact an admin.`)]
            });
          } else {
            return await interaction.editReply({
              embeds: [orangeEmbed('IGN Previously Used', `The in-game name **${ign}** was previously linked to another Discord account on: ${serverList}\n\nPlease use a different in-game name or contact an admin.`)]
            });
          }
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
