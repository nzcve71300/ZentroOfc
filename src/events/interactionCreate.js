const { Events, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const { errorEmbed, orangeEmbed, successEmbed } = require('../embeds/format');
const { compareDiscordIds } = require('../utils/discordUtils');
const { getServerByNickname, getServerById, getLinkedPlayer, updateBalance, recordTransaction } = require('../utils/economy');
const { ensurePlayerOnAllServers } = require('../utils/autoServerLinking');
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
        console.log('[MODAL DEBUG] ALL MODALS - This should appear for ANY modal submission');
        
        // Test if ANY modal submission is being received
        if (interaction.customId === 'test_slash_modal') {
          console.log('[DEBUG] Found test_slash_modal handler');
          await interaction.deferReply({ flags: 64 });
          const value = interaction.fields.getTextInputValue('test_input');
          await interaction.editReply({ content: `Slash modal worked! Value: ${value}` });
          return;
        }
        if (interaction.customId.startsWith('edit_item_modal_')) {
          await handleEditItemModal(interaction);
        } else if (interaction.customId.startsWith('edit_kit_modal_')) {
          await handleEditKitModal(interaction);
        } else if (interaction.customId === 'test_modal') {
          console.log('[DEBUG] Found test_modal handler');
          await interaction.deferReply({ ephemeral: true });
          const value = interaction.fields.getTextInputValue('test_input');
          await interaction.editReply({ content: `Test modal worked! Value: ${value}` });

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
        if (interaction.customId.startsWith('shop_category_select')) {
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
        } else if (interaction.customId.startsWith('set_quantity_')) {
          console.log('Handling set quantity button');
          await handleSetQuantity(interaction);
        } else if (interaction.customId.startsWith('cancel_quantity_')) {
          console.log('Handling cancel quantity button');
          await interaction.update({ content: 'Quantity adjustment cancelled.', components: [] });
        } else if (interaction.customId.startsWith('rust_info_')) {
          await handleRustInfo(interaction);
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

  // Helper functions
  handleShopServerSelect,
  handleShopCategorySelect,
  handleShopItemSelect,
  handleRemoveShopItem,
  handleSchedulerDeleteSelect,
  handleSchedulerSelectMsg1,
  handleSchedulerSelectMsg2,
  handleSchedulerAddModal,
  handleSchedulerMsg1Modal,
  handleSchedulerMsg2Modal,
  handleSchedulerCustomMsg1,
  handleSchedulerCustomMsg2,
  handleAdjustQuantityModal,
  handleAdjustCartQuantityModal,
  handleLinkConfirm,
  handleLinkCancel,
  handleEditItemModal,
  handleEditKitModal,
  handleSchedulerAdd,
  handleSchedulerDelete,
  handleSchedulerEdit,
  handleSchedulerToggle,
  handleSchedulerMessage,
  handleSchedulerCustomMessage,
  handleRustInfo,
  handleSetQuantity
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
  
  // Extract server ID from customId (format: shop_category_select_<serverId>_<suffix>)
  const serverIdParts = interaction.customId.split('_');
  const serverId = serverIdParts.slice(3).join('_'); // Join all parts after the first 3 to handle server IDs with underscores
  
  try {
    // Get category info including role requirement
    const categoryResult = await pool.query(
      `SELECT sc.name, sc.type, sc.role, rs.nickname, sc.server_id
       FROM shop_categories sc
       JOIN rust_servers rs ON sc.server_id = rs.id
       WHERE sc.id = ?`,
      [categoryId]
    );

    console.log('[SHOP DEBUG] Category query result:', categoryResult);
    console.log('[SHOP DEBUG] Category ID:', categoryId);

    if (categoryResult.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Category Not Found', 'The selected category was not found.')]
      });
    }

    const { name, type, role, nickname, server_id } = categoryResult[0][0];
    console.log('[SHOP DEBUG] Extracted category data:', { name, type, role, nickname, server_id });

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

    // Get items, kits, and vehicles
    let items = [];
    let kits = [];
    let vehicles = [];

    if (type === 'items') {
      const itemsResult = await pool.query(
        'SELECT id, display_name, short_name, price, quantity, timer FROM shop_items WHERE category_id = ? ORDER BY display_name',
        [categoryId]
      );
      console.log('[SHOP DEBUG] Items query result:', itemsResult);
      items = itemsResult[0] || [];
      console.log('[SHOP DEBUG] Items array:', items);
    }

    if (type === 'kits') {
      const kitsResult = await pool.query(
        'SELECT id, display_name, kit_name, price, quantity, timer FROM shop_kits WHERE category_id = ? ORDER BY display_name',
        [categoryId]
      );
      console.log('[SHOP DEBUG] Kits query result:', kitsResult);
      kits = kitsResult[0] || [];
      console.log('[SHOP DEBUG] Kits array:', kits);
    }

    if (type === 'vehicles') {
      try {
        const vehiclesResult = await pool.query(
          'SELECT id, display_name, short_name, price, timer FROM shop_vehicles WHERE category_id = ? ORDER BY display_name',
          [categoryId]
        );
        console.log('[SHOP DEBUG] Vehicles query result:', vehiclesResult);
        vehicles = vehiclesResult[0] || [];
        console.log('[SHOP DEBUG] Vehicles array:', vehicles);
      } catch (error) {
        console.log('[SHOP] Vehicles table not found, skipping vehicles:', error.message);
        vehicles = [];
      }
    }

                // Get player balance for the specific server
        const balanceResult = await pool.query(
          `SELECT e.balance, p.id as player_id, p.discord_id, p.server_id
           FROM players p
           JOIN economy e ON p.id = e.player_id
           JOIN rust_servers rs ON p.server_id = rs.id
           WHERE p.discord_id = ? AND rs.id = ?
           LIMIT 1`,
          [userId, serverId]
        );

    console.log('[SHOP DEBUG] Balance query result:', balanceResult);
    console.log('[SHOP DEBUG] User ID:', userId, 'Server ID:', serverId);
    
    // Debug: Check if player exists on this server at all
    const playerCheck = await pool.query(
      `SELECT id, discord_id, server_id FROM players WHERE discord_id = ? AND server_id = ?`,
      [userId, serverId]
    );
    console.log('[SHOP DEBUG] Player check result:', playerCheck);
    
    // Debug: Check if player exists on ANY server
    const anyPlayerCheck = await pool.query(
      `SELECT id, discord_id, server_id FROM players WHERE discord_id = ?`,
      [userId]
    );
    console.log('[SHOP DEBUG] Any player check result:', anyPlayerCheck);
 
    let balance = 0;
    if (balanceResult[0].length > 0) {
      const balanceData = balanceResult[0][0];
      balance = balanceData.balance || 0;
      console.log('[SHOP DEBUG] Balance data:', balanceData);
      console.log('[SHOP DEBUG] Balance:', balanceData.balance);
    }
    console.log('[SHOP DEBUG] Final balance:', balance);

    // Get currency name for this server
    const { getCurrencyName } = require('../utils/economy');
    const currencyName = await getCurrencyName(serverId);
    
    // Create embed
    const embed = orangeEmbed(
      `🛒 ${name}`,
      `**Server:** ${nickname}\n**Type:** ${type}\n**Your Balance:** ${balance} ${currencyName}\n\nSelect an item, kit, or vehicle to purchase:`
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

    // Add vehicles to embed
    if (vehicles.length > 0) {
      const vehiclesList = vehicles.map(vehicle => 
        `**${vehicle.display_name}** - ${vehicle.price} ${currencyName} (${vehicle.short_name})${vehicle.timer ? ` - ${vehicle.timer}m cooldown` : ''}`
      ).join('\n');
      embed.addFields({ name: '🚗 Vehicles', value: vehiclesList, inline: false });
    }

    if (items.length === 0 && kits.length === 0 && vehicles.length === 0) {
      embed.setDescription(`${embed.data.description}\n\nNo items, kits, or vehicles available in this category.`);
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

    vehicles.forEach(vehicle => {
      allOptions.push({
        label: `${vehicle.display_name} - ${vehicle.price} ${currencyName}`,
        description: `Vehicle: ${vehicle.short_name}`,
        value: `vehicle_${vehicle.id}`
      });
    });

    console.log('[SHOP DEBUG] Total items:', items.length, 'Total kits:', kits.length, 'Total vehicles:', vehicles.length);
    console.log('[SHOP DEBUG] All options length:', allOptions.length);

    // Limit to 25 options (Discord's maximum)
    const limitedOptions = allOptions.slice(0, 25);
    const totalItems = items.length + kits.length + vehicles.length;
    const hasMoreItems = totalItems > 25;
    
    console.log('[SHOP DEBUG] Limited options length:', limitedOptions.length);
    console.log('[SHOP DEBUG] Has more items:', hasMoreItems);

    // Check if we have any options to show
    if (limitedOptions.length === 0) {
      embed.setDescription(`${embed.data.description}\n\n❌ **No items, kits, or vehicles available in this category.**`);
      await interaction.editReply({
        embeds: [embed],
        components: []
      });
      return;
    }

    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`shop_item_${categoryId}_${serverId}`)
          .setPlaceholder(`Select an item, kit, or vehicle to purchase${hasMoreItems ? ' (showing first 25)' : ''}`)
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
  const serverIdParts = interaction.customId.split('_');
  const serverId = serverIdParts.slice(3).join('_'); // Join all parts after the first 3 to handle server IDs with underscores
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
    } else if (type === 'vehicle') {
      const result = await pool.query(
        'SELECT id, display_name, short_name, price, timer FROM shop_vehicles WHERE id = ?',
        [itemId]
      );
      console.log('Vehicle query result:', result);
      itemData = result[0];
      itemType = 'vehicle';
    }

    if (!itemData || itemData.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Item Not Found', 'The selected item was not found.')]
      });
    }

    const item = itemData[0]; // Get the first item from the result

    // Get server details using the extracted server ID
    const serverResult = await pool.query(
      'SELECT id as server_id, nickname FROM rust_servers WHERE id = ?',
      [serverId]
    );

    if (!serverResult || serverResult.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Server Not Found', 'The server was not found.')]
      });
    }

    const nickname = serverResult[0][0].nickname;

    // Now get player balance for the specific server
    const balanceResult = await pool.query(
      `SELECT e.balance, p.id as player_id
       FROM players p
       JOIN economy e ON p.id = e.player_id
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.discord_id = ? AND rs.id = ?
       LIMIT 1`,
      [userId, serverId]
    );
    
    console.log('Balance result:', balanceResult);

    if (!balanceResult || balanceResult[0].length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Account Not Linked', 'You must link your Discord account to your in-game character first.\n\nUse `/link <in-game-name>` to link your account before using this command.')]
      });
    }

    let { balance, player_id } = balanceResult[0][0];
    console.log('Extracted balance data:', balanceResult[0][0]);
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
      balance = updatedBalanceResult[0] ? updatedBalanceResult[0][0].balance : 0;
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

    // Create button for adjusting quantity (only for items, not kits)
    let components = [buttonRow, removeRow];
    
    if (type === 'item') {
      const quantityRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`adjust_quantity_${type}_${itemId}_${player_id}`)
            .setLabel('Adjust Quantity')
            .setStyle(ButtonStyle.Secondary)
        );
      components.push(quantityRow);
    }

    await interaction.editReply({
      embeds: [embed],
      components: components
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
  
  const [, , type, itemId, playerId, adjustedQuantity] = parts;
  const userId = interaction.user.id;
  
  console.log('handleConfirmPurchase - parsed values:', { type, itemId, playerId, userId, adjustedQuantity });
  console.log('handleConfirmPurchase - full customId:', interaction.customId);
  console.log('handleConfirmPurchase - parts array:', parts);
  
  try {
    let itemData;
    let command;
    let timer = null;
    let finalQuantity = null;
    
    // Calculate quantity to use (adjusted quantity or default from database)
    const quantityToUse = adjustedQuantity ? parseInt(adjustedQuantity) : null;

    if (type === 'item') {
      console.log('Confirm purchase - querying item with ID:', itemId);
      const result = await pool.query(
        'SELECT si.display_name, si.short_name, si.price, si.quantity, si.timer, rs.id as server_id, rs.ip, rs.port, rs.password, rs.nickname FROM shop_items si JOIN shop_categories sc ON si.category_id = sc.id JOIN rust_servers rs ON sc.server_id = rs.id WHERE si.id = ?',
        [itemId]
      );
      console.log('Confirm purchase - item query result:', result);
      console.log('Confirm purchase - item query result[0]:', result[0]);
      console.log('Confirm purchase - item query result[0][0]:', result[0] && result[0][0] ? result[0][0] : null);
      itemData = result[0] && result[0][0] ? result[0][0] : null;
      timer = itemData ? itemData.timer : null;
      
      // Get player's IGN for the command
      const playerResult = await pool.query(
        'SELECT ign FROM players WHERE id = ?',
        [playerId]
      );
      const playerIgn = playerResult[0] && playerResult[0][0] ? playerResult[0][0].ign : interaction.user.username;
      
      // Calculate final quantity for this item
      // If user adjusted quantity, use it as multiplier; otherwise use base quantity
      finalQuantity = quantityToUse ? (itemData.quantity * quantityToUse) : itemData.quantity;
      console.log('[DEBUG] Item quantity calculation:', {
        itemName: itemData.display_name,
        baseQuantity: itemData.quantity,
        userMultiplier: quantityToUse,
        finalQuantity: finalQuantity
      });
      command = `inventory.giveto "${playerIgn}" "${itemData.short_name}" ${finalQuantity}`;
      console.log(`[SHOP COMMAND DEBUG] Generated command for item: ${command}`);
      console.log(`[SHOP COMMAND DEBUG] Item data:`, {
        display_name: itemData.display_name,
        short_name: itemData.short_name,
        playerIgn: playerIgn,
        finalQuantity: finalQuantity
      });
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
      
      // Calculate final quantity for this kit
      // If user adjusted quantity, use it as multiplier; otherwise use base quantity
      finalQuantity = quantityToUse ? (itemData.quantity * quantityToUse) : itemData.quantity;
      
      // For kits, we'll add them to the delivery queue instead of giving directly
      // The command will be set to null since we're using the queue system
      command = null;
    } else if (type === 'vehicle') {
      console.log('Confirm purchase - querying vehicle with ID:', itemId);
      const result = await pool.query(
        'SELECT sv.display_name, sv.short_name, sv.price, sv.timer, rs.id as server_id, rs.ip, rs.port, rs.password, rs.nickname FROM shop_vehicles sv JOIN shop_categories sc ON sv.category_id = sc.id JOIN rust_servers rs ON sc.server_id = rs.id WHERE sv.id = ?',
        [itemId]
      );
      console.log('Confirm purchase - vehicle query result:', result);
      itemData = result[0] && result[0][0] ? result[0][0] : null;
      timer = itemData ? itemData.timer : null;
      
      // Get player's IGN for the command
      const playerResult = await pool.query(
        'SELECT ign FROM players WHERE id = ?',
        [playerId]
      );
      const playerIgn = playerResult[0] && playerResult[0][0] ? playerResult[0][0].ign : interaction.user.username;
      
      // For vehicles, we need to get the player's position first
      // The command will be set to null initially, and we'll handle position tracking
      command = null;
      
      // Set finalQuantity for vehicles (always 1 since vehicles don't have quantity)
      finalQuantity = 1;
      
      // Calculate total price for vehicle
      const totalPrice = itemData.price;
      
      // Check if player has enough balance BEFORE storing request
      const [balanceResult] = await pool.query(
        'SELECT balance FROM economy WHERE player_id = ?',
        [playerId]
      );
      
      const currentBalance = balanceResult[0]?.balance || 0;
      
      if (currentBalance < totalPrice) {
        // Get currency name for error message
        const { getCurrencyName } = require('../utils/economy');
        const currencyName = await getCurrencyName(itemData.server_id);
        
        const { EmbedBuilder } = require('discord.js');
        const insufficientFundsEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Insufficient Funds')
          .setDescription(`You don't have enough ${currencyName} to purchase this vehicle.`)
          .addFields(
            { name: '**Required**', value: `${totalPrice.toLocaleString()} ${currencyName}`, inline: true },
            { name: '**Your Balance**', value: `${currentBalance.toLocaleString()} ${currencyName}`, inline: true },
            { name: '**Short**', value: `${(totalPrice - currentBalance).toLocaleString()} ${currencyName}`, inline: true }
          )
          .setAuthor({
            name: playerIgn,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true })
          })
          .setTimestamp();
        
        return interaction.followUp({
          embeds: [insufficientFundsEmbed],
          components: []
        });
      }
      
      // Check timer/cooldown for vehicles BEFORE storing request
      if (itemData.timer && itemData.timer > 0) {
        console.log(`[VEHICLE TIMER] Checking cooldown for vehicle ${itemId}, timer: ${itemData.timer} minutes`);
        
        // Check if player has purchased this vehicle recently
        const cooldownResult = await pool.query(
          'SELECT purchased_at FROM shop_cooldowns WHERE player_id = ? AND item_type = ? AND item_id = ? ORDER BY purchased_at DESC LIMIT 1',
          [playerId, 'vehicle', itemId]
        );
        
        if (cooldownResult[0] && cooldownResult[0].length > 0) {
          const lastPurchase = new Date(cooldownResult[0][0].purchased_at);
          const now = new Date();
          const timeDiff = (now - lastPurchase) / (1000 * 60); // Convert to minutes
          
          console.log(`[VEHICLE TIMER] Last purchase: ${lastPurchase}, Time diff: ${timeDiff} minutes, Timer: ${itemData.timer} minutes`);
          
          if (timeDiff < itemData.timer) {
            const remaining = Math.ceil(itemData.timer - timeDiff);
            
            const { EmbedBuilder } = require('discord.js');
            const cooldownEmbed = new EmbedBuilder()
              .setColor(0xFF6B35)
              .setTitle('⏰ Cooldown Active')
              .setDescription(`You must wait **${remaining} more minutes** before purchasing this vehicle again.`)
              .setAuthor({
                name: playerIgn,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
              })
              .setTimestamp();
            
            return interaction.followUp({
              embeds: [cooldownEmbed],
              components: []
            });
          }
        }
      }
      
      // Store vehicle purchase request for position tracking
      const vehiclePurchaseKey = `${itemData.server_id}:${playerIgn}:${itemData.short_name}`;
      global.vehiclePurchaseRequests = global.vehiclePurchaseRequests || new Map();
      global.vehiclePurchaseRequests.set(vehiclePurchaseKey, {
        playerIgn,
        shortName: itemData.short_name,
        displayName: itemData.display_name,
        serverId: itemData.server_id,
        ip: itemData.ip,
        port: itemData.port,
        password: itemData.password,
        nickname: itemData.nickname,
        playerId,
        userId,
        price: itemData.price,
        vehicleId: itemId,
        timer: itemData.timer,
        interaction,
        timestamp: Date.now()
      });

      console.log(`[VEHICLE PURCHASE] Stored request for ${playerIgn}: ${itemData.short_name} on server ${itemData.server_id}`);
      
      // Set a timeout to clean up the request if no position response is received
      setTimeout(() => {
        if (global.vehiclePurchaseRequests && global.vehiclePurchaseRequests.has(vehiclePurchaseKey)) {
          console.log(`[VEHICLE PURCHASE] Timeout reached for ${playerIgn} - ${itemData.short_name}, cleaning up request`);
          global.vehiclePurchaseRequests.delete(vehiclePurchaseKey);
          
          // Send timeout message to Discord
          try {
            const { errorEmbed } = require('../../embeds/format');
            const embed = errorEmbed(
              'Purchase Timeout',
              `Vehicle purchase timed out. Please try again or contact an administrator if the issue persists.`
            );
            interaction.editReply({
              embeds: [embed],
              components: []
            });
          } catch (discordError) {
            console.error('[VEHICLE PURCHASE] Error sending timeout message to Discord:', discordError);
          }
        }
      }, 30000); // 30 second timeout
      
      // Request player position
      console.log(`[VEHICLE RCON DEBUG] Requesting position for ${playerIgn} on server ${itemData.nickname}`);
      console.log(`[VEHICLE RCON DEBUG] Server IP: ${itemData.ip}, Port: ${itemData.port}`);
       try {
         const posResult = await sendRconCommand(itemData.ip, itemData.port, itemData.password, `printpos "${playerIgn}"`);
         console.log(`[VEHICLE RCON DEBUG] Position request result:`, posResult);
       } catch (error) {
         console.error(`[VEHICLE RCON ERROR] Failed to request position:`, error);
       }
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

    // Calculate total price (admin's price * user's multiplier)
    const totalPrice = itemData.price * (quantityToUse || 1);
    
    // Check if player has enough balance
    const [balanceResult] = await pool.query(
      'SELECT balance FROM economy WHERE player_id = ?',
      [playerId]
    );
    
    const currentBalance = balanceResult[0]?.balance || 0;
    
    if (currentBalance < totalPrice) {
      // Get currency name for error message
      const { getCurrencyName } = require('../utils/economy');
      const currencyName = await getCurrencyName(itemData.server_id);
      console.log('[INSUFFICIENT FUNDS] Server ID:', itemData.server_id, 'Currency Name:', currencyName);
      
      // Get player's IGN for display
      const playerResult = await pool.query(
        'SELECT ign FROM players WHERE id = ?',
        [playerId]
      );
      const playerIgn = playerResult[0] && playerResult[0][0] ? playerResult[0][0].ign : interaction.user.username;
      
      const { EmbedBuilder } = require('discord.js');
      const insufficientFundsEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Insufficient Funds')
        .setDescription(`You don't have enough ${currencyName} to purchase this item.`)
        .addFields(
          { name: '**Required**', value: `${totalPrice.toLocaleString()} ${currencyName}`, inline: true },
          { name: '**Your Balance**', value: `${currentBalance.toLocaleString()} ${currencyName}`, inline: true },
          { name: '**Short**', value: `${(totalPrice - currentBalance).toLocaleString()} ${currencyName}`, inline: true }
        )
        .setAuthor({
          name: playerIgn,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        })
        .setTimestamp();
      
      return interaction.followUp({
        embeds: [insufficientFundsEmbed],
        components: []
      });
    }
    
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
     
     // Handle kits vs items differently
     const guildId = interaction.guildId;
     const { sendFeedEmbed } = require('../rcon');
     const playerName = interaction.user.username;
     
     if (type === 'kit') {
       // For ALL kits, add to delivery queue instead of giving directly
       console.log(`[KIT QUEUE] Adding ${finalQuantity} kits to delivery queue for player ${playerId}`);
       
       // Insert into kit delivery queue
       const [insertResult] = await pool.query(
         `INSERT INTO kit_delivery_queue (
           player_id, guild_id, server_id, kit_id, kit_name, display_name,
           remaining_quantity, original_quantity, price_per_kit, total_paid
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
         [
           playerId, guildId, itemData.server_id, itemId, itemData.kit_name, 
           itemData.display_name, finalQuantity, finalQuantity, 
           itemData.price, totalPrice
         ]
       );
       
       console.log(`[KIT QUEUE] Added to queue with ID: ${insertResult.insertId}`);
       
       // Send confirmation message to player in-game (same as items)
       const confirmMessage = `say <color=#00FF00>[SHOP]</color> <color=#FFD700>${playerName}</color> <color=#00FF00>Successfully delivered</color>`;
       try {
         console.log(`[KIT RCON DEBUG] Attempting to send confirmation message to ${itemData.nickname}:`);
         console.log(`[KIT RCON DEBUG] Server IP: ${itemData.ip}, Port: ${itemData.port}`);
         console.log(`[KIT RCON DEBUG] Message: ${confirmMessage}`);
         const confirmResult = await sendRconCommand(itemData.ip, itemData.port, itemData.password, confirmMessage);
         console.log(`Confirmation message sent to ${itemData.nickname}: ${confirmMessage}`);
       } catch (error) {
         console.error(`[KIT RCON ERROR] Failed to send confirmation message to ${itemData.nickname}:`, error);
       }
       
       // Send to admin feed
       await sendFeedEmbed(interaction.client, guildId, itemData.nickname, 'adminfeed', `🛒 **Kit Purchase:** ${playerName} purchased ${itemData.display_name} x${finalQuantity} for ${totalPrice} ${currencyName} (Added to delivery queue)`);
       
     } else {
       // For items only, deliver immediately as before
       try {
         console.log(`[SHOP RCON DEBUG] Attempting to send command to ${itemData.nickname}:`);
         console.log(`[SHOP RCON DEBUG] Server IP: ${itemData.ip}, Port: ${itemData.port}`);
         console.log(`[SHOP RCON DEBUG] Command: ${command}`);
         console.log(`[SHOP RCON DEBUG] Full itemData:`, JSON.stringify(itemData, null, 2));
         
         const rconResult = await sendRconCommand(itemData.ip, itemData.port, itemData.password, command);
         console.log(`RCON Command sent to ${itemData.nickname}: ${command}`);
         
         // Send confirmation message to player in-game
         const confirmMessage = `say <color=#00FF00>[SHOP]</color> <color=#FFD700>${playerName}</color> <color=#00FF00>Successfully delivered</color>`;
         
         const confirmResult = await sendRconCommand(itemData.ip, itemData.port, itemData.password, confirmMessage);
         console.log(`Confirmation message sent to ${itemData.nickname}: ${confirmMessage}`);
         
         // Send to admin feed
         await sendFeedEmbed(interaction.client, guildId, itemData.nickname, 'adminfeed', `🛒 **Shop Purchase:** ${playerName} purchased ${itemData.display_name} x${finalQuantity} for ${totalPrice} ${currencyName}`);
       } catch (error) {
         console.error(`[SHOP RCON ERROR] Failed to send RCON command to ${itemData.nickname}:`, error);
       }
     }

     // Get player's IGN for display
     const playerResult = await pool.query(
       'SELECT ign FROM players WHERE id = ?',
       [playerId]
     );
     const playerIgn = playerResult[0] && playerResult[0][0] ? playerResult[0][0].ign : interaction.user.username;
     
     // Create embed with appropriate theme based on delivery type
     const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
     let purchaseEmbed;
     
     if (type === 'kit') {
       // Kit delivery confirmation - ALL kits use the queue system now
       purchaseEmbed = new EmbedBuilder()
         .setColor(0xFFD700)
         .setTitle('🛒 Zentro Express')
         .setDescription('✅ **Delivery Confirmed**\n\n**Use the here take this emote in game to claim your kit**')
         .addFields(
           { name: '**Item**', value: itemData.display_name, inline: false },
           { name: '**Quantity**', value: finalQuantity.toString(), inline: false },
           { name: '**Total Cost**', value: `${totalPrice} ${currencyName}`, inline: false }
         )
         .setAuthor({
           name: playerIgn,
           iconURL: interaction.user.displayAvatarURL({ dynamic: true })
         })
         .setTimestamp()
         .setFooter({ text: 'Fast & Reliable Delivery • Zentro Express' });
     } else {
       // Immediate delivery confirmation for items
       purchaseEmbed = new EmbedBuilder()
         .setColor(0x00FF00)
         .setTitle('🛒 Zentro Express')
         .setDescription('✅ **Delivery Confirmed**')
         .addFields(
           { name: '**Item**', value: itemData.display_name, inline: false },
           { name: '**Quantity**', value: finalQuantity.toString(), inline: false },
           { name: '**Total Cost**', value: `${totalPrice} ${currencyName}`, inline: false }
         )
         .setAuthor({
           name: playerIgn,
           iconURL: interaction.user.displayAvatarURL({ dynamic: true })
         })
         .setTimestamp()
         .setFooter({ text: 'Fast & Reliable Delivery • Zentro Express' });
     }

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
         const message = await interaction.followUp({
           embeds: [purchaseEmbed],
           files: [attachment]
         });
         console.log('[SHOP DELIVERY] Message sent with image successfully');
         
         // Update the queue record with message ID for tracking (no reactions needed)
         if (type === 'kit') {
           await pool.query(
             'UPDATE kit_delivery_queue SET message_id = ?, channel_id = ? WHERE player_id = ? AND kit_id = ? AND remaining_quantity = ?',
             [message.id, message.channelId, playerId, itemId, finalQuantity]
           );
           console.log(`[KIT QUEUE] Updated message ID: ${message.id}`);
         }
       } else {
         console.log('[SHOP DELIVERY] Image not found, sending without image...');
         // Fallback without image
         const message = await interaction.followUp({
           embeds: [purchaseEmbed]
         });
         console.log('[SHOP DELIVERY] Message sent without image');
         
         // Update the queue record with message ID for tracking (no reactions needed)
         if (type === 'kit') {
           await pool.query(
             'UPDATE kit_delivery_queue SET message_id = ?, channel_id = ? WHERE player_id = ? AND kit_id = ? AND remaining_quantity = ?',
             [message.id, message.channelId, playerId, itemId, finalQuantity]
           );
           console.log(`[KIT QUEUE] Updated message ID: ${message.id}`);
         }
       }
     } catch (error) {
       console.log('[SHOP DELIVERY] Failed to load delivery image:', error.message);
       console.log('[SHOP DELIVERY] Error stack:', error.stack);
       // Fallback without image
       const message = await interaction.followUp({
         embeds: [purchaseEmbed]
       });
       
       // Add reaction for kit queue messages
       if (type === 'kit') {
         await message.react('📦');
         // Update the queue record with message ID
         await pool.query(
           'UPDATE kit_delivery_queue SET message_id = ?, channel_id = ? WHERE player_id = ? AND kit_id = ? AND remaining_quantity = ?',
           [message.id, message.channelId, playerId, itemId, finalQuantity]
         );
         console.log(`[KIT QUEUE] Added reaction and updated message ID: ${message.id}`);
       }
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
  
  // Parse custom ID: link_confirm_${discordGuildId}_${discordId}_${ign}
  // IGN might contain underscores, so we need to handle this carefully
  const parts = interaction.customId.split('_');
  const discordGuildId = parts[2];
  const discordId = parts[3];
  // IGN is everything after the discord ID, joined back together
  const ign = parts.slice(4).join('_');
  
  // 🛡️ FUTURE-PROOF IGN HANDLING: Preserve original case, only trim spaces
  const normalizedIgn = ign.trim(); // Only trim spaces, preserve case and special characters
  
  console.log('🔍 Link Confirm Debug:', { discordGuildId, discordId, ign, normalizedIgn });
  
  try {
    const pool = require('../db');
    
    // Get all servers for this guild
    const [servers] = await pool.query(
      'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
      [discordGuildId]
    );
    
    if (servers.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('No Servers', 'No servers found in this guild.')],
        components: []
      });
    }

    // ✅ CRITICAL CHECK: Verify THIS SPECIFIC Discord user has no active links in THIS guild
    const [activeDiscordLinks] = await pool.query(
      `SELECT p.*, rs.nickname 
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND p.discord_id = ? 
       AND p.is_active = true`,
      [discordGuildId, discordId]
    );

    if (activeDiscordLinks.length > 0) {
      const currentIgn = activeDiscordLinks[0].ign;
      const discordServerList = activeDiscordLinks.map(p => p.nickname).join(', ');
      
      return interaction.editReply({
        embeds: [orangeEmbed('Already Linked', `You are already linked to **${currentIgn}** on: ${discordServerList}\n\n**⚠️ ONE-TIME LINKING:** You can only link once per guild. Contact an admin to unlink you if you need to change your name.`)],
        components: []
      });
    }

    // ✅ CRITICAL CHECK: Verify IGN is not actively linked to anyone else
    const [activeIgnLinks] = await pool.query(
      `SELECT p.*, rs.nickname 
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND LOWER(p.ign) = LOWER(?) 
       AND p.is_active = true`,
      [discordGuildId, normalizedIgn]
    );

    if (activeIgnLinks.length > 0) {
      // Check if it's the same user trying to link the same IGN (should be allowed)
      const sameUserLink = activeIgnLinks.find(link => compareDiscordIds(link.discord_id, discordId));
      
      if (sameUserLink) {
        console.log(`[LINK DEBUG] Same user trying to link same IGN - allowing update`);
        // Allow the user to update their existing link - continue to confirmation
      } else {
        // IGN is actively linked to someone else
        const existingDiscordId = activeIgnLinks[0].discord_id;
        const ignServerList = activeIgnLinks.map(p => p.nickname).join(', ');
        
        console.log(`[LINK DEBUG] IGN ${normalizedIgn} is actively linked to Discord ID ${existingDiscordId}, blocking new user ${discordId}`);
        return interaction.editReply({
          embeds: [orangeEmbed('IGN Already Linked', `The in-game name **${normalizedIgn}** is already linked to another Discord account on: ${ignServerList}\n\nPlease use a different in-game name or contact an admin.`)],
          components: []
        });
      }
    }

    // Confirm link for all servers
    const linkedServers = [];
    let errorMessage = null;
    
    for (const server of servers) {
      try {
        // Ensure guild exists
        await pool.query(
          'INSERT INTO guilds (discord_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
          [discordGuildId, interaction.guild?.name || 'Unknown Guild']
        );

        // ✅ BULLETPROOF INSERT: Check for existing record first, then insert or update
        const [existingPlayer] = await pool.query(
          'SELECT id FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND discord_id = ?',
          [discordGuildId, server.id, discordId]
        );
        
        let playerResult;
        if (existingPlayer.length > 0) {
          // Update existing record
          const [updateResult] = await pool.query(
            'UPDATE players SET ign = ?, linked_at = CURRENT_TIMESTAMP, is_active = true, unlinked_at = NULL WHERE id = ?',
            [normalizedIgn, existingPlayer[0].id]
          );
          playerResult = { insertId: existingPlayer[0].id };
        } else {
          // Insert new record
          const [insertResult] = await pool.query(
            'INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active) VALUES ((SELECT id FROM guilds WHERE discord_id = ?), ?, ?, ?, CURRENT_TIMESTAMP, true)',
            [discordGuildId, server.id, discordId, normalizedIgn]
          );
          playerResult = insertResult;
        }
        
        // Create economy record with starting balance
        // Get starting balance from eco_games_config
        const [configResult] = await pool.query(
          'SELECT setting_value FROM eco_games_config WHERE server_id = ? AND setting_name = ?',
          [server.id, 'starting_balance']
        );
        
        let startingBalance = 0; // Default starting balance
        if (configResult.length > 0) {
          startingBalance = parseInt(configResult[0].setting_value) || 0;
        }
        
        console.log(`[LINK] Creating economy record for player ${normalizedIgn} with starting balance: ${startingBalance} (server: ${server.nickname})`);
        
        await pool.query(
          'INSERT INTO economy (player_id, guild_id, balance) VALUES (?, (SELECT guild_id FROM players WHERE id = ?), ?) ON DUPLICATE KEY UPDATE balance = balance',
          [playerResult.insertId, playerResult.insertId, startingBalance]
        );
        
        linkedServers.push(server.nickname);
      } catch (error) {
        console.error(`Failed to link to server ${server.nickname}:`, error);
        
        // Check for specific database constraint violations
        if (error.message.includes('Duplicate entry') || error.message.includes('UNIQUE constraint failed')) {
          errorMessage = `❌ This IGN is already linked to another Discord account on ${server.nickname}. Contact an admin to unlink.`;
          break;
        }
        
        errorMessage = `❌ Failed to link to ${server.nickname}: ${error.message}`;
        break;
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
    
    // Create ZentroLinked role if it doesn't exist and assign it to the user
    try {
      const guild = interaction.guild;
      let zentroLinkedRole = guild.roles.cache.find(role => role.name === 'ZentroLinked');
      
      if (!zentroLinkedRole) {
        console.log(`[ROLE] Creating ZentroLinked role for guild: ${guild.name}`);
        zentroLinkedRole = await guild.roles.create({
          name: 'ZentroLinked',
          color: '#00ff00', // Green color
          reason: 'Auto-created role for linked players'
        });
        console.log(`[ROLE] Successfully created ZentroLinked role with ID: ${zentroLinkedRole.id}`);
      }
      
      // Assign the role to the user
      const member = interaction.member;
      if (member && !member.roles.cache.has(zentroLinkedRole.id)) {
        await member.roles.add(zentroLinkedRole);
        console.log(`[ROLE] Assigned ZentroLinked role to user: ${member.user.username}`);
      }
    } catch (roleError) {
      console.log('Could not create/assign ZentroLinked role:', roleError.message);
    }
    
    // Set Discord nickname after successful linking
    try {
      const member = interaction.member;
      if (member && member.manageable && interaction.guild.ownerId !== interaction.user.id) {
        // Add a small delay to ensure Discord processes the role assignment first
        await new Promise(resolve => setTimeout(resolve, 500));
        await member.setNickname(normalizedIgn);
        console.log(`[NICKNAME] Set nickname for ${member.user.username} to "${normalizedIgn}"`);
      }
    } catch (nicknameError) {
      console.log('Could not set nickname:', nicknameError.message);
    }

    const embed = successEmbed(
      '✅ Account Linked Successfully!',
      `Your Discord account has been linked to **${normalizedIgn}** on: **${serverList}**\n\nYou can now use:\n• \`/balance\` - Check your balance\n• \`/daily\` - Claim daily rewards\n• \`/shop\` - Buy items and kits\n• \`/blackjack\` - Play blackjack\n\n**⚠️ Remember:** This is a one-time link. Contact an admin if you need to change your linked name.`
    );

    await interaction.editReply({
      embeds: [embed],
      components: []
    });

    console.log(`[LINK] Successfully linked ${discordId} to ${normalizedIgn} on ${serverList}`);
    
    // 🔗 AUTO-SERVER-LINKING: Ensure player exists on ALL servers in this guild
    try {
      console.log(`🔗 AUTO-SERVER-LINKING: Starting cross-server player creation for ${normalizedIgn}`);
      
      // Get the database guild ID
      const [guildResult] = await pool.query(
        'SELECT id FROM guilds WHERE discord_id = ?',
        [discordGuildId]
      );
      
      if (guildResult.length > 0) {
        const dbGuildId = guildResult[0].id;
        
        // Ensure player exists on all servers
        const autoLinkResult = await ensurePlayerOnAllServers(dbGuildId, discordId, normalizedIgn);
        
        if (autoLinkResult.success) {
          console.log(`🔗 AUTO-SERVER-LINKING: Successfully ensured ${normalizedIgn} exists on ${autoLinkResult.totalServers} servers (${autoLinkResult.createdCount} created, ${autoLinkResult.existingCount} existing)`);
        } else {
          console.log(`⚠️ AUTO-SERVER-LINKING: Failed to ensure ${normalizedIgn} on all servers: ${autoLinkResult.error}`);
        }
      }
    } catch (autoLinkError) {
      console.log(`⚠️ AUTO-SERVER-LINKING: Error during cross-server linking: ${autoLinkError.message}`);
    }

  } catch (error) {
    console.error('Error in handleLinkConfirm:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Link Failed', 'An unexpected error occurred. Please try again or contact an admin.')],
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
  
  try {
    const parts = interaction.customId.split('_');
    const [, , type, itemId, playerId] = parts;
    console.log('[BUTTON] Parsed parts:', { type, itemId, playerId });

    // Prevent quantity adjustment for kits
    if (type === 'kit') {
      await interaction.reply({
        content: '❌ Quantity adjustment is not available for kits. Kits are delivered one at a time.',
        ephemeral: true
      });
      return;
    }

    // Create buttons for different quantities
    const quantityRow1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`set_quantity_${type}_${itemId}_${playerId}_1`)
          .setLabel('1')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`set_quantity_${type}_${itemId}_${playerId}_5`)
          .setLabel('5')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`set_quantity_${type}_${itemId}_${playerId}_10`)
          .setLabel('10')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`set_quantity_${type}_${itemId}_${playerId}_25`)
          .setLabel('25')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`set_quantity_${type}_${itemId}_${playerId}_50`)
          .setLabel('50')
          .setStyle(ButtonStyle.Secondary)
      );

    const quantityRow2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`set_quantity_${type}_${itemId}_${playerId}_100`)
          .setLabel('100')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`cancel_quantity_${type}_${itemId}_${playerId}`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
      );

    await interaction.reply({
      content: 'Select a quantity:',
      components: [quantityRow1, quantityRow2],
      ephemeral: true
    });

  } catch (error) {
    console.error('[BUTTON] Error showing quantity buttons:', error);
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

async function handleAdjustCartQuantityModal(interaction) {
  console.log('[CART MODAL] Starting cart quantity modal handler');
  
  try {
    // Defer immediately
    await interaction.deferReply({ ephemeral: true });
    console.log('[CART MODAL] Deferred reply');
    
    // Get the quantity value
    const quantity = interaction.fields.getTextInputValue('quantity');
    console.log('[CART MODAL] Got quantity:', quantity);
    
    // Simple validation
    const num = parseInt(quantity);
    if (isNaN(num) || num < 1 || num > 100) {
      console.log('[CART MODAL] Invalid quantity');
      return await interaction.editReply({
        content: '❌ Invalid quantity. Must be between 1 and 100.'
      });
    }
    
    console.log('[CART MODAL] Quantity is valid:', num);
    
    // Just show success for now
    await interaction.editReply({
      content: `✅ Cart quantity set to ${num}!`
    });
    
    console.log('[CART MODAL] Success response sent');
    
  } catch (error) {
    console.error('[CART MODAL] Error:', error);
    
    try {
      await interaction.editReply({
        content: '❌ Error processing cart quantity modal.'
      });
    } catch (replyError) {
      console.error('[CART MODAL] Reply error:', replyError);
      await interaction.reply({
        content: '❌ Error processing cart quantity modal.',
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

        async function handleSetQuantity(interaction) {
          try {
            const parts = interaction.customId.split('_');
            const [, , type, itemId, playerId, quantity] = parts;
            const numQuantity = parseInt(quantity);

            console.log('[SET_QUANTITY] Setting quantity multiplier:', { type, itemId, playerId, quantity: numQuantity });

            // Prevent quantity adjustment for kits
            if (type === 'kit') {
              await interaction.update({
                content: '❌ Quantity adjustment is not available for kits. Kits are delivered one at a time.',
                components: []
              });
              return;
            }

            // Get the original item details (don't update the shop database)
            let itemData;
            if (type === 'item') {
              const [itemResult] = await pool.query(
                `SELECT si.display_name, si.price, si.quantity as base_quantity, rs.nickname, rs.id as server_id
                 FROM shop_items si 
                 JOIN shop_categories sc ON si.category_id = sc.id 
                 JOIN rust_servers rs ON sc.server_id = rs.id 
                 WHERE si.id = ?`,
                [itemId]
              );
              itemData = itemResult[0];
            } else if (type === 'kit') {
              const [kitResult] = await pool.query(
                `SELECT sk.display_name, sk.price, sk.quantity as base_quantity, rs.nickname, rs.id as server_id
                 FROM shop_kits sk 
                 JOIN shop_categories sc ON sk.category_id = sc.id 
                 JOIN rust_servers rs ON sc.server_id = rs.id 
                 WHERE sk.id = ?`,
                [itemId]
              );
              itemData = kitResult[0];
            }

            if (!itemData) {
              return interaction.update({
                content: '❌ Error: Item not found.',
                components: []
              });
            }

            // Calculate the actual quantity (admin's base_quantity × user's multiplier)
            const actualQuantity = itemData.base_quantity * numQuantity;

            // Get currency name
            const { getCurrencyName } = require('../utils/economy');
            const currencyName = await getCurrencyName(itemData.server_id);

            // Calculate new total price (admin's price × user's multiplier)
            const newTotalPrice = itemData.price * numQuantity;

            // Get player balance
            const [balanceResult] = await pool.query(
              'SELECT balance FROM economy WHERE player_id = ?',
              [playerId]
            );
            
            const balance = balanceResult[0]?.balance || 0;

            // Check if player has enough balance
            if (balance < newTotalPrice) {
              return interaction.update({
                content: `❌ **Insufficient Funds!**\n\n**Item:** ${itemData.display_name}\n**Quantity:** ${actualQuantity}\n**Total Price:** ${newTotalPrice.toLocaleString()} ${currencyName}\n**Your Balance:** ${balance.toLocaleString()} ${currencyName}\n**Short:** ${(newTotalPrice - balance).toLocaleString()} ${currencyName}`,
                components: []
              });
            }

            // Create new confirm purchase button with the adjusted quantity
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const confirmRow = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(`confirm_purchase_${type}_${itemId}_${playerId}_${numQuantity}`)
                  .setLabel('Confirm Purchase')
                  .setStyle(ButtonStyle.Success)
              );

            await interaction.update({
              content: `✅ Quantity set to ${numQuantity}x!\n\n**Item:** ${itemData.display_name}\n**Base Quantity:** ${itemData.base_quantity} (per purchase)\n**Your Multiplier:** ${numQuantity}x\n**Total Items You'll Get:** ${actualQuantity}\n**Price per purchase:** ${itemData.price} ${currencyName}\n**Total Price:** ${newTotalPrice} ${currencyName}\n**Server:** ${itemData.nickname}\n**Your Balance:** ${balance} ${currencyName}\n**New Balance:** ${balance - newTotalPrice} ${currencyName}`,
              components: [confirmRow]
            });

          } catch (error) {
            console.error('[SET_QUANTITY] Error:', error);
            await interaction.update({
              content: '❌ Error setting quantity.',
              components: []
            });
          }
        }

async function handleRustInfo(interaction) {
  await interaction.deferUpdate();
  
  // Split by underscore, but handle server ID that might contain underscores
  const parts = interaction.customId.split('_');
  const discordGuildId = parts[2];
  const discordId = parts[3];
  // Server ID might contain underscores, so take everything after the discord ID
  const serverId = parts.slice(4).join('_');
  
  console.log('🔍 Rust Info Debug:', { discordGuildId, discordId, serverId });
  
  try {
    // Get player info first
    const [playerResult] = await pool.query(
      `SELECT p.*
       FROM players p
       WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
       AND p.discord_id = ?
       AND p.server_id = ?
       AND p.is_active = true`,
      [discordGuildId, discordId, serverId]
    );

    console.log('🔍 Player query result:', playerResult.length, 'players found');

    if (playerResult.length === 0) {
      console.log('❌ No player found with these parameters');
      return interaction.followUp({
        content: 'Player data not found.',
        ephemeral: true
      });
    }

    const player = playerResult[0];

    // Get player stats (separate query to handle missing stats gracefully)
    const [statsResult] = await pool.query(
      'SELECT kills, deaths, kill_streak, highest_streak FROM player_stats WHERE player_id = ?',
      [player.id]
    );

    const stats = statsResult.length > 0 ? statsResult[0] : { kills: 0, deaths: 0, kill_streak: 0, highest_streak: 0 };
    const kills = stats.kills || 0;
    const deaths = stats.deaths || 0;
    const kdRatio = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toString();

    // Get playtime data
    const [playtimeResult] = await pool.query(
      'SELECT total_minutes FROM player_playtime WHERE player_id = ?',
      [player.id]
    );

    const totalMinutes = playtimeResult.length > 0 ? playtimeResult[0].total_minutes : 0;
    
    // Format playtime in a more user-friendly way
    let playtimeText;
    if (totalMinutes === 0) {
      playtimeText = '0m';
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (hours > 0) {
        playtimeText = `${hours}h ${minutes}m`;
      } else {
        playtimeText = `${minutes}m`;
      }
    }

    // Create Rust statistics embed
    const embed = orangeEmbed(
      'Rust Statistics',
      `**Playtime:** ${playtimeText}\n` +
      `**Kills:** ${kills.toLocaleString()}   **Deaths:** ${deaths.toLocaleString()}   **K/D:** ${kdRatio}\n` +
      `**Current Streak:** ${stats.kill_streak || 0}   **Best Streak:** ${stats.highest_streak || 0}`
    );

    await interaction.followUp({
      embeds: [embed],
      ephemeral: true
    });

  } catch (error) {
    console.error('Error in handleRustInfo:', error);
    await interaction.followUp({
      content: 'Failed to fetch Rust statistics. Please try again.',
      ephemeral: true
    });
  }
}

// Missing scheduler functions
async function handleSchedulerEdit(interaction) {
  await interaction.deferUpdate();
  
  try {
    const customId = interaction.customId;
    const parts = customId.split('_');
    const schedulerId = parts[2];
    
    // Get scheduler details
    const [schedulerResult] = await pool.query(
      'SELECT * FROM schedulers WHERE id = ?',
      [schedulerId]
    );
    
    if (schedulerResult.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Error', 'Scheduler not found.')],
        components: []
      });
    }
    
    const scheduler = schedulerResult[0];
    
    // For now, just show current info
    await interaction.editReply({
      embeds: [orangeEmbed(
        'Scheduler Edit',
        `**Current Settings:**\n• **Name:** ${scheduler.name}\n• **Message 1:** ${scheduler.message1 || 'None'}\n• **Message 2:** ${scheduler.message2 || 'None'}\n• **Interval:** ${scheduler.interval} minutes\n• **Active:** ${scheduler.is_active ? 'Yes' : 'No'}`
      )],
      components: []
    });
    
  } catch (error) {
    console.error('Error in handleSchedulerEdit:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'Failed to edit scheduler.')],
      components: []
    });
  }
}

async function handleSchedulerToggle(interaction) {
  await interaction.deferUpdate();
  
  try {
    const customId = interaction.customId;
    const parts = customId.split('_');
    const schedulerId = parts[2];
    
    // Toggle scheduler status
    const [currentResult] = await pool.query(
      'SELECT is_active FROM schedulers WHERE id = ?',
      [schedulerId]
    );
    
    if (currentResult.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Error', 'Scheduler not found.')],
        components: []
      });
    }
    
    const newStatus = !currentResult[0].is_active;
    
    await pool.query(
      'UPDATE schedulers SET is_active = ? WHERE id = ?',
      [newStatus, schedulerId]
    );
    
    await interaction.editReply({
      embeds: [successEmbed(
        'Scheduler Updated',
        `Scheduler has been ${newStatus ? 'activated' : 'deactivated'}.`
      )],
      components: []
    });
    
  } catch (error) {
    console.error('Error in handleSchedulerToggle:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'Failed to toggle scheduler.')],
      components: []
    });
  }
}

