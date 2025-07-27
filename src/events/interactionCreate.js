const { Events, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../embeds/format');
const pool = require('../db');
const { sendRconCommand } = require('../rcon');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      // Handle autocomplete
      if (interaction.isAutocomplete()) {
        const command = require('../index').client.commands.get(interaction.commandName);
        if (!command || !command.autocomplete) return;
        
        await command.autocomplete(interaction);
        return;
      }

      // Handle modals
      if (interaction.isModalSubmit()) {
        if (interaction.customId === 'blackjack_bet') {
          await handleBlackjackBet(interaction);
        } else if (interaction.customId === 'slots_bet') {
          await handleSlotsBet(interaction);
        } else if (interaction.customId.startsWith('edit_item_modal_')) {
          await handleEditItemModal(interaction);
        } else if (interaction.customId.startsWith('edit_kit_modal_')) {
          await handleEditKitModal(interaction);
        }
        return;
      }

      // Handle shop dropdown selection
      if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'shop_category_select') {
          await handleShopCategorySelect(interaction);
        } else if (interaction.customId.startsWith('shop_item_')) {
          await handleShopItemSelect(interaction);
        }
        return;
      }

      // Handle button clicks
      if (interaction.isButton()) {
        console.log('Button clicked - customId:', interaction.customId);
        if (interaction.customId.startsWith('confirm_purchase_')) {
          console.log('Handling confirm purchase button');
          await handleConfirmPurchase(interaction);
        } else if (interaction.customId.startsWith('cancel_purchase_')) {
          console.log('Handling cancel purchase button');
          await handleCancelPurchase(interaction);
        } else if (interaction.customId.startsWith('link_confirm_')) {
          await handleLinkConfirm(interaction);
        } else if (interaction.customId === 'link_cancel') {
          await handleLinkCancel(interaction);
        }
        return;
      }
    } catch (error) {
      console.error('Error handling interaction:', error);
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            embeds: [errorEmbed('Error', 'An error occurred while processing your request.')]
          });
        } else {
          await interaction.reply({
            embeds: [errorEmbed('Error', 'An error occurred while processing your request.')],
            ephemeral: true
          });
        }
      } catch (replyError) {
        console.error('Failed to send error response:', replyError);
      }
    }
  },
};

async function handleShopServerSelect(interaction) {
  await interaction.deferUpdate();
  
  const serverId = interaction.values[0];
  const userId = interaction.user.id;
  
  try {
    // Get server info and categories
    const result = await pool.query(
      `SELECT rs.nickname, rs.id as server_id
       FROM rust_servers rs
       WHERE rs.id = $1`,
      [serverId]
    );

    if (result.rows.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Server Not Found', 'The selected server was not found.')]
      });
    }

    const { nickname, server_id } = result.rows[0];

    // Get categories for this server
    const categoriesResult = await pool.query(
      'SELECT id, name, type FROM shop_categories WHERE server_id = $1 ORDER BY name',
      [server_id]
    );

    if (categoriesResult.rows.length === 0) {
      return interaction.editReply({
        embeds: [orangeEmbed(
          '💰 Shop',
          `No categories available for **${nickname}**.\n\nAdmins need to create categories using \`/add-shop-category\`.`
        )]
      });
    }

    // Get player's balance for this server
    const balanceResult = await pool.query(
      `SELECT e.balance FROM players p
       JOIN economy e ON p.id = e.player_id
       WHERE p.discord_id = $1 AND p.server_id = $2`,
      [userId, server_id]
    );

    const balance = balanceResult.rows.length > 0 ? balanceResult.rows[0].balance : 0;

    // Create category dropdown
    const categoryOptions = categoriesResult.rows.map(category => ({
      label: category.name,
      description: `${category.type} - Browse ${category.name}`,
      value: category.id.toString()
    }));

    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('shop_category_' + server_id)
          .setPlaceholder('Select a category to browse')
          .addOptions(categoryOptions)
      );

    await interaction.editReply({
      embeds: [orangeEmbed(
        '💰 Shop',
        `**Server:** ${nickname}\n**Your Balance:** ${balance} coins\n\nSelect a category to browse items and kits:`
      )],
      components: [row]
    });

  } catch (error) {
    console.error('Error handling shop server select:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'Failed to load shop categories.')]
    });
  }
}

