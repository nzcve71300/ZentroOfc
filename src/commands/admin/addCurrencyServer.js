const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { getServerByNickname, updateBalance, recordTransaction } = require('../../utils/economy');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-currency-server')
    .setDescription('Add currency to all players on a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of currency to add')
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
    await interaction.deferReply({ ephemeral: true });
    if (!hasAdminPermissions(interaction.member)) return sendAccessDeniedMessage(interaction, false);

    const guildId = interaction.guildId;
    const serverName = interaction.options.getString('server');
    const amount = interaction.options.getInteger('amount');

    try {
      const servers = serverName === 'ALL'
        ? await pool.query('SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1)', [guildId])
        : { rows: [await getServerByNickname(guildId, serverName)] };

      let updatedPlayers = 0;
      let totalAdded = 0;

      for (const server of servers.rows) {
        const players = await pool.query('SELECT id, ign FROM players WHERE server_id = $1', [server.id]);
        for (const player of players.rows) {
          const newBalance = await updateBalance(player.id, amount);
          await recordTransaction(player.id, amount, 'admin_add');
          updatedPlayers++;
          totalAdded += amount;
        }
      }

      await interaction.editReply({
        embeds: [successEmbed('Currency Added',
          `Added **${amount} coins** to **${updatedPlayers} players** on **${serverName === 'ALL' ? 'All Servers' : serverName}**.\n\n**Total Added:** ${totalAdded} coins`)]
      });
    } catch (err) {
      console.error('Error in add-currency-server:', err);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to add currency. Please try again.')] });
    }
  }
};
