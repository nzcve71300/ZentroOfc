const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Play blackjack for currency'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    try {
      // Check if player is linked to any server
      const linkedResult = await pool.query(
        `SELECT p.id as player_id
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         JOIN guilds g ON rs.guild_id = g.id
         WHERE p.discord_id = $1 AND g.discord_id = $2
         LIMIT 1`,
        [userId, guildId]
      );

      if (linkedResult.rows.length === 0) {
        return interaction.reply({
          embeds: [errorEmbed('Account Not Linked', 'You must link your Discord account to your in-game character first.\n\nUse `/link <in-game-name>` to link your account before using this command.')],
          ephemeral: true
        });
      }

      // Get Discord balance (single balance for all servers)
      const balanceResult = await pool.query(
        `SELECT e.balance
         FROM players p
         JOIN economy e ON p.id = e.player_id
         JOIN rust_servers rs ON p.server_id = rs.id
         JOIN guilds g ON rs.guild_id = g.id
         WHERE p.discord_id = $1 AND g.discord_id = $2
         LIMIT 1`,
        [userId, guildId]
      );

      const balance = balanceResult.rows.length > 0 ? balanceResult.rows[0].balance || 0 : 0;

      // Create modal for bet amount
      const modal = new ModalBuilder()
        .setCustomId('blackjack_bet')
        .setTitle('Blackjack - Place Your Bet');

      const betInput = new TextInputBuilder()
        .setCustomId('bet_amount')
        .setLabel(`Bet Amount (Max: ${balance} coins)`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter your bet amount')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(10);

      const firstActionRow = new ActionRowBuilder().addComponents(betInput);
      modal.addComponents(firstActionRow);

      await interaction.showModal(modal);

    } catch (error) {
      console.error('Error starting blackjack:', error);
      await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to start blackjack game.')],
        ephemeral: true
      });
    }
  },
}; 