async function handleShopCategorySelect(interaction) {
  await interaction.deferUpdate();
  
  const categoryId = interaction.values[0];
  const userId = interaction.user.id;
  
  try {
    // Get category info
    const categoryResult = await pool.query(
      `SELECT sc.name, sc.type, rs.nickname
       FROM shop_categories sc
       JOIN rust_servers rs ON sc.server_id = rs.id
       WHERE sc.id = $1`,
      [categoryId]
    );

    if (categoryResult.rows.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Category Not Found', 'The selected category was not found.')]
      });
    }

    const { name, type, nickname } = categoryResult.rows[0];

    // Get items and kits
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

    // Get player balance
    const balanceResult = await pool.query(
      `SELECT e.balance, rs.id as server_id FROM players p
       JOIN economy e ON p.id = e.player_id
       JOIN rust_servers rs ON p.server_id = rs.id
       JOIN shop_categories sc ON rs.id = sc.server_id
       WHERE p.discord_id = $1 AND sc.id = $2`,
      [userId, categoryId]
    );

    const balance = balanceResult.rows.length > 0 ? balanceResult.rows[0].balance : 0;
    const serverId = balanceResult.rows.length > 0 ? balanceResult.rows[0].server_id : null;

    // Create embed
    const embed = orangeEmbed(
      `🛒 ${name}`,
      `**Server:** ${nickname}\n**Type:** ${type}\n**Your Balance:** ${balance} coins\n\nSelect an item or kit to purchase:`
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

    // Create purchase options
    const allOptions = [];
    
    items.forEach(item => {
      allOptions.push({
        label: `${item.display_name} - ${item.price} coins`,
        description: `Item: ${item.short_name} (${item.quantity}x)`,
        value: `item_${item.id}`
      });
    });

    kits.forEach(kit => {
      allOptions.push({
        label: `${kit.display_name} - ${kit.price} coins`,
        description: `Kit: ${kit.kit_name} (${kit.quantity}x)`,
        value: `kit_${kit.id}`
      });
    });

    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('shop_item_' + categoryId)
          .setPlaceholder('Select an item or kit to purchase')
          .addOptions(allOptions)
      );

    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });

  } catch (error) {
    console.error('Error handling shop category select:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'Failed to load shop items.')]
    });
  }
}

async function handleShopItemSelect(interaction) {
  await interaction.deferUpdate();
  
  const selection = interaction.values[0];
  const categoryId = interaction.customId.split('_')[2];
  const userId = interaction.user.id;
  
  console.log('Shop item select - selection:', selection, 'categoryId:', categoryId, 'customId:', interaction.customId);
  
  try {
    const [type, itemId] = selection.split('_');
    
    console.log('Shop item select - type:', type, 'itemId:', itemId);
    
    let itemData;
    let itemType;

    if (type === 'item') {
      const result = await pool.query(
        'SELECT id, display_name, short_name, price, quantity, timer FROM shop_items WHERE id = $1',
        [itemId]
      );
      console.log('Item query result:', result.rows);
      itemData = result.rows[0];
      itemType = 'item';
    } else if (type === 'kit') {
      const result = await pool.query(
        'SELECT id, display_name, kit_name, price, quantity, timer FROM shop_kits WHERE id = $1',
        [itemId]
      );
      console.log('Kit query result:', result.rows);
      itemData = result.rows[0];
      itemType = 'kit';
    }

    if (!itemData) {
      return interaction.editReply({
        embeds: [errorEmbed('Item Not Found', 'The selected item was not found.')]
      });
    }

         // Get player balance - first get the server_id from the category
     const serverResult = await pool.query(
       'SELECT rs.id as server_id, rs.nickname FROM shop_categories sc JOIN rust_servers rs ON sc.server_id = rs.id WHERE sc.id = $1',
       [categoryId]
     );

     if (serverResult.rows.length === 0) {
       return interaction.editReply({
         embeds: [errorEmbed('Server Not Found', 'The server for this category was not found.')]
       });
     }

     const serverId = serverResult.rows[0].server_id;
     const nickname = serverResult.rows[0].nickname;

     // Now get player balance for this specific server (requires linking)
     const balanceResult = await pool.query(
       `SELECT e.balance, p.id as player_id
        FROM players p
        JOIN economy e ON p.id = e.player_id
        WHERE p.discord_id = $1 AND p.server_id = $2`,
       [userId, serverId]
     );
     
     console.log('Balance result:', balanceResult.rows);

    if (balanceResult.rows.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Account Not Linked', 'You must link your Discord account to your in-game character first.\n\nUse `/link <in-game-name>` to link your account before using this command.')]
      });
    }

    const { balance, player_id } = balanceResult.rows[0];

    if (balance < itemData.price) {
      return interaction.editReply({
        embeds: [errorEmbed('Insufficient Balance', `You need ${itemData.price} coins but only have ${balance} coins.`)]
      });
    }

    // Create confirmation embed
    const embed = orangeEmbed(
      '🛒 Purchase Confirmation',
      `**Item:** ${itemData.display_name}\n**Price:** ${itemData.price} coins\n**Server:** ${nickname}\n**Your Balance:** ${balance} coins\n**New Balance:** ${balance - itemData.price} coins\n\nDo you want to confirm this purchase?`
    );

    // Create confirmation buttons
    const confirmCustomId = `confirm_purchase_${type}_${itemId}_${player_id}`;
    console.log('Creating confirm button with customId:', confirmCustomId);
    console.log('Button custom ID parts - type:', type, 'itemId:', itemId, 'player_id:', player_id);
    
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(confirmCustomId)
          .setLabel('Confirm Purchase')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('cancel_purchase')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
      );

    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });

  } catch (error) {
    console.error('Error handling shop item select:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'Failed to process item selection.')]
    });
  }
}

