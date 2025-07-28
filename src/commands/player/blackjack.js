const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { getServerByNickname, getPlayerBalance, getServersForGuild } = require('../../utils/economy');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Play blackjack for currency')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server to gamble on')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;
    try {
      const choices = await getServersForGuild(guildId, focusedValue);
      await interaction.respond(choices);
    } catch (err) {
      console.error('Autocomplete error:', err);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const serverOption = interaction.options.getString('server');

    try {
      // Get server
      const server = await getServerByNickname(guildId, serverOption);
      if (!server) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      // Get balance
      const balanceData = await getPlayerBalance(guildId, serverOption, userId);
      if (!balanceData) {
        return interaction.editReply({
          embeds: [errorEmbed(
            'Account Not Linked',
            'You must link your account using `/link <in-game-name>` before playing blackjack.'
          )]
        });
      }
      const balance = balanceData.balance;

      // Get game config (min/max bet)
      const configResult = await pool.query(
        `SELECT option_value FROM eco_games WHERE server_id = $1 AND setup = 'blackjack' AND option = 'min_max_bet'`,
        [server.id]
      );
      let minBet = 1;
      let maxBet = 10000;
      if (configResult.rows.length > 0) {
        const [min, max] = configResult.rows[0].option_value.split(',').map(Number);
        minBet = min || minBet;
        maxBet = max || maxBet;
      }

      // Build modal for bet
      const modal = new ModalBuilder()
        .setCustomId(`blackjack_bet_${server.id}`)
        .setTitle(`Blackjack - Place Your Bet (${server.nickname})`);
      const betInput = new TextInputBuilder()
        .setCustomId('bet_amount')
        .setLabel(`Enter your bet (${minBet}-${maxBet})`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(`Your balance: ${balance}`)
        .setRequired(true);
      const row = new ActionRowBuilder().addComponents(betInput);
      modal.addComponents(row);

      await interaction.editReply({
        embeds: [orangeEmbed('Blackjack', `Your balance: **${balance}** coins\nMin bet: **${minBet}** | Max bet: **${maxBet}**`)],
      });

      await interaction.showModal(modal);

    } catch (err) {
      console.error('Blackjack error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to start Blackjack. Please try again.')]
      });
    }
  },
};
