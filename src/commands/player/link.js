const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const pool = require('../../db');
const { normalizeIGN } = require('../../utils/autoServerLinking');
const { isIgnAvailable } = require('../../utils/autoServerLinking');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account with your in-game name (ONE TIME PER GUILD)')
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

    // Normalize IGN
    const rawIgn = interaction.options.getString('in-game-name');
    const ign = rawIgn.trim();
    const normalizedIgn = normalizeIGN(ign); // normalize AFTER trim

    if (!ign || ign.length < 1 || !normalizedIgn) {
      return await interaction.editReply({
        embeds: [errorEmbed('Invalid Name', 'Please provide a valid in-game name (at least 1 character).')]
      });
    }

    console.log(`[LINK ATTEMPT] Guild: ${discordGuildId}, Discord ID: ${discordId}, IGN: "${ign}"`);

    try {
      // Get DB guild id
      const [guildResult] = await pool.query(
        'SELECT id FROM guilds WHERE discord_id = ?',
        [discordGuildId]
      );

      if (guildResult.length === 0) {
        console.error(`[LINK ERROR] No guild found for Discord ID ${discordGuildId}`);
        return await interaction.editReply({
          embeds: [errorEmbed('Guild Error', 'Failed to find guild configuration. Please contact an admin.')]
        });
      }

      const dbGuildId = guildResult[0].id;

      // Get all servers for this guild
      const [servers] = await pool.query(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = ? ORDER BY nickname',
        [dbGuildId]
      );

      if (servers.length === 0) {
        return await interaction.editReply({
          embeds: [orangeEmbed('No Server Found', 'No Rust server found for this Discord. Contact an admin.')]
        });
      }

      // Check if this user is already linked in this guild
      const [activeDiscordLinks] = await pool.query(
        `SELECT p.*, rs.nickname 
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         WHERE p.guild_id = ? 
         AND p.discord_id = ? 
         AND p.is_active = true`,
        [dbGuildId, discordId]
      );

      console.log(`[LINK DEBUG] Found ${activeDiscordLinks.length} active links for Discord ID ${discordId} in guild ${dbGuildId}`);

      if (activeDiscordLinks.length > 0) {
        const currentIgn = activeDiscordLinks[0].ign;
        const serverList = activeDiscordLinks.map(p => p.nickname).join(', ');

        return await interaction.editReply({
          embeds: [orangeEmbed(
            'Already Linked',
            `You are already linked to **${currentIgn}** in this guild on: ${serverList}\n\n` +
            '**⚠️ ONE-TIME LINKING PER GUILD:** You can only link once in each guild.\n\n' +
            'Need to change your name? Ask an admin to unlink you first.'
          )]
        });
      }

      // Check if IGN is available in this guild
      const ignAvailability = await isIgnAvailable(dbGuildId, normalizedIgn, discordId);

      if (!ignAvailability.available) {
        if (ignAvailability.error) {
          console.error(`[LINK ERROR] IGN availability check failed: ${ignAvailability.error}`);
          return await interaction.editReply({
            embeds: [errorEmbed('System Error', 'Failed to check IGN availability. Please try again.')]
          });
        }

        const serverList = ignAvailability.existingLinks.map(p => p.nickname).join(', ');
        console.log(`[LINK DEBUG] IGN "${ign}" is already linked in this guild on: ${serverList}`);

        return await interaction.editReply({
          embeds: [orangeEmbed(
            'IGN Already Linked',
            `The in-game name **${ign}** is already linked to another Discord account on: ${serverList}\n\n` +
            'Please use a different in-game name or contact an admin.'
          )]
        });
      }

      console.log(`[LINK DEBUG] IGN "${ign}" is available for linking in guild ${dbGuildId}`);

      // Create safe token for button payload
      const tokenData = {
        g: dbGuildId,
        u: discordId,
        n: normalizedIgn,
        r: ign // raw IGN for display
      };
      const token = Buffer.from(JSON.stringify(tokenData)).toString('base64url');

      // Show confirmation
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`link_confirm:${token}`)
          .setLabel('Confirm Link')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('link_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
      );

      const confirmEmbed = orangeEmbed(
        'Confirm Link',
        `Are you sure you want to link your Discord account to **${ign}**?\n\n` +
        `This will link your account across **${servers.length} server(s)**:\n${servers.map(s => `• ${s.nickname}`).join('\n')}\n\n` +
        '**⚠️ REMEMBER:** This is a **ONE-TIME LINK PER GUILD**. You cannot change your linked name later without admin help!\n\n' +
        '**Make sure this is the correct in-game name!**'
      );

      await interaction.editReply({ embeds: [confirmEmbed], components: [row] });
    } catch (error) {
      console.error('Error in /link:', error);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to process link request. Please try again.')] });
    }
  }
};