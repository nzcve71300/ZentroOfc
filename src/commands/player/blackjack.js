const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { getServerByNickname, getActivePlayerByDiscordId, getPlayerBalance, ensureEconomyRecord } = require('../../utils/unifiedPlayerSystem');
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
    await interaction.deferReply();

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

      // Check if blackjack is enabled for this server
      const [toggleResult] = await pool.query(
        'SELECT setting_value FROM eco_games_config WHERE server_id = ? AND setting_name = "blackjack_toggle"',
        [server.id]
      );

      const blackjackEnabled = toggleResult.length > 0 ? toggleResult[0].setting_value === 'true' : true; // Default to true if not configured
      
      if (!blackjackEnabled) {
        return interaction.editReply({
          embeds: [errorEmbed('Game Disabled', 'Blackjack is currently disabled on this server. Please contact an administrator to enable it.')]
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

      // Ensure economy record exists
      await ensureEconomyRecord(player.id, player.guild_id);
      
      // Get balance
      const balance = await getPlayerBalance(player.id);

      // Get bet limits from eco_games_config table
      const [limitsResult] = await pool.query(
        'SELECT setting_name, setting_value FROM eco_games_config WHERE server_id = ? AND setting_name IN ("blackjack_min", "blackjack_max")',
        [server.id]
      );

      // Set default values if not configured
      let minBet = 50;
      let maxBet = 1000;

      // Parse the results
      limitsResult.forEach(row => {
        if (row.setting_name === 'blackjack_min') {
          minBet = parseInt(row.setting_value) || 50;
        } else if (row.setting_name === 'blackjack_max') {
          maxBet = parseInt(row.setting_value) || 1000;
        }
      });
      if (betAmount < minBet || betAmount > maxBet) {
        return interaction.editReply({
          embeds: [errorEmbed('Invalid Bet', `Bet must be between ${minBet.toLocaleString()} and ${maxBet.toLocaleString()} coins.`)]
        });
      }

      // Get currency name for this server
      const { getCurrencyName } = require('../../utils/economy');
      const currencyName = await getCurrencyName(server.id);
      
      if (balance < betAmount) {
        return interaction.editReply({
          embeds: [errorEmbed('Insufficient Balance', `You only have ${balance.toLocaleString()} ${currencyName}. Please bet less or earn more ${currencyName}.`)]
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
          'INSERT INTO transactions (player_id, amount, type, timestamp, guild_id) VALUES (?, ?, ?, NOW(), (SELECT guild_id FROM players WHERE id = ?))',
          [player.id, winnings - betAmount, 'blackjack', player.id]
        );

        const embed = orangeEmbed('🎰 **BLACKJACK WIN!** 🎰', 'Congratulations! You got a Blackjack!');
        embed.addFields(
          { name: '🎯 **Your Cards**', value: formatCards(playerCards), inline: true },
          { name: '🎯 **Dealer Cards**', value: formatCards(dealerCards), inline: true },
          { name: '💰 **Winnings**', value: `**${winnings.toLocaleString()}** ${currencyName}`, inline: true }
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
          return i.reply({ content: 'This is not your game!' });
        }

        const game = activeGames.get(gameId);
        if (!game || game.gameOver) {
          return i.reply({ content: 'Game has ended!' });
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
  // Make blackjack more difficult by favoring lower cards
  // This makes it harder to get good hands
  const weights = {
    1: 0.05,   // Ace - 5% chance (was 8%)
    2: 0.12,   // 2 - 12% chance (was 9%)
    3: 0.12,   // 3 - 12% chance (was 9%)
    4: 0.12,   // 4 - 12% chance (was 9%)
    5: 0.12,   // 5 - 12% chance (was 9%)
    6: 0.12,   // 6 - 12% chance (was 9%)
    7: 0.08,   // 7 - 8% chance (was 9%)
    8: 0.08,   // 8 - 8% chance (was 9%)
    9: 0.08,   // 9 - 8% chance (was 9%)
    10: 0.11   // 10 - 11% chance (was 20%) - includes J, Q, K
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
  
  // Get currency name for this server
  const { getCurrencyName } = require('../../utils/economy');
  const currencyName = await getCurrencyName(game.serverId);

  let gameResult, winnings = 0;

  if (result === 'bust') {
    gameResult = '❌ **BUST! You Lose!** ❌';
    winnings = 0;
  } else if (result === 'stand' || result === 'timeout') {
    // More aggressive dealer AI - dealer hits on soft 17 and below
    while (dealerTotal < 17 || (dealerTotal === 17 && hasSoft17(game.dealerCards))) {
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
    'INSERT INTO transactions (player_id, amount, type, timestamp, guild_id) VALUES (?, ?, ?, NOW(), (SELECT guild_id FROM players WHERE id = ?))',
    [game.playerId, winnings - game.betAmount, 'blackjack', game.playerId]
  );

  const finalEmbed = orangeEmbed('🎰 **BLACKJACK** 🎰', gameResult);
  finalEmbed.addFields(
    { name: '🎯 **Your Cards**', value: formatCards(game.playerCards), inline: true },
    { name: '🎯 **Dealer Cards**', value: formatCards(game.dealerCards), inline: true },
    { name: '💰 **Bet Amount**', value: `**${game.betAmount.toLocaleString()}** ${currencyName}`, inline: true }
  );

  const balanceText = winnings > game.betAmount 
    ? `**💰 Winnings:** +${(winnings - game.betAmount).toLocaleString()} ${currencyName}\n**💰 New Balance:** ${(game.balance + winnings).toLocaleString()} ${currencyName}`
    : winnings === game.betAmount
    ? `**🤝 Push:** Bet returned\n**💰 New Balance:** ${(game.balance + winnings).toLocaleString()} ${currencyName}`
    : `**💸 Loss:** -${game.betAmount.toLocaleString()} ${currencyName}\n**💰 New Balance:** ${game.balance.toLocaleString()} ${currencyName}`;

  finalEmbed.addFields({ name: '💰 **Result**', value: balanceText, inline: false });
  finalEmbed.setFooter({ text: '💎 Premium Gaming Experience • Good luck next time!' });

  await interaction.update({ embeds: [finalEmbed], components: [] });
}
