const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { getServerByNickname, getActivePlayerByDiscordId, getPlayerBalance, getServersForGuild } = require('../../utils/unifiedPlayerSystem');
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
      const servers = await getServersForGuild(guildId);
      const filtered = servers.filter(s => s.nickname.toLowerCase().includes(focusedValue.toLowerCase()));
      await interaction.respond(filtered.map(s => ({ name: s.nickname, value: s.nickname })));
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

      // Get player using unified system
      const player = await getActivePlayerByDiscordId(guildId, server.id, userId);
      if (!player) {
        return interaction.editReply({
          embeds: [errorEmbed(
            'Account Not Linked',
            'You must link your account using `/link <in-game-name>` before playing blackjack.'
          )]
        });
      }

      // Get balance using unified system
      const balance = await getPlayerBalance(player.id);

      // Get game config (min/max bet)
      const [configResult] = await pool.query(
        `SELECT option_value FROM eco_games WHERE server_id = ? AND setup = 'blackjack' AND option = 'min_max_bet'`,
        [server.id]
      );
      let minBet = 1;
      let maxBet = 10000;
      if (configResult.length > 0) {
        const [min, max] = configResult[0].option_value.split(',').map(Number);
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

      // Show the modal first
      await interaction.showModal(modal);
      
      // Then send the embed as a follow-up
      const embed = orangeEmbed('🎰 **BLACKJACK** 🎰', `Welcome to the high-stakes table!`);
      
      embed.addFields(
        { name: '💰 **Your Balance**', value: `**${balance.toLocaleString()}** coins`, inline: true },
        { name: '🎯 **Bet Limits**', value: `**${minBet.toLocaleString()}** - **${maxBet.toLocaleString()}** coins`, inline: true },
        { name: '🎲 **Game Rules**', value: 'Get as close to 21 as possible without going over. Beat the dealer to win!', inline: false }
      );
      
      embed.setFooter({ text: '💎 Premium Gaming Experience • Good luck!' });
      
      await interaction.followUp({ embeds: [embed] });

    } catch (err) {
      console.error('Blackjack error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to start Blackjack. Please try again.')]
      });
    }
  },
};