async function handleConfirmPurchase(interaction) {
  await interaction.deferUpdate();
  
  console.log('handleConfirmPurchase - customId:', interaction.customId);
  const parts = interaction.customId.split('_');
  console.log('handleConfirmPurchase - parts:', parts);
  
  const [, , type, itemId, playerId] = parts;
  const userId = interaction.user.id;
  
  console.log('handleConfirmPurchase - parsed values:', { type, itemId, playerId, userId });
  
  try {
    let itemData;
    let command;

    if (type === 'item') {
      console.log('Confirm purchase - querying item with ID:', itemId);
      const result = await pool.query(
        'SELECT si.display_name, si.short_name, si.price, rs.ip, rs.port, rs.password, rs.nickname FROM shop_items si JOIN shop_categories sc ON si.category_id = sc.id JOIN rust_servers rs ON sc.server_id = rs.id WHERE si.id = $1',
        [itemId]
      );
      console.log('Confirm purchase - item query result:', result.rows);
      itemData = result.rows[0];
      command = `inventory.giveto "${interaction.user.username}" "${itemData.short_name}" 1`;
    } else if (type === 'kit') {
      console.log('Confirm purchase - querying kit with ID:', itemId);
      const result = await pool.query(
        'SELECT sk.display_name, sk.kit_name, sk.price, rs.ip, rs.port, rs.password, rs.nickname FROM shop_kits sk JOIN shop_categories sc ON sk.category_id = sc.id JOIN rust_servers rs ON sc.server_id = rs.id WHERE sk.id = $1',
        [itemId]
      );
      console.log('Confirm purchase - kit query result:', result.rows);
      itemData = result.rows[0];
      command = `kit givetoplayer ${itemData.kit_name} ${interaction.user.username}`;
    }

    if (!itemData) {
      return interaction.editReply({
        embeds: [errorEmbed('Item Not Found', 'The selected item was not found.')]
      });
    }

    // Deduct balance
    await pool.query(
      'UPDATE economy SET balance = balance - $1 WHERE player_id = $2',
      [itemData.price, playerId]
    );

    // Record transaction
    await pool.query(
      'INSERT INTO transactions (player_id, amount, type, timestamp) VALUES ($1, $2, $3, NOW())',
      [playerId, -itemData.price, 'shop_purchase']
    );

         // Send RCON command to server
     try {
       sendRconCommand(itemData.ip, itemData.port, itemData.password, command);
       console.log(`RCON Command sent to ${itemData.nickname}: ${command}`);
       
       // Send confirmation message to player in-game
       const playerName = interaction.user.username;
       const confirmMessage = `say <color=green>${playerName}</color>-green Your purchase was successful-white`;
       sendRconCommand(itemData.ip, itemData.port, itemData.password, confirmMessage);
       console.log(`Confirmation message sent to ${itemData.nickname}: ${confirmMessage}`);
       
       // Send to admin feed
       const guildId = interaction.guildId;
       const { sendFeedEmbed } = require('../rcon');
       await sendFeedEmbed(interaction.client, guildId, itemData.nickname, 'adminfeed', `🛒 **Shop Purchase:** ${playerName} purchased ${itemData.display_name} for ${itemData.price} coins`);
     } catch (error) {
       console.error(`Failed to send RCON command to ${itemData.nickname}:`, error);
     }

     await interaction.editReply({
       embeds: [successEmbed(
         'Purchase Successful',
         `**${itemData.display_name}** has been purchased for ${itemData.price} coins!\n\n✅ **Item delivered in-game!**`
       )],
       components: []
     });

  } catch (error) {
    console.error('Error confirming purchase:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'Failed to process purchase. Please try again.')]
    });
  }
}

