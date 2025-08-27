const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');
const { compareDiscordIds } = require('../../utils/discordUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account with your in-game name (ONE TIME ONLY)')
    .addStringOption(opt =>
      opt.setName('in-game-name')
        .setDescription('Your in-game name (supports all characters, symbols, and fonts)')
        .setRequired(true)
        .setMaxLength(32)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    const discordGuildId = interaction.guildId;
    const discordId = interaction.user.id;
    
    // 🛡️ FUTURE-PROOF IGN HANDLING: Preserve original case, only trim spaces
    const rawIgn = interaction.options.getString('in-game-name');
    const ign = rawIgn.trim(); // Only trim spaces, preserve case and special characters

    // Validate IGN - be very permissive for weird names
    if (!ign || ign.length < 1) {
      return await interaction.editReply({
        embeds: [errorEmbed('Invalid Name', 'Please provide a valid in-game name (at least 1 character).')]
      });
    }

    // Log the linking attempt for debugging
    console.log(`[LINK ATTEMPT] Guild: ${discordGuildId}, Discord ID: ${discordId}, IGN: "${ign}"`);

    try {
      // Get all servers for this guild
      const [servers] = await pool.query(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
        [discordGuildId]
      );

      if (servers.length === 0) {
        return await interaction.editReply({
          embeds: [orangeEmbed('No Server Found', 'No Rust server found for this Discord. Contact an admin.')]
        });
      }

      // 🔍 CRITICAL CHECK 1: Check if this Discord ID has ANY active links (case-insensitive)
      const [activeDiscordLinks] = await pool.query(
        `SELECT p.*, rs.nickname 
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
         AND p.discord_id = ? 
         AND p.is_active = true`,
        [discordGuildId, discordId]
      );

      console.log(`[LINK DEBUG] Found ${activeDiscordLinks.length} active links for Discord ID ${discordId}`);

      if (activeDiscordLinks.length > 0) {
        const currentIgn = activeDiscordLinks[0].ign;
        const serverList = activeDiscordLinks.map(p => p.nickname).join(', ');
        
        return await interaction.editReply({
          embeds: [orangeEmbed('Already Linked', `You are already linked to **${currentIgn}** on: ${serverList}\n\n**⚠️ ONE-TIME LINKING:** You can only link once. Contact an admin to unlink you if you need to change your name.`)]
        });
      }

      // 🔍 CRITICAL CHECK 2: Check if this IGN is actively linked to ANYONE (case-insensitive) - BULLETPROOF VERSION
      const [activeIgnLinks] = await pool.query(
        `SELECT p.*, rs.nickname 
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
         AND LOWER(p.ign) = LOWER(?) 
         AND p.is_active = true`,
        [discordGuildId, ign]
      );

      if (activeIgnLinks.length > 0) {
        console.log(`[LINK DEBUG] Found ${activeIgnLinks.length} active records for IGN ${ign}`);
        
        // Check if it's the same user trying to link the same IGN (should be allowed)
        const sameUserLink = activeIgnLinks.find(link => compareDiscordIds(link.discord_id, discordId));
        
        if (sameUserLink) {
          console.log(`[LINK DEBUG] Same user trying to link same IGN - allowing update`);
          // Allow the user to update their existing link - continue to confirmation
        } else {
          // IGN is actively linked to someone else
          const existingDiscordId = activeIgnLinks[0].discord_id;
          const serverList = activeIgnLinks.map(p => p.nickname).join(', ');
          
          console.log(`[LINK DEBUG] IGN ${ign} is actively linked to Discord ID ${existingDiscordId}, blocking new user ${discordId}`);
          return await interaction.editReply({
            embeds: [orangeEmbed('IGN Already Linked', `The in-game name **${ign}** is already linked to another Discord account on: ${serverList}\n\nPlease use a different in-game name or contact an admin.`)]
          });
        }
      }

      // ✅ All checks passed - show confirmation
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`link_confirm_${discordGuildId}_${discordId}_${ign}`)
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
