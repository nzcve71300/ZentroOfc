import { getConnection } from './database.js';

// Get all categories for a server
export async function getCategories(serverId) {
  try {
    const connection = await getConnection();
    
    const [categories] = await connection.execute(
      `SELECT id, name, description, display_order, is_active, created_at 
       FROM store_categories 
       WHERE server_id = ? AND is_active = 1 
       ORDER BY display_order ASC, name ASC`,
      [serverId]
    );
    
    return categories.map(category => ({
      id: category.id.toString(),
      name: category.name,
      type: 'item', // Default type for now
      description: category.description || '',
      displayOrder: category.display_order,
      isActive: category.is_active,
      createdAt: category.created_at
    }));
    
  } catch (error) {
    console.error('Error getting categories:', error);
    throw new Error('Failed to get categories: ' + error.message);
  }
}

// Get all items for a specific category
export async function getItemsByCategory(serverId, categoryId) {
  try {
    const connection = await getConnection();
    
    const [items] = await connection.execute(
      `SELECT id, display_name, short_name, price, quantity, timer_minutes, is_active, created_at 
       FROM store_items 
       WHERE server_id = ? AND category_id = ? AND is_active = 1 
       ORDER BY display_name ASC`,
      [serverId, categoryId]
    );
    
    return items.map(item => ({
      id: item.id.toString(),
      categoryId: categoryId,
      name: item.display_name,
      shortName: item.short_name,
      price: parseFloat(item.price),
      quantity: item.quantity,
      timerMinutes: item.timer_minutes,
      isActive: item.is_active,
      createdAt: item.created_at
    }));
    
  } catch (error) {
    console.error('Error getting items by category:', error);
    throw new Error('Failed to get items: ' + error.message);
  }
}

// Add a new category
export async function addCategory(serverId, categoryData) {
  try {
    const connection = await getConnection();
    
    const [result] = await connection.execute(
      `INSERT INTO store_categories (server_id, name, description, display_order, is_active, created_at) 
       VALUES (?, ?, ?, ?, 1, NOW())`,
      [
        serverId,
        categoryData.name,
        categoryData.description || '',
        categoryData.displayOrder || 0
      ]
    );
    
    return {
      id: result.insertId.toString(),
      name: categoryData.name,
      type: 'item',
      description: categoryData.description || '',
      displayOrder: categoryData.displayOrder || 0,
      isActive: true
    };
    
  } catch (error) {
    console.error('Error adding category:', error);
    throw new Error('Failed to add category: ' + error.message);
  }
}

