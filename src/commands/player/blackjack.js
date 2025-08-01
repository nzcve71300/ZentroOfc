const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { getServerByNickname, getActivePlayerByDiscordId, getPlayerBalance } = require('../../utils/unifiedPlayerSystem');
const pool = require('../../db');

// Game state storage
const activeGames = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Play blackjack with your coins')
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
      console.error('Blackjack autocomplete error:', error);
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
            'You must link your account using `/link <in-game-name>` before playing blackjack.'
          )]
        });
      }

      // Get balance
      const balance = await getPlayerBalance(player.id);

      // Get bet limits from eco_games table
      const [limitsResult] = await pool.query(
        'SELECT option_value FROM eco_games WHERE server_id = ? AND setup = "blackjack" AND option = "min_max_bet"',
        [server.id]
      );

      if (!limitsResult || limitsResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Configuration Error', 'Blackjack is not configured for this server.')]
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

      // Initialize game
      const gameId = `${userId}_${server.id}_${Date.now()}`;
      const playerCards = [drawCard(), drawCard()];
      const dealerCards = [drawCard(), drawCard()];
      
      const gameState = {
        playerCards,
        dealerCards,
        betAmount,
        playerId: player.id,
        serverId: server.id,
        guildId,
        userId,
        balance: balance - betAmount,
        gameOver: false
      };

      activeGames.set(gameId, gameState);

      // Check for blackjack
      const playerTotal = calculateHandValue(playerCards);
      if (playerTotal === 21) {
        const winnings = Math.floor(betAmount * 2.5);
        await pool.query(
          'UPDATE economy SET balance = balance + ? WHERE player_id = ?',
          [winnings, player.id]
        );
        await pool.query(
          'INSERT INTO transactions (player_id, amount, type, timestamp) VALUES (?, ?, ?, NOW())',
          [player.id, winnings - betAmount, 'blackjack']
        );

        const embed = orangeEmbed('🎰 **BLACKJACK WIN!** 🎰', 'Congratulations! You got a Blackjack!');
        embed.addFields(
          { name: '🎯 **Your Cards**', value: formatCards(playerCards), inline: true },
          { name: '🎯 **Dealer Cards**', value: formatCards(dealerCards), inline: true },
          { name: '💰 **Winnings**', value: `**${winnings.toLocaleString()}** coins`, inline: true }
        );
        embed.setFooter({ text: '💎 Premium Gaming Experience • Blackjack pays 2.5x!' });

        return interaction.editReply({ embeds: [embed] });
      }

      // Create game embed
      const embed = createGameEmbed(gameState, server.nickname, false);
      const row = createGameButtons(gameId);

      const reply = await interaction.editReply({ embeds: [embed], components: [row] });

      // Set up button collector
      const collector = reply.createMessageComponentCollector({ time: 60000 });

      collector.on('collect', async (i) => {
        if (i.user.id !== userId) {
          return i.reply({ content: 'This is not your game!', ephemeral: true });
        }

        const game = activeGames.get(gameId);
        if (!game || game.gameOver) {
          return i.reply({ content: 'Game has ended!', ephemeral: true });
        }

        if (i.customId === `hit_${gameId}`) {
          // Hit
          game.playerCards.push(drawCard());
          const playerTotal = calculateHandValue(game.playerCards);

          if (playerTotal > 21) {
            // Bust
            await endGame(game, 'bust', i);
          } else {
            // Continue game
            const updatedEmbed = createGameEmbed(game, server.nickname, false);
            await i.update({ embeds: [updatedEmbed], components: [row] });
          }
              } else if (i.customId === `stand_${gameId}`) {
        // Stand - dealer plays with improved AI
        await endGame(game, 'stand', i);
      }
      });

      collector.on('end', () => {
        const game = activeGames.get(gameId);
        if (game && !game.gameOver) {
          // Timeout - auto stand
          endGame(game, 'timeout', interaction);
        }
        activeGames.delete(gameId);
      });

    } catch (err) {
      console.error('Blackjack error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to process Blackjack game. Please try again.')]
      });
    }
  }
};

// Helper functions
function drawCard() {
  // Make blackjack less difficult by using more balanced card distribution
  // More balanced distribution for better player odds
  const weights = {
    1: 0.08,   // Ace - 8% chance (was 5%)
    2: 0.09,   // 2 - 9% chance (was 12%)
    3: 0.09,   // 3 - 9% chance (was 12%)
    4: 0.09,   // 4 - 9% chance (was 12%)
    5: 0.09,   // 5 - 9% chance (was 12%)
    6: 0.09,   // 6 - 9% chance (was 12%)
    7: 0.09,   // 7 - 9% chance (was 8%)
    8: 0.09,   // 8 - 9% chance (was 8%)
    9: 0.09,   // 9 - 9% chance (was 8%)
    10: 0.20   // 10 - 20% chance (was 7%) - includes J, Q, K
  };
  
  const random = Math.random();
  let cumulative = 0;
  
  for (let card = 1; card <= 10; card++) {
    cumulative += weights[card];
    if (random <= cumulative) {
      return card;
    }
  }
  
  return 10; // Default to 10 if something goes wrong
}

