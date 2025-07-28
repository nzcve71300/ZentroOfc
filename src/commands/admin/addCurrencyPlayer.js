const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage, getLinkedPlayer } = require('../../utils/permissions');
const pool = require('../../db');

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
      const result = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND nickname ILIKE $2 LIMIT 25',
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.rows.map(row => ({
        name: row.nickname,
        value: row.nickname
      }));

      // Add "All" option
      choices.unshift({
        name: 'All Servers',
        value: 'ALL'
      });

      await interaction.respond(choices);
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    // Defer reply to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const serverNickname = interaction.options.getString('server');
    const playerName = interaction.options.getString('player_name');
    const amount = interaction.options.getInteger('amount');
    const guildId = interaction.guildId;

    try {
      // Get server info
      const serverResult = await pool.query(
        'SELECT rs.id, rs.nickname FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = $1 AND rs.nickname = $2',
        [guildId, serverNickname]
      );

      if (serverResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      const serverId = serverResult.rows[0].id;
      const serverName = serverResult.rows[0].nickname;

      // Use getLinkedPlayer to check if the player is linked
      const player = await getLinkedPlayer(guildId, serverId, playerName);
      if (!player) {
        return interaction.editReply({
          embeds: [orangeEmbed(
            'Player Not Linked',
            'This player is not linked. They must use /link before currency can be added.'
          )]
        });
      }
      const playerId = player.id;

      // Check if economy record exists
      let economyResult = await pool.query(
        'SELECT id, balance FROM economy WHERE player_id = $1',
        [playerId]
      );

      let newBalance;
      if (economyResult.rows.length === 0) {
        // Create economy record with the amount
        await pool.query(
          'INSERT INTO economy (player_id, balance) VALUES ($1, $2)',
          [playerId, amount]
        );
        newBalance = amount;
      } else {
        // Update existing balance
        newBalance = parseInt(economyResult.rows[0].balance || 0) + amount;
        await pool.query(
          'UPDATE economy SET balance = $1 WHERE player_id = $2',
          [newBalance, playerId]
        );
      }

      // Record transaction
      await pool.query(
        'INSERT INTO transactions (player_id, amount, type, timestamp) VALUES ($1, $2, $3, NOW())',
        [playerId, amount, 'admin_add']
      );

      await interaction.editReply({
        embeds: [successEmbed(
          'Currency Added',
          `Added **${amount} coins** to **${playerName}** on **${serverName}**.\n\n**New Balance:** ${newBalance} coins`
        )]
      });

    } catch (error) {
      console.error('Error adding currency to player:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to add currency to player. Please try again.')]
      });
    }
  },
}; 