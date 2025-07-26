const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-currency-player')
    .setDescription('Remove currency from a specific player')
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
        .setDescription('Amount of currency to remove')
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

      // Get player record
      const playerResult = await pool.query(
        'SELECT id FROM players WHERE discord_id = $1 AND server_id = $2',
        [player.id, serverId]
      );

      if (playerResult.rows.length === 0) {
        return interaction.reply({
          embeds: [orangeEmbed('Error', `Player ${player.username} not found on ${serverNickname}.`)],
          ephemeral: true
        });
      }

      const playerId = playerResult.rows[0].id;

      // Remove economy record
      await pool.query('DELETE FROM economy WHERE player_id = $1', [playerId]);

      // Remove player record
      await pool.query('DELETE FROM players WHERE id = $1', [playerId]);

      await interaction.reply({
        embeds: [orangeEmbed(
          '🗑️ Player Removed',
          `**${player.username}** has been removed from **${serverNickname}**.\n\nTheir currency and player data have been deleted.`
        )],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error removing player:', error);
      await interaction.reply({
        embeds: [orangeEmbed('Error', 'Failed to remove player. Please try again.')],
        ephemeral: true
      });
    }
  },
}; 