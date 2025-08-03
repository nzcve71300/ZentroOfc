const { Events, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { errorEmbed, orangeEmbed, successEmbed } = require('../embeds/format');
const { getServerByNickname, getServerById, getLinkedPlayer, updateBalance, recordTransaction } = require('../utils/economy');
const pool = require('../db');
const { sendRconCommand } = require('../rcon');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    console.log('[INTERACTION DEBUG] Interaction received:', interaction.type, 'customId:', interaction.customId, 'isModalSubmit:', interaction.isModalSubmit());
    
    // Log ALL interactions for debugging
    if (interaction.type === 5) {
      console.log('[MODAL SUBMIT DEBUG] Modal submission detected!');
    }
    
    try {
      // Handle autocomplete
      if (interaction.isAutocomplete()) {
        const command = require('../index').client.commands.get(interaction.commandName);
        if (!command || !command.autocomplete) return;
        
        await command.autocomplete(interaction);
        return;
      }

      // Handle modals
      if (interaction.isModalSubmit() || interaction.type === 5) {
        console.log('[MODAL DEBUG] Modal submitted, customId:', interaction.customId, 'type:', interaction.type, 'isModalSubmit:', interaction.isModalSubmit());
        if (interaction.customId.startsWith('edit_item_modal_')) {
          await handleEditItemModal(interaction);
        } else if (interaction.customId.startsWith('edit_kit_modal_')) {
          await handleEditKitModal(interaction);
        } else if (interaction.customId.startsWith('scheduler_add_modal_')) {
          console.log('[MODAL DEBUG] Calling handleSchedulerAddModal');
          await handleSchedulerAddModal(interaction);
        } else if (interaction.customId.startsWith('scheduler_msg1_modal_')) {
          console.log('[MODAL DEBUG] Calling handleSchedulerMsg1Modal');
          await handleSchedulerMsg1Modal(interaction);
        } else if (interaction.customId.startsWith('scheduler_msg2_modal_')) {
          console.log('[MODAL DEBUG] Calling handleSchedulerMsg2Modal');
          await handleSchedulerMsg2Modal(interaction);
        } else if (interaction.customId.startsWith('scheduler_custom_msg1_')) {
          console.log('[MODAL DEBUG] Calling handleSchedulerCustomMsg1');
          await handleSchedulerCustomMsg1(interaction);
        } else if (interaction.customId.startsWith('scheduler_custom_msg2_')) {
          console.log('[MODAL DEBUG] Calling handleSchedulerCustomMsg2');
          await handleSchedulerCustomMsg2(interaction);
        } else {
          console.log('[MODAL DEBUG] No handler found for modal:', interaction.customId);
          // Fallback: try to handle any modal submission
          try {
            const message1 = interaction.fields.getTextInputValue('message1');
            const message2 = interaction.fields.getTextInputValue('message2');
            console.log('[MODAL DEBUG] Fallback - message1:', message1, 'message2:', message2);
            await interaction.reply({
              embeds: [successEmbed('Modal Submitted', `Message 1: ${message1 || 'N/A'}\nMessage 2: ${message2 || 'N/A'}`)],
              ephemeral: true
            });
          } catch (error) {
            console.log('[MODAL DEBUG] Fallback error:', error.message);
            await interaction.reply({
              embeds: [errorEmbed('Error', 'Modal submission failed.')],
              ephemeral: true
            });
          }
        }
        return;
      }
      
      // Catch-all for any unhandled interactions
      if (interaction.type !== 2 && interaction.type !== 3 && interaction.type !== 5) {
        console.log('[INTERACTION DEBUG] Unhandled interaction type:', interaction.type, 'customId:', interaction.customId);
      }

      // Handle shop dropdown selection
      if (interaction.isStringSelectMenu()) {
        console.log('🔍 StringSelectMenu interaction - customId:', interaction.customId);
        if (interaction.customId === 'shop_category_select') {
          await handleShopCategorySelect(interaction);
        } else if (interaction.customId.startsWith('shop_item_')) {
          await handleShopItemSelect(interaction);
        } else if (interaction.customId.startsWith('scheduler_delete_select_')) {
          await handleSchedulerDeleteSelect(interaction);
        } else if (interaction.customId.startsWith('scheduler_select_msg1_')) {
          await handleSchedulerSelectMsg1(interaction);
        } else if (interaction.customId.startsWith('scheduler_select_msg2_')) {
          await handleSchedulerSelectMsg2(interaction);
        } else {
          console.log('⚠️ Unhandled StringSelectMenu interaction:', interaction.customId);
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
        } else if (interaction.customId.startsWith('scheduler_save_pair_')) {
          console.log('Handling scheduler_save_pair button');
          await handleSchedulerSavePair(interaction);
        } else if (interaction.customId.startsWith('scheduler_add_')) {
          await handleSchedulerAdd(interaction);
        } else if (interaction.customId.startsWith('scheduler_view_')) {
          await handleSchedulerView(interaction);
        } else if (interaction.customId.startsWith('scheduler_delete_')) {
          await handleSchedulerDelete(interaction);
        } else {
          console.log('No handler found for button:', interaction.customId);
        }
        return;
      }
      
      // If we get here, no handler was found
      console.log('[INTERACTION DEBUG] No handler found for interaction:', interaction.type, 'customId:', interaction.customId);
      
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
       WHERE rs.id = ?`,
      [serverId]
    );

    if (result.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Server Not Found', 'The selected server was not found.')]
      });
    }

    const { nickname, server_id } = result[0];

    // Get categories for this server
    const categoriesResult = await pool.query(
      'SELECT id, name, type FROM shop_categories WHERE server_id = ? ORDER BY name',
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
       WHERE p.discord_id = ? AND p.server_id = ?`,
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
      `SELECT sc.name, sc.type, rs.nickname, sc.server_id
       FROM shop_categories sc
       JOIN rust_servers rs ON sc.server_id = rs.id
       WHERE sc.id = ?`,
      [categoryId]
    );

    if (categoryResult[0].length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Category Not Found', 'The selected category was not found.')]
      });
    }

    const { name, type, nickname, server_id } = categoryResult[0][0];

    // Get items and kits
    let items = [];
    let kits = [];

    if (type === 'items') {
      const itemsResult = await pool.query(
        'SELECT id, display_name, short_name, price, quantity, timer FROM shop_items WHERE category_id = ? ORDER BY display_name',
        [categoryId]
      );
      items = itemsResult[0];
    }

    if (type === 'kits') {
      const kitsResult = await pool.query(
        'SELECT id, display_name, kit_name, price, quantity, timer FROM shop_kits WHERE category_id = ? ORDER BY display_name',
        [categoryId]
      );
      kits = kitsResult[0];
    }

    // Get player balance for the specific server
    const balanceResult = await pool.query(
      `SELECT e.balance
       FROM players p
       JOIN economy e ON p.id = e.player_id
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.discord_id = ? AND rs.id = ?
       LIMIT 1`,
      [userId, server_id]
    );

    const balance = balanceResult[0].length > 0 ? balanceResult[0][0].balance : 0;
    const serverId = server_id;

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

    // Create purchase options (Discord limit: 25 options max)
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

    console.log('[SHOP DEBUG] Total items:', items.length, 'Total kits:', kits.length);
    console.log('[SHOP DEBUG] All options length:', allOptions.length);

    // Limit to 25 options (Discord's maximum)
    const limitedOptions = allOptions.slice(0, 25);
    const totalItems = items.length + kits.length;
    const hasMoreItems = totalItems > 25;
    
    console.log('[SHOP DEBUG] Limited options length:', limitedOptions.length);
    console.log('[SHOP DEBUG] Has more items:', hasMoreItems);

    // Check if we have any options to show
    if (limitedOptions.length === 0) {
      embed.setDescription(`${embed.data.description}\n\n❌ **No items or kits available in this category.**`);
      await interaction.editReply({
        embeds: [embed],
        components: []
      });
      return;
    }

    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('shop_item_' + categoryId)
          .setPlaceholder(`Select an item or kit to purchase${hasMoreItems ? ' (showing first 25)' : ''}`)
          .addOptions(limitedOptions)
      );

    // Update embed description if there are more items than can be shown
    if (hasMoreItems) {
      embed.setDescription(`${embed.data.description}\n\n⚠️ **Note:** Only showing first 25 items. There are ${totalItems} total items in this category.`);
    }

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
        'SELECT id, display_name, short_name, price, quantity, timer FROM shop_items WHERE id = ?',
        [itemId]
      );
      console.log('Item query result:', result);
      itemData = result[0];
      itemType = 'item';
    } else if (type === 'kit') {
      const result = await pool.query(
        'SELECT id, display_name, kit_name, price, quantity, timer FROM shop_kits WHERE id = ?',
        [itemId]
      );
      console.log('Kit query result:', result);
      itemData = result[0];
      itemType = 'kit';
    }

    if (!itemData || itemData.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Item Not Found', 'The selected item was not found.')]
      });
    }

    const item = itemData[0]; // Get the first item from the result

         // Get player balance - first get the server_id from the category
     const serverResult = await pool.query(
       'SELECT rs.id as server_id, rs.nickname FROM shop_categories sc JOIN rust_servers rs ON sc.server_id = rs.id WHERE sc.id = ?',
       [categoryId]
     );

     if (!serverResult[0] || serverResult[0].length === 0) {
       return interaction.editReply({
         embeds: [errorEmbed('Server Not Found', 'The server for this category was not found.')]
       });
     }

     const serverId = serverResult[0][0].server_id;
     const nickname = serverResult[0][0].nickname;

     // Now get player balance (guild-wide balance)
     const balanceResult = await pool.query(
       `SELECT e.balance, p.id as player_id
        FROM players p
        LEFT JOIN economy e ON p.id = e.player_id
        JOIN guilds g ON p.guild_id = g.id
        WHERE p.discord_id = ? AND g.discord_id = ?
        LIMIT 1`,
       [userId, interaction.guildId]
     );
     
     console.log('Balance result:', balanceResult[0]);

    if (!balanceResult[0] || balanceResult[0].length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Account Not Linked', 'You must link your Discord account to your in-game character first.\n\nUse `/link <in-game-name>` to link your account before using this command.')]
      });
    }

    let { balance, player_id } = balanceResult[0][0];
    console.log('Extracted balance:', balance, 'player_id:', player_id);

    // If balance is null, create or update economy record
    if (balance === null) {
      console.log('Creating/updating economy record for player:', player_id);
      await pool.query(
        'INSERT INTO economy (player_id, guild_id, balance) VALUES (?, (SELECT guild_id FROM players WHERE id = ?), 0) ON DUPLICATE KEY UPDATE balance = COALESCE(balance, 0)',
        [player_id, player_id]
      );
      
      // Get the updated balance
      const updatedBalanceResult = await pool.query(
        'SELECT balance FROM economy WHERE player_id = ?',
        [player_id]
      );
      balance = updatedBalanceResult[0] && updatedBalanceResult[0][0] ? updatedBalanceResult[0][0].balance : 0;
      console.log('Updated balance:', balance);
    }

    if (balance < item.price) {
      return interaction.editReply({
        embeds: [errorEmbed('Insufficient Balance', `You need ${item.price} coins but only have ${balance} coins.`)]
      });
    }

    // Create confirmation embed
    const embed = orangeEmbed(
      '🛒 Purchase Confirmation',
      `**Item:** ${item.display_name}\n**Price:** ${item.price} coins\n**Server:** ${nickname}\n**Your Balance:** ${balance} coins\n**New Balance:** ${balance - item.price} coins\n\nDo you want to confirm this purchase?`
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
    let timer = null;

    if (type === 'item') {
      console.log('Confirm purchase - querying item with ID:', itemId);
      const result = await pool.query(
        'SELECT si.display_name, si.short_name, si.price, si.timer, rs.ip, rs.port, rs.password, rs.nickname FROM shop_items si JOIN shop_categories sc ON si.category_id = sc.id JOIN rust_servers rs ON sc.server_id = rs.id WHERE si.id = ?',
        [itemId]
      );
      console.log('Confirm purchase - item query result:', result);
      itemData = result[0] && result[0][0] ? result[0][0] : null;
      timer = itemData ? itemData.timer : null;
      
      // Get player's IGN for the command
      const playerResult = await pool.query(
        'SELECT ign FROM players WHERE id = ?',
        [playerId]
      );
      const playerIgn = playerResult[0] && playerResult[0][0] ? playerResult[0][0].ign : interaction.user.username;
      
      command = `inventory.giveto "${playerIgn}" "${itemData.short_name}" 1`;
    } else if (type === 'kit') {
      console.log('Confirm purchase - querying kit with ID:', itemId);
      const result = await pool.query(
        'SELECT sk.display_name, sk.kit_name, sk.price, sk.timer, rs.ip, rs.port, rs.password, rs.nickname FROM shop_kits sk JOIN shop_categories sc ON sk.category_id = sc.id JOIN rust_servers rs ON sc.server_id = rs.id WHERE sk.id = ?',
        [itemId]
      );
      console.log('Confirm purchase - kit query result:', result);
      itemData = result[0] && result[0][0] ? result[0][0] : null;
      timer = itemData ? itemData.timer : null;
      
      // Get player's IGN for the command
      const playerResult = await pool.query(
        'SELECT ign FROM players WHERE id = ?',
        [playerId]
      );
      const playerIgn = playerResult[0] && playerResult[0][0] ? playerResult[0][0].ign : interaction.user.username;
      
      command = `kit givetoplayer ${itemData.kit_name} ${playerIgn}`;
    }

    if (!itemData) {
      return interaction.editReply({
        embeds: [errorEmbed('Item Not Found', 'The selected item was not found.')]
      });
    }

    // Check timer/cooldown if item has one
    if (timer && timer > 0) {
      console.log(`[SHOP TIMER] Checking cooldown for ${type} ${itemId}, timer: ${timer} minutes`);
      
      // Check if player has purchased this item recently
      const cooldownResult = await pool.query(
        'SELECT purchased_at FROM shop_cooldowns WHERE player_id = ? AND item_type = ? AND item_id = ? ORDER BY purchased_at DESC LIMIT 1',
        [playerId, type, itemId]
      );
      
      if (cooldownResult[0] && cooldownResult[0].length > 0) {
        const lastPurchase = new Date(cooldownResult[0][0].purchased_at);
        const now = new Date();
        const timeDiff = (now - lastPurchase) / (1000 * 60); // Convert to minutes
        
        console.log(`[SHOP TIMER] Last purchase: ${lastPurchase}, Time diff: ${timeDiff} minutes, Timer: ${timer} minutes`);
        
        if (timeDiff < timer) {
          const remaining = Math.ceil(timer - timeDiff);
          return interaction.editReply({
            embeds: [errorEmbed('Cooldown Active', `You must wait ${remaining} more minutes before purchasing this item again.`)]
          });
        }
      }
    }

    // Deduct balance
    await pool.query(
      'UPDATE economy SET balance = balance - ? WHERE player_id = ?',
      [itemData.price, playerId]
    );

    // Record transaction
    await pool.query(
      'INSERT INTO transactions (player_id, guild_id, amount, type, timestamp) VALUES (?, (SELECT guild_id FROM players WHERE id = ?), ?, ?, CURRENT_TIMESTAMP)',
      [playerId, playerId, -itemData.price, 'shop_purchase']
    );

    // Record cooldown if item has timer
    if (timer && timer > 0) {
      await pool.query(
        'INSERT INTO shop_cooldowns (player_id, item_type, item_id, purchased_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [playerId, type, itemId]
      );
      console.log(`[SHOP TIMER] Recorded cooldown for ${type} ${itemId} for player ${playerId}`);
    }

         // Send RCON command to server
     try {
       sendRconCommand(itemData.ip, itemData.port, itemData.password, command);
       console.log(`RCON Command sent to ${itemData.nickname}: ${command}`);
       
       // Send confirmation message to player in-game
       const playerName = interaction.user.username;
       const confirmMessage = `say <color=green>${playerName}</color> <color=green>Your purchase was successful</color>`;
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
    const { confirmLinkRequest, getServersForGuild } = require('../utils/linking');
    
    // Get all servers for this guild
    const servers = await getServersForGuild(guildId);
    
    if (servers.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('No Servers', 'No servers found in this guild.')],
        components: []
      });
    }

    // Confirm link for all servers
    const linkedServers = [];
    let errorMessage = null;
    
    for (const server of servers) {
      try {
        await confirmLinkRequest(guildId, discordId, ign, server.id);
        linkedServers.push(server.nickname);
      } catch (error) {
        console.error(`Failed to link to server ${server.nickname}:`, error);
        // If it's our custom error about IGN already linked, show it
        if (error.message.includes('already linked')) {
          errorMessage = error.message;
          break; // Stop trying other servers
        }
      }
    }

    if (errorMessage) {
      return interaction.editReply({
        embeds: [errorEmbed('Link Failed', errorMessage)],
        components: []
      });
    }

    if (linkedServers.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Link Failed', 'Failed to link account to any servers. Please try again.')],
        components: []
      });
    }

    const serverList = linkedServers.join(', ');
    await interaction.editReply({
      embeds: [successEmbed(
        'Account Linked',
        `Your Discord account has been successfully linked to **${ign}**!\n\n**Linked to servers:** ${serverList}\n\nYou can now use \`/daily\` to claim your daily rewards and participate in the economy.`
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

 

async function handleEditItemModal(interaction) {
  await interaction.deferReply({ flags: 64 });
  
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
      'UPDATE shop_items SET display_name = ?, short_name = ?, price = ?, quantity = ?, timer = ? WHERE id = ?',
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
  await interaction.deferReply({ flags: 64 });
  
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
      'UPDATE shop_kits SET display_name = ?, kit_name = ?, price = ?, quantity = ?, timer = ? WHERE id = ?',
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

// Scheduler handlers
async function handleSchedulerAdd(interaction) {
  console.log('[SCHEDULER DEBUG] Add button clicked, customId:', interaction.customId);
  
  const serverId = interaction.customId.split('_')[2];
  console.log('[SCHEDULER DEBUG] Server ID:', serverId);
  
  try {
    // Check if server already has 6 message pairs
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as count FROM scheduler_messages WHERE server_id = ?',
      [serverId]
    );
    
    console.log('[SCHEDULER DEBUG] Current message pairs count:', countResult[0].count);
    
    if (countResult[0].count >= 6) {
      return interaction.reply({
        embeds: [errorEmbed('Limit Reached', 'Maximum of 6 message pairs allowed per server.')],
        ephemeral: true
      });
    }
    
    // Show a simple form with predefined message options
    const embed = orangeEmbed('Add Message Pair', 'Select your messages from the dropdowns below.');
    
    const row1 = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`scheduler_select_msg1_${serverId}`)
          .setPlaceholder('Select Message 1')
          .addOptions([
            { label: 'Join Discord', value: '<b><size=45><color=#00ffff>Join our Discord!</color></size></b>', description: 'Discord invite message' },
            { label: 'Welcome Message', value: '<b><size=45><color=#00ff00>Welcome to the server!</color></size></b>', description: 'Welcome message' },
            { label: 'Custom Message', value: 'custom', description: 'Enter your own custom message' }
          ])
      );
    
    const row2 = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`scheduler_select_msg2_${serverId}`)
          .setPlaceholder('Select Message 2')
          .addOptions([
            { label: 'Server Info', value: '<b><size=45><color=#ffff00>Check out our website!</color></size></b>', description: 'Server info message' },
            { label: 'Rules Reminder', value: '<b><size=45><color=#ff0000>Remember to follow the rules!</color></size></b>', description: 'Rules reminder' },
            { label: 'Custom Message', value: 'custom', description: 'Enter your own custom message' }
          ])
      );
    
    const row3 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`scheduler_save_pair_${serverId}`)
          .setLabel('Save Message Pair')
          .setStyle(ButtonStyle.Success)
          .setDisabled(true)
      );
    
    await interaction.update({
      embeds: [embed],
      components: [row1, row2, row3]
    });
    
  } catch (error) {
    console.error('[SCHEDULER DEBUG] Error in handleSchedulerAdd:', error);
    await interaction.reply({
      embeds: [errorEmbed('Error', 'Failed to show form. Please try again.')],
      ephemeral: true
    });
  }
}