async function handleCancelPurchase(interaction) {
  await interaction.deferUpdate();
  await interaction.editReply({
    embeds: [orangeEmbed('Purchase Cancelled', 'Purchase has been cancelled.')],
    components: []
  });
}

async function handleLinkConfirm(interaction) {
  await interaction.deferUpdate();
  
  const [, , guildId, discordId, ign] = interaction.customId.split('_');
  
  try {
    // Get guild database ID
    const guildResult = await pool.query(
      'SELECT id FROM guilds WHERE discord_id = $1',
      [guildId]
    );

    if (guildResult.rows.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Error', 'Guild not found.')],
        components: []
      });
    }

    const guildDbId = guildResult.rows[0].id;

    // Get all servers in this guild
    const serversResult = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = $1',
      [guildDbId]
    );

    if (serversResult.rows.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('No Servers', 'No servers found in this guild.')],
        components: []
      });
    }

    // Create player records for all servers
    for (const server of serversResult.rows) {
      // Check if player already exists for this server
      const existingPlayer = await pool.query(
        'SELECT id FROM players WHERE discord_id = $1 AND server_id = $2',
        [discordId, server.id]
      );

      if (existingPlayer.rows.length === 0) {
        // Create player record
        await pool.query(
          'INSERT INTO players (guild_id, server_id, discord_id, ign) VALUES ($1, $2, $3, $4)',
          [guildDbId, server.id, discordId, ign]
        );

        // Create economy record with 0 balance
        const playerResult = await pool.query(
          'SELECT id FROM players WHERE discord_id = $1 AND server_id = $2',
          [discordId, server.id]
        );

        if (playerResult.rows.length > 0) {
          await pool.query(
            'INSERT INTO economy (player_id, balance) VALUES ($1, 0)',
            [playerResult.rows[0].id]
          );
        }
      }
    }

    await interaction.editReply({
      embeds: [successEmbed(
        'Account Linked',
        `Your Discord account has been successfully linked to **${ign}**!\n\nYou can now use \`/daily\` to claim your daily rewards and participate in the economy.`
      )],
      components: []
    });

  } catch (error) {
    console.error('Error confirming link:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'Failed to link account. Please try again.')],
      components: []
    });
  }
}

async function handleLinkCancel(interaction) {
  await interaction.deferUpdate();
  await interaction.editReply({
    embeds: [orangeEmbed('Link Cancelled', 'Account linking has been cancelled.')],
    components: []
  });
}

async function handleBlackjackBet(interaction) {
  await interaction.deferReply();
  
  const betAmount = parseInt(interaction.fields.getTextInputValue('bet_amount'));
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  if (isNaN(betAmount) || betAmount <= 0) {
    return interaction.editReply({
      embeds: [errorEmbed('Invalid Bet', 'Invalid bet amount. Please enter a positive number.')]
    });
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
      return interaction.editReply({
        embeds: [errorEmbed('Insufficient Balance', `You don't have enough balance to bet ${betAmount} coins.`)]
      });
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

    await interaction.editReply({
      embeds: [orangeEmbed(
        '🎰 Blackjack',
        `${gameText}\n\n${balanceText}`
      )]
    });

  } catch (error) {
    console.error('Error processing blackjack bet:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'Failed to process blackjack game. Please try again.')]
    });
  }
}

