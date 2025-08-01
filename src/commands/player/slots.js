const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { getServerByNickname, getActivePlayerByDiscordId, getPlayerBalance } = require('../../utils/unifiedPlayerSystem');
const pool = require('../../db');

// Game state storage
const activeSlotsGames = new Map();

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

      // Initialize slots game
      const gameId = `${userId}_${server.id}_${Date.now()}`;
      const gameState = {
        betAmount,
        playerId: player.id,
        serverId: server.id,
        guildId,
        userId,
        balance: balance - betAmount,
        gameOver: false,
        spins: 0,
        maxSpins: 3
      };

      activeSlotsGames.set(gameId, gameState);

      // Create initial game embed
      const embed = createSlotsEmbed(gameState, server.nickname);
      const row = createSlotsButtons(gameId);

      const reply = await interaction.editReply({ embeds: [embed], components: [row] });

      // Set up button collector
      const collector = reply.createMessageComponentCollector({ time: 120000 });

      collector.on('collect', async (i) => {
        if (i.user.id !== userId) {
          return i.reply({ content: 'This is not your game!' });
        }

        const game = activeSlotsGames.get(gameId);
        if (!game || game.gameOver) {
          return i.reply({ content: 'Game has ended!' });
        }

        if (i.customId === `spin_${gameId}`) {
          // Spin the slots
          await spinSlots(game, i, server.nickname);
        } else if (i.customId === `cashout_${gameId}`) {
          // Cash out
          await cashoutSlots(game, i, server.nickname);
        }
      });

      collector.on('end', () => {
        const game = activeSlotsGames.get(gameId);
        if (game && !game.gameOver) {
          // Timeout - auto cashout
          cashoutSlots(game, interaction, server.nickname);
        }
        activeSlotsGames.delete(gameId);
      });

    } catch (err) {
      console.error('Slots error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to process Slots game. Please try again.')]
      });
    }
  }
};

// Helper functions
function createSlotsEmbed(game, serverName) {
  const embed = orangeEmbed('🎰 **SLOTS** 🎰', `Ready to spin on **${serverName}**`);
  
  embed.addFields(
    { name: '💰 **Bet Amount**', value: `**${game.betAmount.toLocaleString()}** coins`, inline: true },
    { name: '🎯 **Spins Left**', value: `**${game.maxSpins - game.spins}**`, inline: true },
    { name: '🎲 **Current Balance**', value: `**${game.balance.toLocaleString()}** coins`, inline: true }
  );

  if (game.spins > 0) {
    embed.addFields(
      { name: '🎰 **Last Spin**', value: game.lastSpin || 'No spins yet', inline: false }
    );
  }

  embed.setFooter({ text: '💎 Premium Gaming Experience • Spin to win big!' });
  return embed;
}

function createSlotsButtons(gameId) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`spin_${gameId}`)
        .setLabel('Spin')
        .setEmoji('🎰')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`cashout_${gameId}`)
        .setLabel('Cash Out')
        .setEmoji('💰')
        .setStyle(ButtonStyle.Success)
    );
}

async function spinSlots(game, interaction, serverName) {
  if (game.spins >= game.maxSpins) {
    return interaction.reply({ content: 'No spins left! Cash out to end the game.' });
  }

  // Spin the slots
  const symbols = ['🍎', '🍊', '🍇', '🍒', '💎', '7️⃣'];
  const reel1 = symbols[Math.floor(Math.random() * symbols.length)];
  const reel2 = symbols[Math.floor(Math.random() * symbols.length)];
  const reel3 = symbols[Math.floor(Math.random() * symbols.length)];

  let result, winnings = 0;

  if (reel1 === reel2 && reel2 === reel3) {
    if (reel1 === '💎') {
      result = '🎰 **JACKPOT! Triple Diamonds!** 🎰';
      winnings = game.betAmount * 10;
    } else if (reel1 === '7️⃣') {
      result = '🍀 **Lucky Sevens!** 🍀';
      winnings = game.betAmount * 5;
    } else {
      result = '🎯 **Triple Match!** 🎯';
      winnings = game.betAmount * 3;
    }
  } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
    result = '🎯 **Double Match!** 🎯';
    winnings = game.betAmount * 2;
  } else {
    result = '❌ **No Match!** ❌';
    winnings = 0;
  }

  // Update game state
  game.spins++;
  game.balance += winnings;
  game.lastSpin = `${reel1} | ${reel2} | ${reel3} - ${result}`;

  // Update balance in database
  if (winnings > 0) {
    await pool.query(
      'UPDATE economy SET balance = balance + ? WHERE player_id = ?',
      [winnings, game.playerId]
    );
  }

  // Record transaction
  await pool.query(
    'INSERT INTO transactions (player_id, amount, type, timestamp) VALUES (?, ?, ?, NOW())',
    [game.playerId, winnings, 'slots']
  );

  // Create updated embed
  const embed = orangeEmbed('🎰 **SLOTS** 🎰', `Spin ${game.spins} on **${serverName}**`);
  
  embed.addFields(
    { name: '🎰 **Reels**', value: `${reel1} | ${reel2} | ${reel3}`, inline: false },
    { name: '🎯 **Result**', value: result, inline: false },
    { name: '💰 **This Spin**', value: winnings > 0 ? `+${winnings.toLocaleString()} coins` : 'No win', inline: true },
    { name: '💰 **Total Balance**', value: `${game.balance.toLocaleString()} coins`, inline: true },
    { name: '🎯 **Spins Left**', value: `${game.maxSpins - game.spins}`, inline: true }
  );

  embed.setFooter({ text: '💎 Premium Gaming Experience • Keep spinning or cash out!' });

  // Update buttons based on remaining spins
  // Extract gameId from the original game state
  const gameId = Object.keys(activeSlotsGames).find(id => activeSlotsGames.get(id) === game);
  const row = game.spins >= game.maxSpins 
    ? new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`cashout_${gameId}`)
          .setLabel('Cash Out')
          .setEmoji('💰')
          .setStyle(ButtonStyle.Success)
      )
    : createSlotsButtons(gameId);

  await interaction.update({ embeds: [embed], components: [row] });
}

async function cashoutSlots(game, interaction, serverName) {
  game.gameOver = true;

  const embed = orangeEmbed('🎰 **SLOTS CASHOUT** 🎰', `Game ended on **${serverName}**`);
  
  embed.addFields(
    { name: '💰 **Final Balance**', value: `${game.balance.toLocaleString()} coins`, inline: true },
    { name: '🎯 **Total Spins**', value: `${game.spins}`, inline: true },
    { name: '🎰 **Total Winnings**', value: `${(game.balance - (game.balance - game.betAmount * game.spins)).toLocaleString()} coins`, inline: true }
  );

  if (game.lastSpin) {
    embed.addFields(
      { name: '🎰 **Last Spin**', value: game.lastSpin, inline: false }
    );
  }

  embed.setFooter({ text: '💎 Premium Gaming Experience • Thanks for playing!' });

  await interaction.update({ embeds: [embed], components: [] });
}
