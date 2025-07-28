const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { getServerByNickname, getPlayerByIGN, updateBalance, recordTransaction } = require('../../utils/economyHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-currency-player')
    .setDescription('Add currency to a specific player')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('player_name')
        .setDescription('Player\'s in-game name')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of currency to add')
        .setRequired(true)
        .setMinValue(1)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;
    try {
      const servers = await interaction.client.db.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND nickname ILIKE $2 LIMIT 25',
        [guildId, `%${focusedValue}%`]
      );
      await interaction.respond(servers.rows.map(row => ({ name: row.nickname, value: row.nickname })));
    } catch {
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    if (!hasAdminPermissions(interaction.member)) return sendAccessDeniedMessage(interaction, false);

    const guildId = interaction.guildId;
    const serverName = interaction.options.getString('server');
    const playerName = interaction.options.getString('player_name');
    const amount = interaction.options.getInteger('amount');

    try {
      const server = await getServerByNickname(guildId, serverName);
      if (!server) {
        return interaction.editReply({ embeds: [errorEmbed('Server Not Found', 'This server does not exist.')] });
      }

      const player = await getPlayerByIGN(guildId, server.id, playerName);
      if (!player) {
        return interaction.editReply({ embeds: [errorEmbed('Player Not Found', `No player named **${playerName}** found on **${serverName}**.`)] });
      }

      const newBalance = await updateBalance(player.id, amount);
      await recordTransaction(player.id, amount, 'admin_add');

      await interaction.editReply({
        embeds: [successEmbed('Currency Added', `Added **${amount} coins** to **${player.ign}** on **${server.nickname}**.\n\n**New Balance:** ${newBalance} coins`)]
      });
    } catch (err) {
      console.error('Error in add-currency-player:', err);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to add currency. Please try again.')] });
    }
  }
};