function calculateHandValue(cards) {
  return cards.reduce((sum, card) => sum + card, 0);
}

function hasSoft17(cards) {
  // Check if dealer has a soft 17 (Ace + 6 or Ace + Ace + 5, etc.)
  const aces = cards.filter(card => card === 1).length;
  const nonAces = cards.filter(card => card !== 1);
  const nonAceSum = nonAces.reduce((sum, card) => sum + card, 0);
  
  // If we have aces and the total could be 17 with aces counting as 1
  return aces > 0 && (nonAceSum + aces === 17);
}

function formatCards(cards) {
  return cards.join(', ') + ` (${calculateHandValue(cards)})`;
}

function createGameEmbed(game, serverName, showDealerCards = false) {
  const playerTotal = calculateHandValue(game.playerCards);
  const dealerTotal = calculateHandValue(game.dealerCards);
  
  const embed = orangeEmbed('🎰 **BLACKJACK** 🎰', `Your turn on **${serverName}**`);
  
  embed.addFields(
    { name: '🎯 **Your Cards**', value: formatCards(game.playerCards), inline: true },
    { name: '🎯 **Dealer Cards**', value: showDealerCards ? formatCards(game.dealerCards) : `${game.dealerCards[0]}, ?`, inline: true },
    { name: '💰 **Bet Amount**', value: `**${game.betAmount.toLocaleString()}** coins`, inline: true }
  );

  if (showDealerCards) {
    embed.addFields(
      { name: '🎯 **Your Total**', value: `**${playerTotal}**`, inline: true },
      { name: '🎯 **Dealer Total**', value: `**${dealerTotal}**`, inline: true }
    );
  } else {
    embed.addFields(
      { name: '🎯 **Your Total**', value: `**${playerTotal}**`, inline: true }
    );
  }

  embed.setFooter({ text: '💎 Premium Gaming Experience • React with 🎯 to Hit or 🛑 to Stand' });
  return embed;
}

function createGameButtons(gameId) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`hit_${gameId}`)
        .setLabel('Hit')
        .setEmoji('🎯')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`stand_${gameId}`)
        .setLabel('Stand')
        .setEmoji('🛑')
        .setStyle(ButtonStyle.Secondary)
    );
}

async function endGame(game, result, interaction) {
  game.gameOver = true;
  const playerTotal = calculateHandValue(game.playerCards);
  let dealerTotal = calculateHandValue(game.dealerCards);

  let gameResult, winnings = 0;

  if (result === 'bust') {
    gameResult = '❌ **BUST! You Lose!** ❌';
    winnings = 0;
  } else if (result === 'stand' || result === 'timeout') {
    // Improved dealer AI - dealer hits on 16 and below (stands on soft 17)
    while (dealerTotal < 17) {
      const newCard = drawCard();
      game.dealerCards.push(newCard);
      dealerTotal = calculateHandValue(game.dealerCards);
    }
    
    if (dealerTotal > 21) {
      gameResult = '💥 **Dealer Bust! You Win!** 💥';
      winnings = game.betAmount * 2;
    } else if (playerTotal > dealerTotal) {
      gameResult = '🎯 **You Win!** 🎯';
      winnings = game.betAmount * 2;
    } else if (playerTotal < dealerTotal) {
      gameResult = '❌ **Dealer Wins!** ❌';
      winnings = 0;
    } else {
      gameResult = '🤝 **Push!** 🤝';
      winnings = game.betAmount; // Return bet
    }
  }

  // Update balance
  if (winnings > 0) {
    await pool.query(
      'UPDATE economy SET balance = balance + ? WHERE player_id = ?',
      [winnings, game.playerId]
    );
  }

  // Record transaction
  await pool.query(
    'INSERT INTO transactions (player_id, amount, type, timestamp) VALUES (?, ?, ?, NOW())',
    [game.playerId, winnings - game.betAmount, 'blackjack']
  );

  const finalEmbed = orangeEmbed('🎰 **BLACKJACK** 🎰', gameResult);
  finalEmbed.addFields(
    { name: '🎯 **Your Cards**', value: formatCards(game.playerCards), inline: true },
    { name: '🎯 **Dealer Cards**', value: formatCards(game.dealerCards), inline: true },
    { name: '💰 **Bet Amount**', value: `**${game.betAmount.toLocaleString()}** coins`, inline: true }
  );

  const balanceText = winnings > game.betAmount 
    ? `**💰 Winnings:** +${(winnings - game.betAmount).toLocaleString()} coins\n**💰 New Balance:** ${(game.balance + winnings).toLocaleString()} coins`
    : winnings === game.betAmount
    ? `**🤝 Push:** Bet returned\n**💰 New Balance:** ${(game.balance + winnings).toLocaleString()} coins`
    : `**💸 Loss:** -${game.betAmount.toLocaleString()} coins\n**💰 New Balance:** ${game.balance.toLocaleString()} coins`;

  finalEmbed.addFields({ name: '💰 **Result**', value: balanceText, inline: false });
  finalEmbed.setFooter({ text: '💎 Premium Gaming Experience • Good luck next time!' });

  await interaction.update({ embeds: [finalEmbed], components: [] });
}
