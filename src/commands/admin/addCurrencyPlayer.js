const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed } = require('../../embeds/format');
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

      await interaction.respond(choices);
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    const serverNickname = interaction.options.getString('server');
    const player = interaction.options.getUser('player');
    const amount = interaction.options.getInteger('amount');
    const guildId = interaction.guildId;

    try {
      // Get server ID
      const serverResult = await pool.query(
        'SELECT rs.id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = $1 AND rs.nickname = $2',
        [guildId, serverNickname]
      );

      if (serverResult.rows.length === 0) {
        return interaction.reply({
          embeds: [orangeEmbed('Error', 'Server not found.')],
          ephemeral: true
        });
      }

      const serverId = serverResult.rows[0].id;

      // Check if player exists
      let playerResult = await pool.query(
        'SELECT id FROM players WHERE discord_id = $1 AND server_id = $2',
        [player.id, serverId]
      );

      let playerId;
      if (playerResult.rows.length === 0) {
        // Create player record
        const newPlayerResult = await pool.query(
          'INSERT INTO players (guild_id, server_id, discord_id, ign) VALUES ((SELECT id FROM guilds WHERE discord_id = $1), $2, $3, $4) RETURNING id',
          [guildId, serverId, player.id, 'Unknown']
        );
        playerId = newPlayerResult.rows[0].id;
      } else {
        playerId = playerResult.rows[0].id;
      }

      // Check if economy record exists
      let economyResult = await pool.query(
        'SELECT id, balance FROM economy WHERE player_id = $1',
        [playerId]
      );

      if (economyResult.rows.length === 0) {
        // Create economy record with the amount
        await pool.query(
          'INSERT INTO economy (player_id, balance) VALUES ($1, $2)',
          [playerId, amount]
        );
      } else {
        // Update existing balance
        const newBalance = parseInt(economyResult.rows[0].balance || 0) + amount;
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

      await interaction.reply({
        embeds: [orangeEmbed(
          '💰 Currency Added',
          `Added **${amount} coins** to **${player.username}** on **${serverNickname}**.`
        )],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error adding currency to player:', error);
      await interaction.reply({
        embeds: [orangeEmbed('Error', 'Failed to add currency to player. Please try again.')],
        ephemeral: true
      });
    }
  },
}; 