async function handleSchedulerAddModal(interaction) {
  console.log('[SCHEDULER DEBUG] Modal submitted, customId:', interaction.customId);
  
  try {
    await interaction.deferReply({ flags: 64 });
    
    const serverId = interaction.customId.split('_')[3];
    const message1 = interaction.fields.getTextInputValue('message1');
    const message2 = interaction.fields.getTextInputValue('message2');
    
    console.log('[SCHEDULER DEBUG] Server ID:', serverId);
    console.log('[SCHEDULER DEBUG] Message 1:', message1);
    console.log('[SCHEDULER DEBUG] Message 2:', message2);

    // Insert the message pair
    await pool.query(
      'INSERT INTO scheduler_messages (server_id, message1, message2) VALUES (?, ?, ?)',
      [serverId, message1, message2]
    );

    console.log('[SCHEDULER DEBUG] Message pair inserted successfully');

    await interaction.editReply({
      embeds: [successEmbed(
        'Message Pair Added',
        'Your message pair has been added successfully!\n\n**Message 1:** ' + message1.substring(0, 100) + (message1.length > 100 ? '...' : '') + '\n**Message 2:** ' + message2.substring(0, 100) + (message2.length > 100 ? '...' : '')
      )]
    });

  } catch (error) {
    console.error('[SCHEDULER DEBUG] Error adding message pair:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'Failed to add message pair. Please try again.')]
    });
  }
}

