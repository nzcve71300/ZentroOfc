const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { getActivePlayerByIgn, getPlayerBalance } = require('../../utils/unifiedPlayerSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('view-balance')
    .setDescription('View a specific player\'s balance (Admin only)')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('player')
        .setDescription('Player\'s in-game name')
        .setRequired(true)
        .setMaxLength(50)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [result] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.map(row => ({
        name: row.nickname,
        value: row.nickname
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const guildId = interaction.guildId;
    const serverName = interaction.options.getString('server');
    const playerName = interaction.options.getString('player');

    try {
      // Get server info
      const [serverResult] = await pool.query(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
        [guildId, serverName]
      );

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      const server = serverResult[0];

      // Get player info
      const player = await getActivePlayerByIgn(guildId, server.id, playerName);
      if (!player) {
        return interaction.editReply({
          embeds: [errorEmbed('Player Not Found', `No player named **${playerName}** found on **${serverName}**.`)]
        });
      }

      // Get player balance
      const balance = await getPlayerBalance(player.id);

      // Get currency name for this server
      const { getCurrencyName } = require('../../utils/economy');
      const currencyName = await getCurrencyName(server.id);

      // Get Discord user info if linked
      let discordInfo = '';
      if (player.discord_id) {
        try {
          const discordUser = await interaction.client.users.fetch(player.discord_id);
          discordInfo = `\n**Discord:** ${discordUser.tag} (${discordUser.id})`;
        } catch (error) {
          discordInfo = `\n**Discord:** Unknown User (${player.discord_id})`;
        }
      }

      const embed = successEmbed(
        'Player Balance',
        `**Player:** ${player.ign}\n**Server:** ${server.nickname}${discordInfo}\n\n**Balance:** ${balance} ${currencyName}`
      );

      // Add linked date if available
      if (player.linked_at) {
        const linkedDate = new Date(player.linked_at).toLocaleDateString();
        embed.addFields({ name: 'Linked Since', value: linkedDate, inline: true });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in view-balance:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to fetch player balance. Please try again.')]
      });
    }
  }
}; 