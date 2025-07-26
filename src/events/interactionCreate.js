const { Events } = require('discord.js');
const { orangeEmbed } = require('../embeds/format');
const pool = require('../db');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // Handle autocomplete
    if (interaction.isAutocomplete()) {
      const command = require('../index').client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;
      
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error('Autocomplete error:', error);
        await interaction.respond([]);
      }
      return;
    }

    // Handle modals
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'blackjack_bet') {
        await handleBlackjackBet(interaction);
      } else if (interaction.customId === 'slots_bet') {
        await handleSlotsBet(interaction);
      }
      return;
    }

    // Handle shop dropdown selection
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('shop_')) {
        await handleShopCategory(interaction);
      } else if (interaction.customId.startsWith('category_')) {
        await handleShopItems(interaction);
      } else if (interaction.customId.startsWith('purchase_')) {
        await handlePurchase(interaction);
      }
    }

    // Handle button clicks
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('confirm_purchase_')) {
        await handleConfirmPurchase(interaction);
      } else if (interaction.customId.startsWith('cancel_purchase_')) {
        await handleCancelPurchase(interaction);
      }
    }
  },
};

async function handleBlackjackBet(interaction) {
  await interaction.deferReply();
  
  const betAmount = parseInt(interaction.fields.getTextInputValue('bet_amount'));
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  if (isNaN(betAmount) || betAmount <= 0) {
    return interaction.editReply(orangeEmbed('Error', 'Invalid bet amount. Please enter a positive number.'));
  }

  try {
    // Check player balance
    const balanceResult = await pool.query(
      `SELECT rs.nickname, e.balance, p.id as player_id
       FROM players p
       JOIN economy e ON p.id = e.player_id
       JOIN rust_servers rs ON p.server_id = rs.id
       JOIN guilds g ON rs.guild_id = g.id
       WHERE p.discord_id = $1 AND g.discord_id = $2 AND e.balance >= $3
       ORDER BY e.balance DESC
       LIMIT 1`,
      [userId, guildId, betAmount]
    );

    if (balanceResult.rows.length === 0) {
      return interaction.editReply(orangeEmbed('Error', `You don't have enough balance to bet ${betAmount} coins.`));
    }

    const { nickname, balance, player_id } = balanceResult.rows[0];

    // Simple blackjack game logic
    const playerCard1 = Math.floor(Math.random() * 10) + 1;
    const playerCard2 = Math.floor(Math.random() * 10) + 1;
    const dealerCard1 = Math.floor(Math.random() * 10) + 1;
    const dealerCard2 = Math.floor(Math.random() * 10) + 1;

    const playerTotal = playerCard1 + playerCard2;
    const dealerTotal = dealerCard1 + dealerCard2;

    let result, winnings = 0;

    if (playerTotal === 21) {
      result = 'Blackjack!';
      winnings = Math.floor(betAmount * 2.5);
    } else if (playerTotal > dealerTotal && playerTotal <= 21) {
      result = 'You win!';
      winnings = betAmount * 2;
    } else if (dealerTotal > 21) {
      result = 'Dealer bust! You win!';
      winnings = betAmount * 2;
    } else {
      result = 'You lose!';
      winnings = 0;
    }

    // Update balance
    const newBalance = balance - betAmount + winnings;
    await pool.query(
      'UPDATE economy SET balance = $1 WHERE player_id = $2',
      [newBalance, player_id]
    );

    // Record transaction
    await pool.query(
      'INSERT INTO transactions (player_id, amount, type, timestamp) VALUES ($1, $2, $3, NOW())',
      [player_id, winnings - betAmount, 'blackjack']
    );

    const gameText = `**Your cards:** ${playerCard1}, ${playerCard2} (${playerTotal})\n**Dealer's cards:** ${dealerCard1}, ${dealerCard2} (${dealerTotal})\n\n**Result:** ${result}`;
    const balanceText = winnings > 0 ? `**Winnings:** +${winnings} coins\n**New Balance:** ${newBalance} coins` : `**Loss:** -${betAmount} coins\n**New Balance:** ${newBalance} coins`;

    await interaction.editReply(orangeEmbed(
      '🎰 Blackjack',
      `${gameText}\n\n${balanceText}`
    ));

  } catch (error) {
    console.error('Error processing blackjack bet:', error);
    await interaction.editReply(orangeEmbed('Error', 'Failed to process blackjack game. Please try again.'));
  }
}