async function handleSchedulerView(interaction) {
  await interaction.deferReply({ flags: 64 });
  
  const serverId = interaction.customId.split('_')[2];
  
  try {
    const [result] = await pool.query(
      'SELECT * FROM scheduler_messages WHERE server_id = ? ORDER BY created_at ASC',
      [serverId]
    );

    if (result.length === 0) {
      return interaction.editReply({
        embeds: [orangeEmbed('Message Pairs', 'No message pairs found for this server.')]
      });
    }

    let description = '**Here are all your message pairs:**\n\n';
    result.forEach((pair, index) => {
      description += `**${index + 1}.** Message 1: ${pair.message1.substring(0, 50)}${pair.message1.length > 50 ? '...' : ''}\n`;
      description += `    Message 2: ${pair.message2.substring(0, 50)}${pair.message2.length > 50 ? '...' : ''}\n\n`;
    });

    await interaction.editReply({
      embeds: [orangeEmbed('Message Pairs', description)]
    });

  } catch (error) {
    console.error('Error viewing message pairs:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'Failed to load message pairs. Please try again.')]
    });
  }
}

async function handleSchedulerDelete(interaction) {
  await interaction.deferReply({ flags: 64 });
  
  const serverId = interaction.customId.split('_')[2];
  
  try {
    const [result] = await pool.query(
      'SELECT * FROM scheduler_messages WHERE server_id = ? ORDER BY created_at ASC',
      [serverId]
    );

    if (result.length === 0) {
      return interaction.editReply({
        embeds: [orangeEmbed('Delete Message Pairs', 'No message pairs found for this server.')]
      });
    }

    const options = result.map((pair, index) => ({
      label: `Pair ${index + 1}: ${pair.message1.substring(0, 30)}... / ${pair.message2.substring(0, 30)}...`,
      value: pair.id.toString()
    }));

    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`scheduler_delete_select_${serverId}`)
          .setPlaceholder('Choose a message pair to delete')
          .addOptions(options)
      );

    await interaction.editReply({
      embeds: [orangeEmbed('Delete Message Pairs', 'Choose a message pair to delete:')],
      components: [row]
    });

  } catch (error) {
    console.error('Error loading message pairs for deletion:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'Failed to load message pairs. Please try again.')]
    });
  }
}

