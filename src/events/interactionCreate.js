const { Events, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const { errorEmbed, orangeEmbed, successEmbed } = require('../embeds/format');
const { getServerByNickname, getServerById, getLinkedPlayer, updateBalance, recordTransaction } = require('../utils/economy');
const pool = require('../db');
const { sendRconCommand } = require('../rcon');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // Check for multiple instances
    console.log('[INSTANCE CHECK] Interaction received:', interaction.type, 'customId:', interaction.customId);
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
        console.log('[MODAL DEBUG] Full interaction object:', JSON.stringify(interaction, null, 2));
        if (interaction.customId.startsWith('edit_item_modal_')) {
          await handleEditItemModal(interaction);
        } else if (interaction.customId.startsWith('edit_kit_modal_')) {
          await handleEditKitModal(interaction);
        } else if (interaction.customId === 'test_modal') {
          console.log('[DEBUG] Found test_modal handler');
          await interaction.deferReply({ ephemeral: true });
          const value = interaction.fields.getTextInputValue('test_input');
          await interaction.editReply({ content: `Test modal worked! Value: ${value}` });
        } else if (interaction.customId === 'test_slash_modal') {
          console.log('[DEBUG] Found test_slash_modal handler');
          await interaction.deferReply({ ephemeral: true });
          const value = interaction.fields.getTextInputValue('test_input');
          await interaction.editReply({ content: `Slash modal worked! Value: ${value}` });
        } else if (interaction.customId.startsWith('adjust_quantity_modal_')) {
          console.log('[DEBUG] Found adjust_quantity_ handler, customId:', interaction.customId);
          await handleAdjustQuantityModal(interaction);
        } else if (interaction.customId.startsWith('adjust_cart_quantity_modal_')) {
          await handleAdjustCartQuantityModal(interaction);
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
        } else if (interaction.customId.startsWith('remove_shop_item_')) {
          await handleRemoveShopItem(interaction);
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
        } else if (interaction.customId.startsWith('confirm_remove_')) {
          console.log('Handling confirm remove button');
          await handleConfirmRemove(interaction);
        } else if (interaction.customId === 'cancel_remove') {
          console.log('Handling cancel remove button');
          await handleCancelRemove(interaction);
        } else if (interaction.customId.startsWith('confirm_remove_') || interaction.customId.startsWith('cancel_remove_')) {
          console.log('Handling remove-server button');
          await handleRemoveServerButton(interaction);
        } else if (interaction.customId.startsWith('adjust_quantity_')) {
          console.log('Handling adjust quantity button');
          await handleAdjustQuantity(interaction);
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

    // Get currency name for this server
    const { getCurrencyName } = require('../utils/economy');
    const currencyName = await getCurrencyName(serverId);
    
    await interaction.editReply({
      embeds: [orangeEmbed(
        '💰 Shop',
        `**Server:** ${nickname}\n**Your Balance:** ${balance} ${currencyName}\n\nSelect a category to browse items and kits:`
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
    // Get category info including role requirement
    const categoryResult = await pool.query(
      `SELECT sc.name, sc.type, sc.role, rs.nickname, sc.server_id
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

    const { name, type, role, nickname, server_id } = categoryResult[0][0];

    // Check if user has required role
    if (role && !interaction.member.roles.cache.has(role)) {
      const roleName = interaction.guild.roles.cache.get(role)?.name || 'Unknown Role';
      return interaction.editReply({
        embeds: [errorEmbed(
          'Access Denied', 
          `You need the **${roleName}** role to access the **${name}** category.\n\nContact an administrator to get access.`
        )]
      });
    }

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

    // Get currency name for this server
    const { getCurrencyName } = require('../utils/economy');
    const currencyName = await getCurrencyName(serverId);
    
    // Create embed
    const embed = orangeEmbed(
      `🛒 ${name}`,
      `**Server:** ${nickname}\n**Type:** ${type}\n**Your Balance:** ${balance} ${currencyName}\n\nSelect an item or kit to purchase:`
    );

    // Add items to embed
    if (items.length > 0) {
      const itemsList = items.map(item => 
        `**${item.display_name}** - ${item.price} ${currencyName} (${item.quantity}x)${item.timer ? ` - ${item.timer}m cooldown` : ''}`
      ).join('\n');
      embed.addFields({ name: '📦 Items', value: itemsList, inline: false });
    }

    // Add kits to embed
    if (kits.length > 0) {
      const kitsList = kits.map(kit => 
        `**${kit.display_name}** - ${kit.price} ${currencyName} (${kit.quantity}x)${kit.timer ? ` - ${kit.timer}m cooldown` : ''}`
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
        label: `${item.display_name} - ${item.price} ${currencyName}`,
        description: `Item: ${item.short_name} (${item.quantity}x)`,
        value: `item_${item.id}`
      });
    });

    kits.forEach(kit => {
      allOptions.push({
        label: `${kit.display_name} - ${kit.price} ${currencyName}`,
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

    // Get currency name for this server
    const { getCurrencyName } = require('../utils/economy');
    const currencyName = await getCurrencyName(serverId);
    
    if (balance < item.price) {
      return interaction.editReply({
        embeds: [errorEmbed('Insufficient Balance', `You need ${item.price} ${currencyName} but only have ${balance} ${currencyName}.`)]
      });
    }

    // Create confirmation embed
    const embed = orangeEmbed(
      '🛒 Purchase Confirmation',
      `**Item:** ${item.display_name}\n**Price:** ${item.price} ${currencyName}\n**Server:** ${nickname}\n**Your Balance:** ${balance} ${currencyName}\n**New Balance:** ${balance - item.price} ${currencyName}\n\nDo you want to confirm this purchase?`
    );

    // Create confirmation buttons
    const confirmCustomId = `confirm_purchase_${type}_${itemId}_${player_id}`;
    console.log('Creating confirm button with customId:', confirmCustomId);
    console.log('Button custom ID parts - type:', type, 'itemId:', itemId, 'player_id:', player_id);
    
    // Create the main action row with buttons
    const buttonRow = new ActionRowBuilder()
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

    // Create dropdown for removing items
    const removeRow = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`remove_shop_item_${type}_${itemId}_${player_id}`)
          .setPlaceholder('Remove Shop Item')
          .addOptions([
            {
              label: item.display_name,
              description: `Remove ${item.display_name} from shop`,
              value: `${type}_${itemId}`
            }
          ])
      );

    // Create button for adjusting quantity
    const quantityRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`adjust_quantity_${type}_${itemId}_${player_id}`)
          .setLabel('Adjust Quantity')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({
      embeds: [embed],
      components: [buttonRow, removeRow, quantityRow]
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
        'SELECT si.display_name, si.short_name, si.price, si.quantity, si.timer, rs.id as server_id, rs.ip, rs.port, rs.password, rs.nickname FROM shop_items si JOIN shop_categories sc ON si.category_id = sc.id JOIN rust_servers rs ON sc.server_id = rs.id WHERE si.id = ?',
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
      
      command = `inventory.giveto "${playerIgn}" "${itemData.short_name}" ${itemData.quantity}`;
    } else if (type === 'kit') {
      console.log('Confirm purchase - querying kit with ID:', itemId);
      const result = await pool.query(
        'SELECT sk.display_name, sk.kit_name, sk.price, sk.quantity, sk.timer, rs.id as server_id, rs.ip, rs.port, rs.password, rs.nickname FROM shop_kits sk JOIN shop_categories sc ON sk.category_id = sc.id JOIN rust_servers rs ON sc.server_id = rs.id WHERE sk.id = ?',
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
          
          // Get player's IGN for display
          const playerResult = await pool.query(
            'SELECT ign FROM players WHERE id = ?',
            [playerId]
          );
          const playerIgn = playerResult[0] && playerResult[0][0] ? playerResult[0][0].ign : interaction.user.username;
          
          // Create embed with player info and avatar
          const { EmbedBuilder } = require('discord.js');
          const cooldownEmbed = new EmbedBuilder()
            .setColor(0xFF6B35)
            .setTitle('⏰ Cooldown Active')
            .setDescription(`You must wait **${remaining} more minutes** before purchasing this item again.`)
            .setAuthor({
              name: playerIgn,
              iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            })
            .setTimestamp();
          
          // Send a new public message instead of editing the ephemeral one
          return interaction.followUp({
            embeds: [cooldownEmbed],
            components: []
          });
        }
      }
    }

    // Calculate total price (price per unit * quantity)
    const totalPrice = itemData.price * itemData.quantity;
    
    // Deduct balance
    await pool.query(
      'UPDATE economy SET balance = balance - ? WHERE player_id = ?',
      [totalPrice, playerId]
    );

    // Record transaction
    await pool.query(
      'INSERT INTO transactions (player_id, guild_id, amount, type, timestamp) VALUES (?, (SELECT guild_id FROM players WHERE id = ?), ?, ?, CURRENT_TIMESTAMP)',
      [playerId, playerId, -totalPrice, 'shop_purchase']
    );

    // Record cooldown if item has timer
    if (timer && timer > 0) {
      await pool.query(
        'INSERT INTO shop_cooldowns (player_id, item_type, item_id, purchased_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [playerId, type, itemId]
      );
      console.log(`[SHOP TIMER] Recorded cooldown for ${type} ${itemId} for player ${playerId}`);
    }

         // Get currency name for this server
     const { getCurrencyName } = require('../utils/economy');
     const currencyName = await getCurrencyName(itemData.server_id);
     console.log('[SHOP DELIVERY] Server ID:', itemData.server_id, 'Currency Name:', currencyName);
     
     // Send RCON command to server
     try {
       sendRconCommand(itemData.ip, itemData.port, itemData.password, command);
       console.log(`RCON Command sent to ${itemData.nickname}: ${command}`);
       
       // Send confirmation message to player in-game
       const playerName = interaction.user.username;
       const confirmMessage = `say <color=#00FF00>[SHOP]</color> <color=#FFD700>${playerName}</color> <color=#00FF00>Successfully delivered</color>`;
       sendRconCommand(itemData.ip, itemData.port, itemData.password, confirmMessage);
       console.log(`Confirmation message sent to ${itemData.nickname}: ${confirmMessage}`);
       
       // Send to admin feed
       const guildId = interaction.guildId;
       const { sendFeedEmbed } = require('../rcon');
       await sendFeedEmbed(interaction.client, guildId, itemData.nickname, 'adminfeed', `🛒 **Shop Purchase:** ${playerName} purchased ${itemData.display_name} x${itemData.quantity} for ${totalPrice} ${currencyName}`);
     } catch (error) {
       console.error(`Failed to send RCON command to ${itemData.nickname}:`, error);
     }

     // Get player's IGN for display
     const playerResult = await pool.query(
       'SELECT ign FROM players WHERE id = ?',
       [playerId]
     );
     const playerIgn = playerResult[0] && playerResult[0][0] ? playerResult[0][0].ign : interaction.user.username;
     
     // Create embed with delivery confirmation theme
     const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
     const purchaseEmbed = new EmbedBuilder()
       .setColor(0x00FF00)
       .setTitle('🛒 Zentro Express')
       .setDescription('✅ **Delivery Confirmed**')
       .addFields(
         { name: '**Item**', value: itemData.display_name, inline: false },
         { name: '**Quantity**', value: itemData.quantity.toString(), inline: false },
         { name: '**Total Cost**', value: `${totalPrice} ${currencyName}`, inline: false }
       )
       .setAuthor({
         name: playerIgn,
         iconURL: interaction.user.displayAvatarURL({ dynamic: true })
       })
       .setTimestamp()
       .setFooter({ text: 'Fast & Reliable Delivery • Zentro Express' });

     // Add static delivery image if available
     try {
       const path = require('path');
       const fs = require('fs');
       const deliveryImagePath = path.join(__dirname, '..', '..', 'assets', 'images', 'delivery_confirmation.png');
       
       console.log('[SHOP DELIVERY] Looking for image at:', deliveryImagePath);
       console.log('[SHOP DELIVERY] Image exists:', fs.existsSync(deliveryImagePath));
       
       if (fs.existsSync(deliveryImagePath)) {
         console.log('[SHOP DELIVERY] Loading delivery image...');
         const attachment = new AttachmentBuilder(deliveryImagePath, { name: 'delivery.png' });
         purchaseEmbed.setThumbnail('attachment://delivery.png');
         
         console.log('[SHOP DELIVERY] Sending message with image...');
         await interaction.followUp({
           embeds: [purchaseEmbed],
           files: [attachment]
         });
         console.log('[SHOP DELIVERY] Message sent with image successfully');
       } else {
         console.log('[SHOP DELIVERY] Image not found, sending without image...');
         // Fallback without image
         await interaction.followUp({
           embeds: [purchaseEmbed]
         });
         console.log('[SHOP DELIVERY] Message sent without image');
       }
     } catch (error) {
       console.log('[SHOP DELIVERY] Failed to load delivery image:', error.message);
       console.log('[SHOP DELIVERY] Error stack:', error.stack);
       // Fallback without image
       await interaction.followUp({
         embeds: [purchaseEmbed]
       });
     }

  } catch (error) {
    console.error('Error confirming purchase:', error);
    
    // Get player's IGN for display
    const playerResult = await pool.query(
      'SELECT ign FROM players WHERE id = ?',
      [playerId]
    );
    const playerIgn = playerResult[0] && playerResult[0][0] ? playerResult[0][0].ign : interaction.user.username;
    
    // Create embed with player info and avatar
    const { EmbedBuilder } = require('discord.js');
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Purchase Failed')
      .setDescription('Failed to process purchase. Please try again.')
      .setAuthor({
        name: playerIgn,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true })
      })
      .setTimestamp();
    
    // Send a new public message instead of editing the ephemeral one
    await interaction.followUp({
      embeds: [errorEmbed],
      components: []
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
    const pool = require('../db');
    
    // Get all servers for this guild
    const [servers] = await pool.query(
      'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
      [guildId]
    );
    
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
        // Ensure guild exists
        await pool.query(
          'INSERT INTO guilds (discord_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
          [guildId, interaction.guild?.name || 'Unknown Guild']
        );

        // Check if this exact link already exists (active or inactive)
        const [existingExactLink] = await pool.query(
          'SELECT id, is_active FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND discord_id = ? AND LOWER(ign) = LOWER(?)',
          [guildId, server.id, discordId, ign]
        );

        if (existingExactLink.length > 0) {
          const existing = existingExactLink[0];
          if (existing.is_active) {
            // Already linked - this shouldn't happen due to the check in /link command
            console.log(`Player already linked: ${ign} on ${server.nickname}`);
            linkedServers.push(server.nickname);
            continue;
          } else {
            // Reactivate inactive player
            await pool.query(
              'UPDATE players SET linked_at = CURRENT_TIMESTAMP, is_active = true, unlinked_at = NULL WHERE id = ?',
              [existing.id]
            );
            
            // Ensure economy record exists (preserve existing balance)
            await pool.query(
              'INSERT INTO economy (player_id, guild_id, balance) VALUES (?, (SELECT id FROM guilds WHERE discord_id = ?), 0) ON DUPLICATE KEY UPDATE balance = balance',
              [existing.id, guildId]
            );
            
            linkedServers.push(server.nickname);
            continue;
          }
        }

        // Check if there's an inactive record with the same IGN but no discord_id (from unlink)
        const [inactiveRecord] = await pool.query(
          'SELECT id FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND LOWER(ign) = LOWER(?) AND discord_id IS NULL AND is_active = false',
          [guildId, server.id, ign]
        );

        if (inactiveRecord.length > 0) {
          // Reactivate the inactive record and set the discord_id
          await pool.query(
            'UPDATE players SET discord_id = ?, linked_at = CURRENT_TIMESTAMP, is_active = true, unlinked_at = NULL WHERE id = ?',
            [discordId, inactiveRecord[0].id]
          );
          
          // Ensure economy record exists (preserve existing balance)
          await pool.query(
            'INSERT INTO economy (player_id, guild_id, balance) VALUES (?, (SELECT id FROM guilds WHERE discord_id = ?), 0) ON DUPLICATE KEY UPDATE balance = balance',
            [inactiveRecord[0].id, guildId]
          );
          
          linkedServers.push(server.nickname);
          continue;
        }

        // Check if IGN is already linked to a different Discord ID
        const [existingIgnLink] = await pool.query(
          'SELECT id, discord_id FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND LOWER(ign) = LOWER(?) AND is_active = true',
          [guildId, server.id, ign]
        );

        if (existingIgnLink.length > 0) {
          const existing = existingIgnLink[0];
          if (existing.discord_id != discordId) {
            throw new Error(`❌ This IGN is already linked to another Discord account on ${server.nickname}. Contact an admin to unlink.`);
          }
        }

        // Check if Discord ID is already linked to a different IGN
        const [existingDiscordLink] = await pool.query(
          'SELECT id, ign FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND discord_id = ? AND is_active = true',
          [guildId, server.id, discordId]
        );

        if (existingDiscordLink.length > 0) {
          const existing = existingDiscordLink[0];
          if (existing.ign.toLowerCase() !== ign.toLowerCase()) {
            throw new Error(`❌ Your Discord is already linked to a different IGN on ${server.nickname}. Use /unlink first.`);
          }
        }

        // Insert new player
        const [playerResult] = await pool.query(
          'INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active) VALUES ((SELECT id FROM guilds WHERE discord_id = ?), ?, ?, ?, CURRENT_TIMESTAMP, true)',
          [guildId, server.id, discordId, ign]
        );
        
        // Create economy record with guild_id
        await pool.query(
          'INSERT INTO economy (player_id, guild_id, balance) VALUES (?, (SELECT id FROM guilds WHERE discord_id = ?), 0)',
          [playerResult.insertId, guildId]
        );
        
        linkedServers.push(server.nickname);
      } catch (error) {
        console.error(`Failed to link to server ${server.nickname}:`, error);
        if (error.message.includes('already linked')) {
          errorMessage = error.message;
          break;
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
    
    // Set Discord nickname after successful linking
    try {
      const member = interaction.member;
      if (member && member.manageable && interaction.guild.ownerId !== interaction.user.id) {
        const newNickname = `${ign} 🔗`.substring(0, 28); // Cap at 28 characters for safety
        await member.setNickname(newNickname);
        console.log(`[LINK] Set nickname for ${interaction.user.tag} to: ${newNickname}`);
      }
    } catch (nicknameError) {
      console.error('[LINK] Failed to set nickname:', nicknameError);
      // Log silently, don't fail the linking process
    }
    
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

async function handleRemoveItem(interaction) {
  await interaction.deferUpdate();
  
  const parts = interaction.customId.split('_');
  const [, , type, itemId, playerId] = parts;
  const userId = interaction.user.id;

  try {
    // Get the item details
    let itemData;
    if (type === 'item') {
      const [itemResult] = await pool.query(
        `SELECT si.display_name, si.price, rs.nickname, rs.id as server_id
         FROM shop_items si 
         JOIN shop_categories sc ON si.category_id = sc.id 
         JOIN rust_servers rs ON sc.server_id = rs.id 
         WHERE si.id = ?`,
        [itemId]
      );
      itemData = itemResult[0];
    } else if (type === 'kit') {
      const [kitResult] = await pool.query(
        `SELECT sk.display_name, sk.price, rs.nickname, rs.id as server_id
         FROM shop_kits sk 
         JOIN shop_categories sc ON sk.category_id = sc.id 
         JOIN rust_servers rs ON sc.server_id = rs.id 
         WHERE sk.id = ?`,
        [itemId]
      );
      itemData = kitResult[0];
    }

    if (!itemData) {
      return interaction.editReply({
        embeds: [errorEmbed('Item Not Found', 'The item you selected to remove was not found.')]
      });
    }

    // Get currency name
    const { getCurrencyName } = require('../utils/economy');
    const currencyName = await getCurrencyName(itemData.server_id);

    // Show confirmation for removal
    const embed = orangeEmbed(
      '🗑️ Remove Item Confirmation',
      `**Item:** ${itemData.display_name}\n**Price:** ${itemData.price} ${currencyName}\n**Server:** ${itemData.nickname}\n\nAre you sure you want to remove this item from your cart?`
    );

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_remove_${type}_${itemId}_${playerId}`)
          .setLabel('Confirm Remove')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cancel_remove')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });

  } catch (error) {
    console.error('Error handling remove item:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'Failed to process item removal.')]
    });
  }
}

async function handleAdjustQuantity(interaction) {
  console.log('[BUTTON] handleAdjustQuantity called');
  console.time('showModal');
  
  try {
    // Create the most minimal modal possible
    const modal = new ModalBuilder()
      .setCustomId('test_modal')
      .setTitle('Test');

    const input = new TextInputBuilder()
      .setCustomId('test_input')
      .setLabel('Test Input')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(input);
    modal.addComponents(row);

    console.log('[BUTTON] About to show minimal modal...');
    await interaction.showModal(modal);
    console.log('[BUTTON] Minimal modal shown successfully');
  } catch (error) {
    console.error('[BUTTON] showModal error:', {
      name: error?.name,
      code: error?.code,
      raw: error?.rawError || error?.toString()
    });
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Modal failed (logged).', ephemeral: true }).catch(() => {});
    }
  } finally {
    console.timeEnd('showModal');
  }
}

async function handleAdjustQuantityModal(interaction) {
  console.log('[MODAL] Starting modal handler');
  
  try {
    // Defer immediately
    await interaction.deferReply({ ephemeral: true });
    console.log('[MODAL] Deferred reply');
    
    // Get the quantity value
    const quantity = interaction.fields.getTextInputValue('quantity');
    console.log('[MODAL] Got quantity:', quantity);
    
    // Simple validation
    const num = parseInt(quantity);
    if (isNaN(num) || num < 1 || num > 100) {
      console.log('[MODAL] Invalid quantity');
      return await interaction.editReply({
        content: '❌ Invalid quantity. Must be between 1 and 100.'
      });
    }
    
    console.log('[MODAL] Quantity is valid:', num);
    
    // Just show success for now
    await interaction.editReply({
      content: `✅ Quantity set to ${num}!`
    });
    
    console.log('[MODAL] Success response sent');
    
  } catch (error) {
    console.error('[MODAL] Error:', error);
    
    try {
      await interaction.editReply({
        content: '❌ Error processing modal.'
      });
    } catch (replyError) {
      console.error('[MODAL] Reply error:', replyError);
      await interaction.reply({
        content: '❌ Error processing modal.',
        ephemeral: true
      });
    }
  }
}

async function handleRemoveServerButton(interaction) {
  const customId = interaction.customId;
  
  if (!customId.startsWith('confirm_remove_') && !customId.startsWith('cancel_remove_')) {
    return;
  }

  const serverId = customId.split('_')[2];
  const isConfirm = customId.startsWith('confirm_remove_');

  if (!isConfirm) {
    // Cancel action
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('❌ Cancelled')
          .setDescription('Server removal has been cancelled.')
          .setTimestamp()
      ],
      components: []
    });
    return;
  }

  // Confirm removal
  try {
          // Get server details for final confirmation
      const [serverResult] = await pool.query(
        'SELECT id, nickname, ip, port, guild_id FROM rust_servers WHERE id = ?',
        [serverId]
      );

    if (serverResult.length === 0) {
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Error')
            .setDescription('Server not found or already removed.')
            .setTimestamp()
        ],
        components: []
      });
      return;
    }

          const server = serverResult[0];
      const serverName = server.nickname;

    // Begin transaction
    await pool.query('START TRANSACTION');

    try {
      // Delete the server (this will cascade to related data)
      const [deleteResult] = await pool.query('DELETE FROM rust_servers WHERE id = ?', [serverId]);

      if (deleteResult.affectedRows === 0) {
        throw new Error('Server deletion failed');
      }

      // Decrement active servers count if guild_id exists
      if (server.guild_id) {
        await decrementActiveServers(server.guild_id);
      }

      // Commit transaction
      await pool.query('COMMIT');

      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Server Removed Successfully')
        .setDescription(`**${serverName}** has been permanently removed from the bot.`)
        .addFields(
          { name: 'Removed By', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Removed At', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
          { name: 'Data Deleted', value: '• Server configuration\n• All player data\n• Economy data\n• Shop items\n• All associated data', inline: false }
        )
        .setFooter({ text: 'The server will no longer be monitored or managed by the bot.' })
        .setTimestamp();

      await interaction.update({
        embeds: [successEmbed],
        components: []
      });

    } catch (error) {
      // Rollback transaction on error
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error removing server:', error);
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Error')
          .setDescription('Failed to remove server. Please try again.')
          .setTimestamp()
      ],
      components: []
    });
  }
}

async function handleConfirmRemove(interaction) {
  await interaction.deferUpdate();
  
  const parts = interaction.customId.split('_');
  const [, , type, itemId, playerId] = parts;
  const userId = interaction.user.id;

  try {
    // Get the item details before deletion
    let itemData;
    if (type === 'item') {
      const [itemResult] = await pool.query(
        `SELECT si.display_name, si.price, rs.nickname, rs.id as server_id
         FROM shop_items si 
         JOIN shop_categories sc ON si.category_id = sc.id 
         JOIN rust_servers rs ON sc.server_id = rs.id 
         WHERE si.id = ?`,
        [itemId]
      );
      itemData = itemResult[0];
    } else if (type === 'kit') {
      const [kitResult] = await pool.query(
        `SELECT sk.display_name, sk.price, rs.nickname, rs.id as server_id
         FROM shop_kits sk 
         JOIN shop_categories sc ON sk.category_id = sc.id 
         JOIN rust_servers rs ON sc.server_id = rs.id 
         WHERE sk.id = ?`,
        [itemId]
      );
      itemData = kitResult[0];
    }

    if (!itemData) {
      return interaction.editReply({
        embeds: [errorEmbed('Item Not Found', 'The item you selected to remove was not found.')]
      });
    }

    // Get currency name
    const { getCurrencyName } = require('../utils/economy');
    const currencyName = await getCurrencyName(itemData.server_id);

    // Get player's current balance
    const [balanceResult] = await pool.query(
      'SELECT balance FROM economy WHERE player_id = ?',
      [playerId]
    );

    if (balanceResult.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Account Not Found', 'Could not find your account balance.')]
      });
    }

    const currentBalance = balanceResult[0].balance;

    // Actually remove the item from the shop
    if (type === 'item') {
      await pool.query(
        'DELETE FROM shop_items WHERE id = ?',
        [itemId]
      );
    } else if (type === 'kit') {
      await pool.query(
        'DELETE FROM shop_kits WHERE id = ?',
        [itemId]
      );
    }

    // Create embed showing item removal
    const embed = orangeEmbed(
      '🗑️ Item Removed',
      `**Item:** ${itemData.display_name}\n**Price:** ${itemData.price} ${currencyName}\n**Server:** ${itemData.nickname}\n**Current Balance:** ${currentBalance} ${currencyName}\n\nItem has been successfully removed from the shop.`
    );

    await interaction.editReply({
      embeds: [embed],
      components: []
    });

  } catch (error) {
    console.error('Error confirming remove:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'Failed to process item removal.')]
    });
  }
}

async function handleCancelRemove(interaction) {
  await interaction.deferUpdate();
  await interaction.editReply({
    embeds: [orangeEmbed('Remove Cancelled', 'Item removal has been cancelled.')],
    components: []
  });
}

async function handleRemoveShopItem(interaction) {
  await interaction.deferUpdate();
  
  const parts = interaction.customId.split('_');
  const [, , , type, itemId, playerId] = parts;
  const userId = interaction.user.id;

  try {
    // Get the item details (but don't remove from shop)
    let itemData;
    if (type === 'item') {
      const [itemResult] = await pool.query(
        `SELECT si.display_name, si.price, rs.nickname, rs.id as server_id
         FROM shop_items si 
         JOIN shop_categories sc ON si.category_id = sc.id 
         JOIN rust_servers rs ON sc.server_id = rs.id 
         WHERE si.id = ?`,
        [itemId]
      );
      itemData = itemResult[0];
    } else if (type === 'kit') {
      const [kitResult] = await pool.query(
        `SELECT sk.display_name, sk.price, rs.nickname, rs.id as server_id
         FROM shop_kits sk 
         JOIN shop_categories sc ON sk.category_id = sc.id 
         JOIN rust_servers rs ON sc.server_id = rs.id 
         WHERE sk.id = ?`,
        [itemId]
      );
      itemData = kitResult[0];
    }

    if (!itemData) {
      return interaction.editReply({
        embeds: [errorEmbed('Item Not Found', 'The item you selected was not found.')]
      });
    }

    // Get currency name
    const { getCurrencyName } = require('../utils/economy');
    const currencyName = await getCurrencyName(itemData.server_id);

    // Show message that item was removed from selection (not from shop)
    const embed = orangeEmbed(
      '🛒 Item Removed from Selection',
      `**${itemData.display_name}** has been removed from your current selection on **${itemData.nickname}**.\n\nYou can now browse the shop again.`
    );

    // Get server info to return to shop start
    const serverResult = await pool.query(
      'SELECT rs.nickname, rs.id as server_id FROM rust_servers rs WHERE rs.id = ?',
      [itemData.server_id]
    );

    if (serverResult[0] && serverResult[0].length > 0) {
      const server = serverResult[0][0];
      
      // Fetch categories for the shop
      const [categoriesResult] = await pool.query(
        `SELECT sc.id, sc.name, sc.type, sc.role
         FROM shop_categories sc
         WHERE sc.server_id = ?
         ORDER BY sc.name`,
        [server.server_id]
      );

      if (categoriesResult.length > 0) {
        // Build dropdown with role checking
        const categoryOptions = [];
        for (const category of categoriesResult) {
          const hasRole = !category.role || interaction.member.roles.cache.has(category.role);
          const lockIcon = category.role && !hasRole ? '🔒 ' : '';
          
          categoryOptions.push({
            label: `${lockIcon}${category.name}`,
            description: `${category.type} category`,
            value: category.id.toString()
          });
        }

        const row = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('shop_category_select')
              .setPlaceholder('Select a category to browse')
              .addOptions(categoryOptions)
          );

        await interaction.editReply({
          embeds: [embed],
          components: [row]
        });
      } else {
        await interaction.editReply({
          embeds: [embed]
        });
      }
    } else {
      await interaction.editReply({
        embeds: [embed]
      });
    }

  } catch (error) {
    console.error('Error removing shop item from selection:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'Failed to remove item from selection.')]
    });
  }
}