async function handleSlotsBet(interaction) {
  await interaction.deferReply();
  
  const betAmount = parseInt(interaction.fields.getTextInputValue('bet_amount'));
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  if (isNaN(betAmount) || betAmount <= 0) {
    return interaction.editReply(orangeEmbed('Error', 'Invalid bet amount. Please enter a positive number.'));
  }

  try {
    // Check player balance
    const balanceResult = await pool.query(
      `SELECT rs.nickname, e.balance, p.id as player_id
       FROM players p
       JOIN economy e ON p.id = e.player_id
       JOIN rust_servers rs ON p.server_id = rs.id
       JOIN guilds g ON rs.guild_id = g.id
       WHERE p.discord_id = $1 AND g.discord_id = $2 AND e.balance >= $3
       ORDER BY e.balance DESC
       LIMIT 1`,
      [userId, guildId, betAmount]
    );

    if (balanceResult.rows.length === 0) {
      return interaction.editReply(orangeEmbed('Error', `You don't have enough balance to bet ${betAmount} coins.`));
    }

    const { nickname, balance, player_id } = balanceResult.rows[0];

    // Simple slots game logic
    const symbols = ['🍎', '🍊', '🍇', '🍒', '💎', '7️⃣'];
    const reel1 = symbols[Math.floor(Math.random() * symbols.length)];
    const reel2 = symbols[Math.floor(Math.random() * symbols.length)];
    const reel3 = symbols[Math.floor(Math.random() * symbols.length)];

    let result, winnings = 0;

    if (reel1 === reel2 && reel2 === reel3) {
      if (reel1 === '💎') {
        result = 'Jackpot! Triple Diamonds!';
        winnings = betAmount * 10;
      } else if (reel1 === '7️⃣') {
        result = 'Lucky Sevens!';
        winnings = betAmount * 5;
      } else {
        result = 'Triple Match!';
        winnings = betAmount * 3;
      }
    } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
      result = 'Double Match!';
      winnings = betAmount * 2;
    } else {
      result = 'No match!';
      winnings = 0;
    }

    // Update balance
    const newBalance = balance - betAmount + winnings;
    await pool.query(
      'UPDATE economy SET balance = $1 WHERE player_id = $2',
      [newBalance, player_id]
    );

    // Record transaction
    await pool.query(
      'INSERT INTO transactions (player_id, amount, type, timestamp) VALUES ($1, $2, $3, NOW())',
      [player_id, winnings - betAmount, 'slots']
    );

    const gameText = `**Reels:** ${reel1} | ${reel2} | ${reel3}\n\n**Result:** ${result}`;
    const balanceText = winnings > 0 ? `**Winnings:** +${winnings} coins\n**New Balance:** ${newBalance} coins` : `**Loss:** -${betAmount} coins\n**New Balance:** ${newBalance} coins`;

    await interaction.editReply(orangeEmbed(
      '🎰 Slots',
      `${gameText}\n\n${balanceText}`
    ));

  } catch (error) {
    console.error('Error processing slots bet:', error);
    await interaction.editReply(orangeEmbed('Error', 'Failed to process slots game. Please try again.'));
  }
}

async function handleShopCategory(interaction) {
  await interaction.deferUpdate();
  
  const categoryId = interaction.values[0];
  
  try {
    // Get category info and items
    const result = await pool.query(
      `SELECT sc.name as category_name, sc.type, rs.nickname as server_name, rs.id as server_id
       FROM shop_categories sc
       JOIN rust_servers rs ON sc.server_id = rs.id
       WHERE sc.id = $1`,
      [categoryId]
    );

    if (result.rows.length === 0) {
      return interaction.editReply(orangeEmbed('Error', 'Category not found.'));
    }

    const { category_name, type, server_name, server_id } = result.rows[0];

    // Get items and kits based on category type
    let items = [];
    let kits = [];

    if (type === 'items' || type === 'both') {
      const itemsResult = await pool.query(
        'SELECT id, display_name, short_name, price, quantity, timer FROM shop_items WHERE category_id = $1 ORDER BY display_name',
        [categoryId]
      );
      items = itemsResult.rows;
    }

    if (type === 'kits' || type === 'both') {
      const kitsResult = await pool.query(
        'SELECT id, display_name, kit_name, price, quantity, timer FROM shop_kits WHERE category_id = $1 ORDER BY display_name',
        [categoryId]
      );
      kits = kitsResult.rows;
    }

    // Create embed
    const embed = orangeEmbed(
      `🛒 ${category_name}`,
      `**Server:** ${server_name}\n**Type:** ${type}\n\nSelect an item or kit to purchase:`
    );

    // Add items to embed
    if (items.length > 0) {
      const itemsList = items.map(item => 
        `**${item.display_name}** - ${item.price} coins (${item.quantity}x)${item.timer ? ` - ${item.timer}m cooldown` : ''}`
      ).join('\n');
      embed.addFields({ name: '📦 Items', value: itemsList, inline: false });
    }

    // Add kits to embed
    if (kits.length > 0) {
      const kitsList = kits.map(kit => 
        `**${kit.display_name}** - ${kit.price} coins (${kit.quantity}x)${kit.timer ? ` - ${kit.timer}m cooldown` : ''}`
      ).join('\n');
      embed.addFields({ name: '🎒 Kits', value: kitsList, inline: false });
    }

    if (items.length === 0 && kits.length === 0) {
      embed.setDescription(`${embed.data.description}\n\nNo items or kits available in this category.`);
    }

    await interaction.editReply({
      embeds: [embed],
      components: [] // Remove the dropdown
    });

  } catch (error) {
    console.error('Error handling shop category:', error);
    await interaction.editReply(orangeEmbed('Error', 'Failed to load shop category.'));
  }
}

async function handleShopItems(interaction) {
  // This would handle individual item selection
  // Implementation depends on how you want to structure the purchase flow
}

async function handlePurchase(interaction) {
  // This would handle purchase confirmation
  // Implementation depends on how you want to structure the purchase flow
}

async function handleConfirmPurchase(interaction) {
  // This would handle confirmed purchases
  // Implementation depends on how you want to structure the purchase flow
}

async function handleCancelPurchase(interaction) {
  await interaction.deferUpdate();
  await interaction.editReply(orangeEmbed('Purchase Cancelled', 'Purchase has been cancelled.'));
} 