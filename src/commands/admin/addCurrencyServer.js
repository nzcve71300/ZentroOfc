const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { getServerByNickname, updatePlayerBalance, recordTransaction, ensureEconomyRecord } = require('../../utils/unifiedPlayerSystem');
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
    if (!hasAdminPermissions(interaction.member)) return sendAccessDeniedMessage(interaction, false);

    const guildId = interaction.guildId;
    const serverName = interaction.options.getString('server');
    const amount = interaction.options.getInteger('amount');

    try {
      const server = await getServerByNickname(guildId, serverName);
      if (!server) {
        return interaction.editReply({ embeds: [errorEmbed('Server Not Found', 'This server does not exist.')] });
      }

      // Get all active LINKED players on this server (only those with Discord accounts)
      const [players] = await pool.query(
        `SELECT p.*, e.balance 
         FROM players p
         LEFT JOIN economy e ON p.id = e.player_id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
         AND p.server_id = ?
         AND p.is_active = true
         AND p.discord_id IS NOT NULL`,
        [guildId, server.id]
      );

      if (players.length === 0) {
        return interaction.editReply({ embeds: [errorEmbed('No Linked Players Found', `No active linked players found on **${serverName}**. Only players with connected Discord accounts can receive currency.`)] });
      }

      // Get currency name for this server
      const { getCurrencyName } = require('../../utils/economy');
      const currencyName = await getCurrencyName(server.id);

      const affectedPlayers = [];
      for (const player of players) {
        // Ensure economy record exists
        await ensureEconomyRecord(player.id, player.guild_id);
        
        const newBalance = await updatePlayerBalance(player.id, amount);
        await recordTransaction(player.id, amount, 'admin_server_add');
        affectedPlayers.push({ ign: player.ign, balance: newBalance });
      }

      const embed = successEmbed(
        'Currency Added to Server', 
        `Added **${amount} ${currencyName}** to all linked players on **${serverName}**.\n\n**Total affected players:** ${affectedPlayers.length}`
      );

      // Add player details if there are 10 or fewer players
        
        if (affectedPlayers.length <= 10) {
          affectedPlayers.forEach(player => {
            embed.addFields({ name: player.ign, value: `${player.balance} ${currencyName}`, inline: true });
          });
             } else {
         embed.addFields({ name: 'Players Updated', value: `${affectedPlayers.length} players received ${amount} ${currencyName} each.` });
       }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error in add-currency-server:', err);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to add currency to server. Please try again.')] });
    }
  }
};