async function handleSchedulerDeleteSelect(interaction) {
  await interaction.deferReply({ flags: 64 });
  
  const messageId = interaction.values[0];
  
  try {
    // Get the message pair before deleting
    const [result] = await pool.query(
      'SELECT * FROM scheduler_messages WHERE id = ?',
      [messageId]
    );

    if (result.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Error', 'Message pair not found.')]
      });
    }

    const messagePair = result[0];

    // Delete the message pair
    await pool.query(
      'DELETE FROM scheduler_messages WHERE id = ?',
      [messageId]
    );

    await interaction.editReply({
      embeds: [successEmbed(
        'Message Pair Deleted',
        'The message pair has been deleted successfully!\n\n**Deleted Messages:**\n**Message 1:** ' + messagePair.message1.substring(0, 100) + (messagePair.message1.length > 100 ? '...' : '') + '\n**Message 2:** ' + messagePair.message2.substring(0, 100) + (messagePair.message2.length > 100 ? '...' : '')
      )]
    });

  } catch (error) {
    console.error('Error deleting message pair:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'Failed to delete message pair. Please try again.')]
    });
  }
}

// Store temporary message data
const tempMessages = new Map();



async function handleSchedulerSavePair(interaction) {
  const serverId = interaction.customId.split('_')[3];
  const tempData = tempMessages.get(serverId);
  
  if (!tempData || !tempData.message1 || !tempData.message2) {
    return interaction.reply({
      embeds: [errorEmbed('Error', 'Please set both messages before saving.')],
      ephemeral: true
    });
  }
  
  try {
    // Insert the message pair
    await pool.query(
      'INSERT INTO scheduler_messages (server_id, message1, message2) VALUES (?, ?, ?)',
      [serverId, tempData.message1, tempData.message2]
    );

    // Clear temp data
    tempMessages.delete(serverId);

    await interaction.reply({
      embeds: [successEmbed(
        'Message Pair Added',
        'Your message pair has been added successfully!\n\n**Message 1:** ' + tempData.message1.substring(0, 100) + (tempData.message1.length > 100 ? '...' : '') + '\n**Message 2:** ' + tempData.message2.substring(0, 100) + (tempData.message2.length > 100 ? '...' : '')
      )],
      ephemeral: true
    });

  } catch (error) {
    console.error('Error adding message pair:', error);
    await interaction.reply({
      embeds: [errorEmbed('Error', 'Failed to add message pair. Please try again.')],
      ephemeral: true
    });
  }
}

