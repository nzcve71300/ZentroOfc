const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { getServerByNickname, updateBalance, recordTransaction } = require('../../utils/economy');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-currency-server')
    .setDescription('Remove currency from all players on a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of currency to remove')
        .setRequired(true)
        .setMinValue(1)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;
    try {
      const servers = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND nickname ILIKE $2 LIMIT 25',
        [guildId, `%${focusedValue}%`]
      );
      const choices = servers.rows.map(row => ({ name: row.nickname, value: row.nickname }));
      choices.unshift({ name: 'All Servers', value: 'ALL' });
      await interaction.respond(choices);
    } catch {
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    if (!hasAdminPermissions(interaction.member)) return sendAccessDeniedMessage(interaction, false);

    const guildId = interaction.guildId;
    const serverName = interaction.options.getString('server');
    const amount = interaction.options.getInteger('amount');

    try {
      const servers = serverName === 'ALL'
        ? await pool.query('SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1)', [guildId])
        : { rows: [await getServerByNickname(guildId, serverName)] };

      let updatedPlayers = 0;
      let totalRemoved = 0;

      for (const server of servers.rows) {
        const players = await pool.query('SELECT id, ign FROM players WHERE server_id = $1', [server.id]);
        for (const player of players.rows) {
          const current = await pool.query('SELECT balance FROM economy WHERE player_id = $1', [player.id]);
          const oldBalance = current.rows[0]?.balance || 0;
          const removeAmt = Math.min(amount, oldBalance);

          const newBalance = await updateBalance(player.id, -removeAmt);
          await recordTransaction(player.id, -removeAmt, 'admin_remove');

          updatedPlayers++;
          totalRemoved += removeAmt;
        }
      }

      await interaction.editReply({
        embeds: [successEmbed('Currency Removed',
          `Removed up to **${amount} coins** from **${updatedPlayers} players** on **${serverName === 'ALL' ? 'All Servers' : serverName}**.\n\n**Total Removed:** ${totalRemoved} coins`)]
      });
    } catch (err) {
      console.error('Error in remove-currency-server:', err);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to remove currency. Please try again.')] });
    }
  }
};
