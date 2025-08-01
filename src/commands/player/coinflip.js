const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { getServerByNickname, getActivePlayerByDiscordId, getPlayerBalance } = require('../../utils/unifiedPlayerSystem');
const pool = require('../../db');

// Game state storage
const activeCoinflipGames = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Flip a coin and bet on heads or tails')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server to play on')
        .setRequired(true)
        .setAutocomplete(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount to bet')
        .setRequired(true)
        .setMinValue(1))
    .addStringOption(option =>
      option.setName('side')
        .setDescription('Choose heads or tails')
        .setRequired(true)
        .addChoices(
          { name: '🪙 Heads', value: 'heads' },
          { name: '🪙 Tails', value: 'tails' }
        )),

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
      console.error('Coinflip autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const serverOption = interaction.options.getString('server');
    const betAmount = interaction.options.getInteger('amount');
    const chosenSide = interaction.options.getString('side');

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
            'You must link your account using `/link <in-game-name>` before playing coinflip.'
          )]
        });
      }

      // Get balance
      const balance = await getPlayerBalance(player.id);

      // Get bet limits from eco_games table
      const [limitsResult] = await pool.query(
        'SELECT option_value FROM eco_games WHERE server_id = ? AND setup = "coinflip" AND option = "min_max_bet"',
        [server.id]
      );

      if (!limitsResult || limitsResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Configuration Error', 'Coinflip is not configured for this server.')]
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

      // Initialize coinflip game
      const gameId = `${userId}_${server.id}_${Date.now()}`;
      const gameState = {
        betAmount,
        chosenSide,
        playerId: player.id,
        serverId: server.id,
        guildId,
        userId,
        balance: balance - betAmount,
        gameOver: false,
        flipped: false
      };

      activeCoinflipGames.set(gameId, gameState);

      // Create initial game embed
      const embed = createCoinflipEmbed(gameState, server.nickname);
      const row = createCoinflipButtons(gameId);

      const reply = await interaction.editReply({ embeds: [embed], components: [row] });

      // Set up button collector
      const collector = reply.createMessageComponentCollector({ time: 30000 });

      collector.on('collect', async (i) => {
        if (i.user.id !== userId) {
          return i.reply({ content: 'This is not your game!' });
        }

        const game = activeCoinflipGames.get(gameId);
        if (!game || game.gameOver) {
          return i.reply({ content: 'Game has ended!' });
        }

        if (i.customId === `flip_${gameId}`) {
          // Flip the coin
          await flipCoin(game, i, server.nickname);
        }
      });

      collector.on('end', () => {
        const game = activeCoinflipGames.get(gameId);
        if (game && !game.gameOver) {
          // Timeout - auto flip
          flipCoin(game, interaction, server.nickname);
        }
        activeCoinflipGames.delete(gameId);
      });

    } catch (err) {
      console.error('Coinflip error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to process Coinflip game. Please try again.')]
      });
    }
  }
};

// Helper functions
function createCoinflipEmbed(game, serverName) {
  const embed = orangeEmbed('🪙 **COINFLIP** 🪙', `Ready to flip on **${serverName}**`);
  
  embed.addFields(
    { name: '💰 **Bet Amount**', value: `**${game.betAmount.toLocaleString()}** coins`, inline: true },
    { name: '🎯 **Your Choice**', value: `**${game.chosenSide.toUpperCase()}**`, inline: true },
    { name: '🎲 **Current Balance**', value: `**${game.balance.toLocaleString()}** coins`, inline: true }
  );

  if (!game.flipped) {
    embed.addFields(
      { name: '🪙 **Coin Status**', value: '```\n    ╭─────────╮\n    │  🪙  │\n    │ COIN │\n    │  🪙  │\n    ╰─────────╯\n```', inline: false }
    );
  }

  embed.setFooter({ text: '💎 Premium Gaming Experience • Flip to win big!' });
  return embed;
}

function createCoinflipButtons(gameId) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`flip_${gameId}`)
        .setLabel('Flip Coin')
        .setEmoji('🪙')
        .setStyle(ButtonStyle.Primary)
    );
}

async function flipCoin(game, interaction, serverName) {
  game.gameOver = true;
  game.flipped = true;

  // Flip the coin (50/50 chance)
  const result = Math.random() < 0.5 ? 'heads' : 'tails';
  const won = game.chosenSide === result;
  const winnings = won ? game.betAmount * 2 : 0;

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
    [game.playerId, winnings - game.betAmount, 'coinflip']
  );

  // Create rich 3D coin result
  const coinDisplay = create3DCoin(result);
  
  const embed = orangeEmbed('🪙 **COINFLIP RESULT** 🪙', won ? '🎉 **YOU WIN!** 🎉' : '❌ **YOU LOSE!** ❌');
  
  embed.addFields(
    { name: '🪙 **Coin Result**', value: coinDisplay, inline: false },
    { name: '🎯 **Your Choice**', value: `**${game.chosenSide.toUpperCase()}**`, inline: true },
    { name: '🪙 **Landed On**', value: `**${result.toUpperCase()}**`, inline: true },
    { name: '💰 **Bet Amount**', value: `**${game.betAmount.toLocaleString()}** coins`, inline: true }
  );

  if (won) {
    embed.addFields(
      { name: '🎉 **Winnings**', value: `**+${game.betAmount.toLocaleString()}** coins`, inline: true },
      { name: '💰 **New Balance**', value: `**${(game.balance + winnings).toLocaleString()}** coins`, inline: true }
    );
  } else {
    embed.addFields(
      { name: '💸 **Loss**', value: `**-${game.betAmount.toLocaleString()}** coins`, inline: true },
      { name: '💰 **New Balance**', value: `**${game.balance.toLocaleString()}** coins`, inline: true }
    );
  }

  embed.setFooter({ text: '💎 Premium Gaming Experience • Thanks for playing!' });

  await interaction.update({ embeds: [embed], components: [] });
}

function create3DCoin(side) {
  const coinSymbol = side === 'heads' ? '🪙' : '🪙';
  const sideText = side.toUpperCase();
  
  return `\`\`\`
    ╭─────────────────╮
    │                 │
    │    ${coinSymbol} ${coinSymbol} ${coinSymbol}    │
    │                 │
    │   ${sideText.padStart(6, ' ')}   │
    │                 │
    │    ${coinSymbol} ${coinSymbol} ${coinSymbol}    │
    │                 │
    ╰─────────────────╯
\`\`\``;
} 