async function handleSchedulerMsg1Modal(interaction) {
  const serverId = interaction.customId.split('_')[3];
  const message1 = interaction.fields.getTextInputValue('message1');
  
  // Store message 1 in temp data
  if (!tempMessages.has(serverId)) {
    tempMessages.set(serverId, {});
  }
  tempMessages.get(serverId).message1 = message1;
  
  await interaction.reply({
    embeds: [successEmbed('Message 1 Set', 'Your first message has been set. Now click "Set Message 2" to continue.')],
    ephemeral: true
  });
}

async function handleSchedulerMsg2Modal(interaction) {
  const serverId = interaction.customId.split('_')[3];
  const message2 = interaction.fields.getTextInputValue('message2');
  
  // Store message 2 in temp data
  if (!tempMessages.has(serverId)) {
    tempMessages.set(serverId, {});
  }
  tempMessages.get(serverId).message2 = message2;
  
  await interaction.reply({
    embeds: [successEmbed('Message 2 Set', 'Your second message has been set. Now click "Save Pair" to save both messages.')],
    ephemeral: true
  });
}

async function handleSchedulerSelectMsg1(interaction) {
  const serverId = interaction.customId.split('_')[3];
  const selectedValue = interaction.values[0];
  
  if (selectedValue === 'custom') {
    // Show a simple modal for custom message
    const modal = new ModalBuilder()
      .setCustomId(`scheduler_custom_msg1_${serverId}`)
      .setTitle('Enter Custom Message 1');

    const messageInput = new TextInputBuilder()
      .setCustomId('custom_message1')
      .setLabel('Custom Message 1')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter your custom message (supports color tags)')
      .setRequired(true)
      .setMaxLength(1000);

    const actionRow = new ActionRowBuilder().addComponents(messageInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  } else {
    // Store predefined message 1 in temp data
    if (!tempMessages.has(serverId)) {
      tempMessages.set(serverId, {});
    }
    tempMessages.get(serverId).message1 = selectedValue;
    
    await interaction.reply({
      embeds: [successEmbed('Message 1 Selected', `Message 1 set to: ${selectedValue.substring(0, 50)}${selectedValue.length > 50 ? '...' : ''}`)],
      ephemeral: true
    });
  }
}

async function handleSchedulerSelectMsg2(interaction) {
  const serverId = interaction.customId.split('_')[3];
  const selectedValue = interaction.values[0];
  
  if (selectedValue === 'custom') {
    // Show a simple modal for custom message
    const modal = new ModalBuilder()
      .setCustomId(`scheduler_custom_msg2_${serverId}`)
      .setTitle('Enter Custom Message 2');

    const messageInput = new TextInputBuilder()
      .setCustomId('custom_message2')
      .setLabel('Custom Message 2')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter your custom message (supports color tags)')
      .setRequired(true)
      .setMaxLength(1000);

    const actionRow = new ActionRowBuilder().addComponents(messageInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  } else {
    // Store predefined message 2 in temp data
    if (!tempMessages.has(serverId)) {
      tempMessages.set(serverId, {});
    }
    tempMessages.get(serverId).message2 = selectedValue;
    
    await interaction.reply({
      embeds: [successEmbed('Message 2 Selected', `Message 2 set to: ${selectedValue.substring(0, 50)}${selectedValue.length > 50 ? '...' : ''}`)],
      ephemeral: true
    });
  }
}

async function handleSchedulerCustomMsg1(interaction) {
  const serverId = interaction.customId.split('_')[3];
  const customMessage = interaction.fields.getTextInputValue('custom_message1');
  
  // Store custom message 1 in temp data
  if (!tempMessages.has(serverId)) {
    tempMessages.set(serverId, {});
  }
  tempMessages.get(serverId).message1 = customMessage;
  
  await interaction.reply({
    embeds: [successEmbed('Custom Message 1 Set', `Your custom message has been set: ${customMessage.substring(0, 50)}${customMessage.length > 50 ? '...' : ''}`)],
    ephemeral: true
  });
}

async function handleSchedulerCustomMsg2(interaction) {
  const serverId = interaction.customId.split('_')[3];
  const customMessage = interaction.fields.getTextInputValue('custom_message2');
  
  // Store custom message 2 in temp data
  if (!tempMessages.has(serverId)) {
    tempMessages.set(serverId, {});
  }
  tempMessages.get(serverId).message2 = customMessage;
  
  await interaction.reply({
    embeds: [successEmbed('Custom Message 2 Set', `Your custom message has been set: ${customMessage.substring(0, 50)}${customMessage.length > 50 ? '...' : ''}`)],
    ephemeral: true
  });
}