// Add a new item
export async function addItem(serverId, itemData) {
  try {
    const connection = await getConnection();
    
    const [result] = await connection.execute(
      `INSERT INTO store_items (server_id, category_id, display_name, short_name, price, quantity, timer_minutes, is_active, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
      [
        serverId,
        itemData.categoryId,
        itemData.displayName,
        itemData.shortName,
        itemData.price,
        itemData.quantity || 1,
        itemData.timerMinutes || 0
      ]
    );
    
    return {
      id: result.insertId.toString(),
      categoryId: itemData.categoryId,
      name: itemData.displayName,
      shortName: itemData.shortName,
      price: itemData.price,
      quantity: itemData.quantity || 1,
      timerMinutes: itemData.timerMinutes || 0,
      isActive: true
    };
    
  } catch (error) {
    console.error('Error adding item:', error);
    throw new Error('Failed to add item: ' + error.message);
  }
}

// Update an item
export async function updateItem(serverId, itemId, itemData) {
  try {
    const connection = await getConnection();
    
    const fields = [];
    const values = [];
    
    if (itemData.displayName) {
      fields.push('display_name = ?');
      values.push(itemData.displayName);
    }
    
    if (itemData.shortName) {
      fields.push('short_name = ?');
      values.push(itemData.shortName);
    }
    
    if (itemData.price !== undefined) {
      fields.push('price = ?');
      values.push(itemData.price);
    }
    
    if (itemData.quantity !== undefined) {
      fields.push('quantity = ?');
      values.push(itemData.quantity);
    }
    
    if (itemData.timerMinutes !== undefined) {
      fields.push('timer_minutes = ?');
      values.push(itemData.timerMinutes);
    }
    
    if (fields.length === 0) {
      throw new Error('No fields to update');
    }
    
    values.push(itemId);
    
    await connection.execute(
      `UPDATE store_items SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND server_id = ?`,
      [...values, serverId]
    );
    
    return true;
    
  } catch (error) {
    console.error('Error updating item:', error);
    throw new Error('Failed to update item: ' + error.message);
  }
}

// Delete an item
export async function deleteItem(serverId, itemId) {
  try {
    const connection = await getConnection();
    
    await connection.execute(
      'DELETE FROM store_items WHERE id = ? AND server_id = ?',
      [itemId, serverId]
    );
    
    return true;
    
  } catch (error) {
    console.error('Error deleting item:', error);
    throw new Error('Failed to delete item: ' + error.message);
  }
}

// Update a category
export async function updateCategory(serverId, categoryId, categoryData) {
  try {
    const connection = await getConnection();
    
    const fields = [];
    const values = [];
    
    if (categoryData.name) {
      fields.push('name = ?');
      values.push(categoryData.name);
    }
    
    if (categoryData.description !== undefined) {
      fields.push('description = ?');
      values.push(categoryData.description);
    }
    
    if (categoryData.displayOrder !== undefined) {
      fields.push('display_order = ?');
      values.push(categoryData.displayOrder);
    }
    
    if (fields.length === 0) {
      throw new Error('No fields to update');
    }
    
    values.push(categoryId);
    
    await connection.execute(
      `UPDATE store_categories SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND server_id = ?`,
      [...values, serverId]
    );
    
    return true;
    
  } catch (error) {
    console.error('Error updating category:', error);
    throw new Error('Failed to update category: ' + error.message);
  }
}

// Delete a category
export async function deleteCategory(serverId, categoryId) {
  try {
    const connection = await getConnection();
    
    // First delete all items in this category
    await connection.execute(
      'DELETE FROM store_items WHERE category_id = ? AND server_id = ?',
      [categoryId, serverId]
    );
    
    // Then delete the category
    await connection.execute(
      'DELETE FROM store_categories WHERE id = ? AND server_id = ?',
      [categoryId, serverId]
    );
    
    return true;
    
  } catch (error) {
    console.error('Error deleting category:', error);
    throw new Error('Failed to delete category: ' + error.message);
  }
}

// Purchase an item
export async function purchaseItem(serverId, itemId, userId, userIgn) {
  try {
    const connection = await getConnection();
    
    // Get the item details
    const [items] = await connection.execute(
      `SELECT id, display_name, short_name, price, quantity, timer_minutes 
       FROM store_items 
       WHERE id = ? AND server_id = ? AND is_active = 1`,
      [itemId, serverId]
    );
    
    if (items.length === 0) {
      throw new Error('Item not found');
    }
    
    const item = items[0];
    
    // Check if user has enough balance (simplified - you might want to implement actual payment logic)
    // For now, we'll just proceed with the purchase
    
    // Send RCON command to give item to player
    const rconCommand = `inventory.giveto "${userIgn}" "${item.short_name}" ${item.quantity}`;
    
    // Import RCON bot dynamically to avoid circular imports
    const { rconBot } = await import('./rcon-bot.js');
    
    // Send command to server
    const response = await rconBot.sendCommand(serverId, rconCommand);
    
    // Log the purchase
    await connection.execute(
      `INSERT INTO store_purchases (server_id, item_id, user_id, user_ign, price, quantity, rcon_command, rcon_response, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [serverId, itemId, userId, userIgn, item.price, item.quantity, rconCommand, response]
    );
    
    return {
      success: true,
      message: `Item "${item.display_name}" delivered to ${userIgn} in-game!`,
      response: response
    };
    
  } catch (error) {
    console.error('Error purchasing item:', error);
    throw new Error('Failed to purchase item: ' + error.message);
  }
}
