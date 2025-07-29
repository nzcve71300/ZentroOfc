const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { getServerByNickname, updatePlayerBalance, recordTransaction } = require('../../utils/unifiedPlayerSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-currency-server')
    .setDescription('Add currency to all players on a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(TRUE)
        .setAutocomplete(TRUE))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of currency to add')
        .setRequired(TRUE)
        .setMinValue(1)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;
    try {
      const servers = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
        [guildId, `%${focusedValue}%`]
      );
      await interaction.respond(servers.rows.map(row => ({ name: row.nickname, value: row.nickname })));
    } catch {
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    if (!hasAdminPermissions(interaction.member)) return sendAccessDeniedMessage(interaction, FALSE);

    const guildId = interaction.guildId;
    const serverName = interaction.options.getString('server');
    const amount = interaction.options.getInteger('amount');

    try {
      const server = await getServerByNickname(guildId, serverName);
      if (!server) {
        return interaction.editReply({ embeds: [errorEmbed('Server Not Found', 'This server does not exist.')] });
      }

      // Get all active players on this server
      const players = await pool.query(
        `SELECT p.*, e.balance 
         FROM players p
         LEFT JOIN economy e ON p.id = e.player_id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
         AND p.server_id = ?
         AND p.is_active = TRUE`,
        [guildId, server.id]
      );

      if (players.rows.length === 0) {
        return interaction.editReply({ embeds: [errorEmbed('No Players Found', `No active players found on **${serverName}**.`)] });
      }

      const affectedPlayers = [];
      for (const player of players.rows) {
        const newBalance = await updatePlayerBalance(player.id, amount);
        await recordTransaction(player.id, amount, 'admin_server_add');
        affectedPlayers.push({ ign: player.ign, balance: newBalance });
      }

      const embed = successEmbed(
        'Currency Added to Server', 
        `Added **${amount} coins** to all players on **${serverName}**.\n\n**Players Affected:** ${affectedPlayers.length}`
      );

      // Add player details if there are 10 or fewer players
      if (affectedPlayers.length <= 10) {
        affectedPlayers.forEach(player => {
          embed.addFields({ name: player.ign, value: `${player.balance} coins`, inline: TRUE });
        });
      } else {
        embed.addFields({ name: 'Players Updated', value: `${affectedPlayers.length} players received ${amount} coins each.` });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error in add-currency-server:', err);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to add currency to server. Please try again.')] });
    }
  }
};