async function handleSchedulerMessage(interaction) {
  await interaction.deferUpdate();
  
  try {
    const customId = interaction.customId;
    const parts = customId.split('_');
    const schedulerId = parts[2];
    const messageType = parts[3]; // msg1 or msg2
    
    // Get current message
    const [currentResult] = await pool.query(
      `SELECT ${messageType === 'msg1' ? 'message1' : 'message2'} as message FROM schedulers WHERE id = ?`,
      [schedulerId]
    );
    
    if (currentResult.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Error', 'Scheduler not found.')],
        components: []
      });
    }
    
    const currentMessage = currentResult[0].message || 'None';
    
    await interaction.editReply({
      embeds: [orangeEmbed(
        'Scheduler Message',
        `**Current ${messageType === 'msg1' ? 'Message 1' : 'Message 2'}:**\n${currentMessage}`
      )],
      components: []
    });
    
  } catch (error) {
    console.error('Error in handleSchedulerMessage:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'Failed to get scheduler message.')],
      components: []
    });
  }
}

async function handleSchedulerCustomMessage(interaction) {
  await interaction.deferUpdate();
  
  try {
    const customId = interaction.customId;
    const parts = customId.split('_');
    const schedulerId = parts[2];
    const messageType = parts[3]; // msg1 or msg2
    
    // Get current message
    const [currentResult] = await pool.query(
      `SELECT ${messageType === 'msg1' ? 'message1' : 'message2'} as message FROM schedulers WHERE id = ?`,
      [schedulerId]
    );
    
    if (currentResult.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Error', 'Scheduler not found.')],
        components: []
      });
    }
    
    const currentMessage = currentResult[0].message || 'None';
    
    await interaction.editReply({
      embeds: [orangeEmbed(
        'Scheduler Custom Message',
        `**Current ${messageType === 'msg1' ? 'Message 1' : 'Message 2'}:**\n${currentMessage}\n\nUse the modal to update this message.`
      )],
      components: []
    });
    
  } catch (error) {
    console.error('Error in handleSchedulerCustomMessage:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'Failed to get scheduler custom message.')],
      components: []
    });
  }
}