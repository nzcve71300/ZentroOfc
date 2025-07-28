const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pool = require('../../db');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { getLinkedPlayer, getPlayerByIGN } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account with your in-game name')
    .addStringOption(opt =>
      opt.setName('in-game-name')
        .setDescription('Your in-game name')
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const guildId = interaction.guildId;
    const discordId = interaction.user.id;
    const ign = interaction.options.getString('in-game-name');

    try {
      // Get first server for this guild
      const serverResult = await pool.query(
        'SELECT id FROM rust_servers WHERE guild_id::text = (SELECT id::text FROM guilds WHERE discord_id::text = $1) LIMIT 1',
        [guildId.toString()]
      );
      if (serverResult.rows.length === 0) {
        return await interaction.editReply({
          embeds: [orangeEmbed('No Server Found', 'No Rust server found for this Discord. Contact an admin.')]
        });
      }

      const serverId = serverResult.rows[0].id;

      // Prevent duplicate links
      const existingPlayer = await getLinkedPlayer(guildId, serverId, discordId);
      if (existingPlayer && existingPlayer.ign.toLowerCase() === ign.toLowerCase()) {
        // Already linked to same IGN
      } else if (existingPlayer) {
        return await interaction.editReply({
          embeds: [orangeEmbed('Already Linked', 'Your Discord is already linked to a different in-game name on this server.')]
        });
      }

      const ignPlayer = await getPlayerByIGN(guildId, serverId, ign);
      if (ignPlayer && ignPlayer.discord_id && ignPlayer.discord_id !== discordId) {
        return await interaction.editReply({
          embeds: [orangeEmbed('IGN Already Linked', 'This in-game name is already linked to another Discord account.')]
        });
      }

      // Confirm linking
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`link_confirm_${guildId}_${discordId}_${ign}`)
          .setLabel('Confirm')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('link_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
      );

      const confirmEmbed = orangeEmbed('Confirm Link', `Are you sure you want to link to **${ign}**?`);
      await interaction.editReply({ embeds: [confirmEmbed], components: [row] });
    } catch (error) {
      console.error('Error in /link:', error);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to process link request.')] });
    }
  }
};
