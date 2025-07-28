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
    // Get balance for the selected server
    const balanceResult = await pool.query(
      `SELECT e.balance, p.id as player_id
       FROM players p
       JOIN economy e ON p.id = e.player_id
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.discord_id = $1 AND rs.nickname = $2 AND rs.guild_id = (SELECT id FROM guilds WHERE discord_id = $3)
       LIMIT 1`,
      [userId, serverName, guildId]
    );

    if (balanceResult.rows.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed(
          'Account Not Linked',
          'You must link your Discord account to your in-game character first.\n\nUse `/link <in-game-name>` to link your account before using this command.'
        )]
      });
    }

    const balance = balanceResult.rows[0].balance || 0;
    const playerId = balanceResult.rows[0].player_id;
    const serverId = (await pool.query(
      `SELECT id FROM rust_servers WHERE nickname = $1 AND guild_id = (SELECT id FROM guilds WHERE discord_id = $2)`,
      [serverName, guildId]
    )).rows[0].id;
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