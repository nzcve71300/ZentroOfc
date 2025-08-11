const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { getServerByNickname, getActivePlayerByDiscordId, getPlayerBalance } = require('../../utils/unifiedPlayerSystem');
const pool = require('../../db');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

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

      // Check if coinflip is enabled for this server
      const [toggleResult] = await pool.query(
        'SELECT setting_value FROM eco_games_config WHERE server_id = ? AND setting_name = "coinflip_toggle"',
        [server.id]
      );

      const coinflipEnabled = toggleResult.length > 0 ? toggleResult[0].setting_value === 'true' : true; // Default to true if not configured
      
      if (!coinflipEnabled) {
        return interaction.editReply({
          embeds: [errorEmbed('Game Disabled', 'Coinflip is currently disabled on this server. Please contact an administrator to enable it.')]
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

      // Get bet limits from eco_games_config table
      const [limitsResult] = await pool.query(
        'SELECT setting_name, setting_value FROM eco_games_config WHERE server_id = ? AND setting_name IN ("coinflip_min", "coinflip_max")',
        [server.id]
      );

      // Set default values if not configured
      let minBet = 50;
      let maxBet = 1000;

      // Parse the results
      limitsResult.forEach(row => {
        if (row.setting_name === 'coinflip_min') {
          minBet = parseInt(row.setting_value) || 50;
        } else if (row.setting_name === 'coinflip_max') {
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
        currencyName,
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
           // Defer the button interaction first
           await i.deferUpdate();
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
    { name: '💰 **Bet Amount**', value: `**${game.betAmount.toLocaleString()}** ${game.currencyName || 'coins'}`, inline: true },
    { name: '🎯 **Your Choice**', value: `**${game.chosenSide.toUpperCase()}**`, inline: true },
    { name: '🎲 **Current Balance**', value: `**${game.balance.toLocaleString()}** ${game.currencyName || 'coins'}`, inline: true }
  );

  if (!game.flipped) {
    embed.addFields(
      { name: '🪙 **Coin Status**', value: createCoinDisplay(), inline: false }
    );
  }

  embed.setFooter({ text: '💎 Premium Gaming Experience • Flip to win big!' });
  return embed;
}

function createCoinDisplay() {
  return `\`\`\`
    ╭─────────────────╮
    │  ████████████  │
    │ ██████████████ │
    │ ████  ██████ │
    │ ████ COIN ████ │
    │ ████  ██████ │
    │ ██████████████ │
    │  ████████████  │
    ╰─────────────────╯
\`\`\``;
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

  // Get difficulty settings from database
  const [settingsResult] = await pool.query(
    'SELECT setting_name, setting_value FROM eco_games_config WHERE server_id = ? AND setting_name IN ("coinflip_win_probability", "coinflip_payout_multiplier")',
    [game.serverId]
  );

  // Default to harder settings if not configured
  let winProbability = 0.35; // 35% win chance (was 42%)
  let payoutMultiplier = 1.5; // 1.5x payout (was 1.7)

  // Parse settings from database
  settingsResult.forEach(row => {
    if (row.setting_name === 'coinflip_win_probability') {
      winProbability = parseFloat(row.setting_value);
    } else if (row.setting_name === 'coinflip_payout_multiplier') {
      payoutMultiplier = parseFloat(row.setting_value);
    }
  });

  // Flip the coin with configured difficulty
  const result = Math.random() < winProbability ? 'heads' : 'tails';
  const won = game.chosenSide === result;
  const winnings = won ? Math.floor(game.betAmount * payoutMultiplier) : 0;

  // Show spinning animation for 6 seconds
  await showSpinningAnimation(interaction, game, serverName, result);

  // Wait 6 seconds for the spinning effect
  await new Promise(resolve => setTimeout(resolve, 6000));

  // Update balance in database
  if (winnings > 0) {
    await pool.query(
      'UPDATE economy SET balance = balance + ? WHERE player_id = ?',
      [winnings, game.playerId]
    );
  }

  // Record transaction
  await pool.query(
    'INSERT INTO transactions (player_id, amount, type, timestamp, guild_id) VALUES (?, ?, ?, NOW(), (SELECT guild_id FROM players WHERE id = ?))',
    [game.playerId, winnings - game.betAmount, 'coinflip', game.playerId]
  );
}

async function showSpinningAnimation(interaction, game, serverName, result) {
  try {
    // Create spinning coin frames
    const spinningFrames = await createSpinningCoinFrames();
    
    // Show the spinning animation first
    const spinningEmbed = orangeEmbed('🪙 **COINFLIP** 🪙', '🔄 **Spinning the coin...**');
    
    spinningEmbed.addFields(
      { name: '💰 **Bet Amount**', value: `**${game.betAmount.toLocaleString()}** ${game.currencyName}`, inline: true },
      { name: '🎯 **Your Choice**', value: `**${game.chosenSide.toUpperCase()}**`, inline: true },
      { name: '🎲 **Current Balance**', value: `**${game.balance.toLocaleString()}** ${game.currencyName}`, inline: true }
    );

         // Use the first frame as main image for spinning effect
     if (spinningFrames.length > 0) {
       const attachment = new AttachmentBuilder(spinningFrames[0], { name: 'spinning_coin.png' });
       spinningEmbed.setImage('attachment://spinning_coin.png');
       
       await interaction.editReply({ 
         embeds: [spinningEmbed], 
         components: [],
         files: [attachment]
       });
     } else {
      await interaction.editReply({ embeds: [spinningEmbed], components: [] });
    }

    // Wait 6 seconds, then show the result with the same image
    setTimeout(async () => {
      const won = game.chosenSide === result;
      const winnings = won ? Math.floor(game.betAmount * 1.5) : 0;
      
      // Create result embed with same image
      const resultEmbed = orangeEmbed('🪙 **COINFLIP RESULT** 🪙', won ? '🎉 **YOU WIN!** 🎉' : '❌ **YOU LOSE!** ❌');
      
      resultEmbed.addFields(
        { name: '🪙 **Coin Result**', value: create3DCoin(result), inline: false },
        { name: '🎯 **Your Choice**', value: `**${game.chosenSide.toUpperCase()}**`, inline: true },
        { name: '🪙 **Landed On**', value: `**${result.toUpperCase()}**`, inline: true },
        { name: '💰 **Bet Amount**', value: `**${game.betAmount.toLocaleString()}** ${game.currencyName}`, inline: true }
      );

      if (won) {
        resultEmbed.addFields(
          { name: '🎉 **Winnings**', value: `**+${winnings.toLocaleString()}** ${game.currencyName}`, inline: true },
          { name: '💰 **New Balance**', value: `**${(game.balance + winnings).toLocaleString()}** ${game.currencyName}`, inline: true }
        );
      } else {
        resultEmbed.addFields(
          { name: '💸 **Loss**', value: `**-${game.betAmount.toLocaleString()}** ${game.currencyName}`, inline: true },
          { name: '💰 **New Balance**', value: `**${game.balance.toLocaleString()}** ${game.currencyName}`, inline: true }
        );
      }

      resultEmbed.setFooter({ text: '💎 Premium Gaming Experience • Thanks for playing!' });

             // Keep the same image attachment
       if (spinningFrames.length > 0) {
         const attachment = new AttachmentBuilder(spinningFrames[0], { name: 'spinning_coin.png' });
         resultEmbed.setImage('attachment://spinning_coin.png');
         
         await interaction.editReply({ 
           embeds: [resultEmbed], 
           components: [],
           files: [attachment]
         });
       } else {
        await interaction.editReply({ embeds: [resultEmbed], components: [] });
      }
    }, 6000);

  } catch (error) {
    console.error('Error showing spinning animation:', error);
    // Fallback to regular coin display
    const embed = orangeEmbed('🪙 **COINFLIP** 🪙', '🔄 **Spinning the coin...**');
    embed.addFields(
      { name: '💰 **Bet Amount**', value: `**${game.betAmount.toLocaleString()}** ${game.currencyName}`, inline: true },
      { name: '🎯 **Your Choice**', value: `**${game.chosenSide.toUpperCase()}**`, inline: true },
      { name: '🎲 **Current Balance**', value: `**${game.balance.toLocaleString()}** ${game.currencyName}`, inline: true }
    );
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

async function createSpinningCoinFrames() {
     try {
     const frames = [];
     const canvas = createCanvas(400, 400);
     const ctx = canvas.getContext('2d');
    
              // Try to load the delivery confirmation image
     const imagePath = path.join(__dirname, '..', '..', '..', 'assets', 'images', 'delivery_confirmation.png');
     
     console.log('[COINFLIP] Looking for image at:', imagePath);
     console.log('[COINFLIP] Image exists:', fs.existsSync(imagePath));
     
     if (!fs.existsSync(imagePath)) {
       console.log('Delivery confirmation image not found, using default coin');
       return [];
     }

    const baseImage = await loadImage(imagePath);
    
    // Create 8 frames of spinning animation
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI / 4); // 45 degree increments
      
             // Clear canvas
       ctx.clearRect(0, 0, 400, 400);
       
       // Save context
       ctx.save();
       
       // Move to center
       ctx.translate(200, 200);
      
      // Rotate
      ctx.rotate(angle);
      
             // Scale down the image to fit in the coin size
       const scale = 0.6;
       ctx.scale(scale, scale);
      
      // Draw the image centered
      ctx.drawImage(baseImage, -baseImage.width / 2, -baseImage.height / 2);
      
      // Restore context
      ctx.restore();
      
             // Add "HEADS" or "TAILS" text overlay
       ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
       ctx.fillRect(0, 0, 400, 400);
       
       ctx.fillStyle = '#FFD700';
       ctx.font = 'bold 48px Arial';
       ctx.textAlign = 'center';
       ctx.textBaseline = 'middle';
       
       // Alternate between HEADS and TAILS for spinning effect
       const text = i % 2 === 0 ? 'HEADS' : 'TAILS';
       ctx.fillText(text, 200, 200);
       
       // Add coin border
       ctx.strokeStyle = '#FFD700';
       ctx.lineWidth = 6;
       ctx.beginPath();
       ctx.arc(200, 200, 190, 0, 2 * Math.PI);
       ctx.stroke();
      
      // Convert to buffer
      const buffer = canvas.toBuffer('image/png');
      frames.push(buffer);
    }
    
    return frames;
  } catch (error) {
    console.error('Error creating spinning coin frames:', error);
    return [];
  }
}

function create3DCoin(side) {
  const sideText = side.toUpperCase();
  const coinSymbol = '🪙';
  
  return `\`\`\`
    ╭─────────────────╮
    │  ████████████  │
    │ ██████████████ │
    │ ████  ██████ │
    │ ████ ${sideText.padStart(6, ' ')} ████ │
    │ ████  ██████ │
    │ ██████████████ │
    │  ████████████  │
    ╰─────────────────╯
\`\`\``;
} 