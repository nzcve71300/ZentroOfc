const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { getServerByNickname, getActivePlayerByDiscordId, getPlayerBalance } = require('../../utils/unifiedPlayerSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Play slots with your coins')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server to play on')
        .setRequired(true)
        .setAutocomplete(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount to bet')
        .setRequired(true)
        .setMinValue(1)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [servers] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ?',
        [guildId, `%${focusedValue}%`]
      );

      await interaction.respond(
        servers.map(server => ({ name: server.nickname, value: server.nickname }))
      );
    } catch (error) {
      console.error('Slots autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const serverOption = interaction.options.getString('server');
    const betAmount = interaction.options.getInteger('amount');

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
            'You must link your account using `/link <in-game-name>` before playing slots.'
          )]
        });
      }

      // Get balance
      const balance = await getPlayerBalance(player.id);

      // Get bet limits from eco_games table
      const [limitsResult] = await pool.query(
        'SELECT option_value FROM eco_games WHERE server_id = ? AND setup = "slots" AND option = "min_max_bet"',
        [server.id]
      );

      if (!limitsResult || limitsResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Configuration Error', 'Slots is not configured for this server.')]
        });
      }

      const [minBet, maxBet] = limitsResult[0].option_value.split(',').map(Number);
      if (betAmount < minBet || betAmount > maxBet) {
        return interaction.editReply({
          embeds: [errorEmbed('Invalid Bet', `Bet must be between ${minBet.toLocaleString()} and ${maxBet.toLocaleString()} coins.`)]
        });
      }

      if (balance < betAmount) {
        return interaction.editReply({
          embeds: [errorEmbed('Insufficient Balance', `You only have ${balance.toLocaleString()} coins. Please bet less or earn more coins.`)]
        });
      }

      // Deduct bet from balance
      await pool.query(
        'UPDATE economy SET balance = balance - ? WHERE player_id = ?',
        [betAmount, player.id]
      );

      // Simple slots game logic
      const symbols = ['🍎', '🍊', '🍇', '🍒', '💎', '7️⃣'];
      const reel1 = symbols[Math.floor(Math.random() * symbols.length)];
      const reel2 = symbols[Math.floor(Math.random() * symbols.length)];
      const reel3 = symbols[Math.floor(Math.random() * symbols.length)];

      let result, winnings = 0;

      if (reel1 === reel2 && reel2 === reel3) {
        if (reel1 === '💎') {
          result = '🎰 **JACKPOT! Triple Diamonds!** 🎰';
          winnings = betAmount * 10;
        } else if (reel1 === '7️⃣') {
          result = '🍀 **Lucky Sevens!** 🍀';
          winnings = betAmount * 5;
        } else {
          result = '🎯 **Triple Match!** 🎯';
          winnings = betAmount * 3;
        }
      } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
        result = '🎯 **Double Match!** 🎯';
        winnings = betAmount * 2;
      } else {
        result = '❌ **No Match!** ❌';
        winnings = 0;
      }

      // Update balance with winnings
      if (winnings > 0) {
        await pool.query(
          'UPDATE economy SET balance = balance + ? WHERE player_id = ?',
          [winnings, player.id]
        );
      }

      // Record transaction
      await pool.query(
        'INSERT INTO transactions (player_id, amount, type, timestamp) VALUES (?, ?, ?, NOW())',
        [player.id, winnings - betAmount, 'slots']
      );

      const gameText = `**Reels:** ${reel1} | ${reel2} | ${reel3}`;
      const balanceText = winnings > 0 
        ? `**💰 Winnings:** +${winnings.toLocaleString()} coins\n**💰 New Balance:** ${(balance + winnings - betAmount).toLocaleString()} coins`
        : `**💸 Loss:** -${betAmount.toLocaleString()} coins\n**💰 New Balance:** ${(balance - betAmount).toLocaleString()} coins`;

      const embed = orangeEmbed('🎰 **SLOTS** 🎰', `${result}\n\n${gameText}\n\n${balanceText}`);
      embed.setFooter({ text: '💎 Premium Gaming Experience • May the odds be ever in your favor!' });

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Slots error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to process Slots game. Please try again.')]
      });
    }
  }
};