async function handleSlotsBet(interaction) {
  await interaction.deferReply();
  
  const betAmount = parseInt(interaction.fields.getTextInputValue('bet_amount'));
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  if (isNaN(betAmount) || betAmount <= 0) {
    return interaction.editReply({
      embeds: [errorEmbed('Invalid Bet', 'Invalid bet amount. Please enter a positive number.')]
    });
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
      return interaction.editReply({
        embeds: [errorEmbed('Insufficient Balance', `You don't have enough balance to bet ${betAmount} coins.`)]
      });
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

    await interaction.editReply({
      embeds: [orangeEmbed(
        '🎰 Slots',
        `${gameText}\n\n${balanceText}`
      )]
    });

  } catch (error) {
    console.error('Error processing slots bet:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'Failed to process slots game. Please try again.')]
    });
  }
} 

async function handleEditItemModal(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const itemId = interaction.customId.split('_')[3];
  const displayName = interaction.fields.getTextInputValue('display_name');
  const shortName = interaction.fields.getTextInputValue('short_name');
  const price = parseInt(interaction.fields.getTextInputValue('price'));
  const quantity = parseInt(interaction.fields.getTextInputValue('quantity'));
  const timer = interaction.fields.getTextInputValue('timer');

  // Validate inputs
  if (isNaN(price) || price < 0) {
    return interaction.editReply({
      embeds: [errorEmbed('Invalid Price', 'Price must be a positive number.')]
    });
  }

  if (isNaN(quantity) || quantity < 1) {
    return interaction.editReply({
      embeds: [errorEmbed('Invalid Quantity', 'Quantity must be at least 1.')]
    });
  }

  const timerValue = timer.trim() === '' ? null : (isNaN(parseInt(timer)) ? null : parseInt(timer));

  try {
    // Update the item
    await pool.query(
      'UPDATE shop_items SET display_name = $1, short_name = $2, price = $3, quantity = $4, timer = $5 WHERE id = $6',
      [displayName, shortName, price, quantity, timerValue, itemId]
    );

    await interaction.editReply({
      embeds: [successEmbed(
        'Item Updated',
        `**${displayName}** has been updated successfully!\n\n**New Details:**\n• **Price:** ${price} coins\n• **Quantity:** ${quantity}\n• **Timer:** ${timerValue ? timerValue + ' minutes' : 'None'}`
      )]
    });

  } catch (error) {
    console.error('Error updating item:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'Failed to update item. Please try again.')]
    });
  }
}

async function handleEditKitModal(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const kitId = interaction.customId.split('_')[3];
  const displayName = interaction.fields.getTextInputValue('display_name');
  const kitName = interaction.fields.getTextInputValue('kit_name');
  const price = parseInt(interaction.fields.getTextInputValue('price'));
  const quantity = parseInt(interaction.fields.getTextInputValue('quantity'));
  const timer = interaction.fields.getTextInputValue('timer');

  // Validate inputs
  if (isNaN(price) || price < 0) {
    return interaction.editReply({
      embeds: [errorEmbed('Invalid Price', 'Price must be a positive number.')]
    });
  }

  if (isNaN(quantity) || quantity < 1) {
    return interaction.editReply({
      embeds: [errorEmbed('Invalid Quantity', 'Quantity must be at least 1.')]
    });
  }

  const timerValue = timer.trim() === '' ? null : (isNaN(parseInt(timer)) ? null : parseInt(timer));

  try {
    // Update the kit
    await pool.query(
      'UPDATE shop_kits SET display_name = $1, kit_name = $2, price = $3, quantity = $4, timer = $5 WHERE id = $6',
      [displayName, kitName, price, quantity, timerValue, kitId]
    );

    await interaction.editReply({
      embeds: [successEmbed(
        'Kit Updated',
        `**${displayName}** has been updated successfully!\n\n**New Details:**\n• **Kit Name:** ${kitName}\n• **Price:** ${price} coins\n• **Quantity:** ${quantity}\n• **Timer:** ${timerValue ? timerValue + ' minutes' : 'None'}`
      )]
    });

  } catch (error) {
    console.error('Error updating kit:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'Failed to update kit. Please try again.')]
    });
  }
} 