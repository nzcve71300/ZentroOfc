const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Play blackjack for currency')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server to gamble on')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    try {
      const result = await pool.query(
        `SELECT rs.nickname FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         JOIN guilds g ON rs.guild_id = g.id
         WHERE p.discord_id = $1 AND g.discord_id = $2 AND rs.nickname ILIKE $3
         GROUP BY rs.nickname
         LIMIT 25`,
        [userId, guildId, `%${focusedValue}%`]
      );
      const choices = result.rows.map(row => ({ name: row.nickname, value: row.nickname }));
      await interaction.respond(choices);
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const serverName = interaction.options.getString('server');
    // Check if player is linked to this server
    const linkedResult = await pool.query(
      `SELECT p.id as player_id, rs.id as server_id
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       JOIN guilds g ON rs.guild_id = g.id
       WHERE p.discord_id = $1 AND g.discord_id = $2 AND rs.nickname = $3
       LIMIT 1`,
      [userId, guildId, serverName]
    );
    if (linkedResult.rows.length === 0) {
      return interaction.reply({
        embeds: [errorEmbed('Account Not Linked', 'You must link your Discord account to your in-game character on this server first.\n\nUse `/link <in-game-name>` to link your account before using this command.')],
        ephemeral: true
      });
    }
    const playerId = linkedResult.rows[0].player_id;
    const serverId = linkedResult.rows[0].server_id;
    // Create modal for bet amount, encode serverId in customId
    const modal = new ModalBuilder()
      .setCustomId(`blackjack_bet_${serverId}`)
      .setTitle(`Blackjack - Place Your Bet (${serverName})`);
    const betInput = new TextInputBuilder()
      .setCustomId('bet_amount')
      .setLabel('Bet Amount')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter your bet amount')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(10);
    const firstActionRow = new ActionRowBuilder().addComponents(betInput);
    modal.addComponents(firstActionRow);
    await interaction.showModal(modal);
  },
}; 