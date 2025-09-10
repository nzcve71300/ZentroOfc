// Store Management Service - Real API Integration
import { Category, StoreItem, CategoryForm } from '../types';

const API_BASE = 'http://35.246.29.212:3002/api';

export const storeService = {
  // Categories
  addCategory: async (serverId: string, data: CategoryForm): Promise<Category> => {
    try {
      console.log('➕ Store Service: Add category called', serverId, data);
      
      const response = await fetch(`${API_BASE}/servers/${serverId}/store/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error adding category:', error);
      throw error;
    }
  },

  removeCategory: async (serverId: string, categoryId: string): Promise<void> => {
    try {
      console.log('🗑️ Store Service: Remove category called', serverId, categoryId);
      
      const response = await fetch(`${API_BASE}/servers/${serverId}/store/categories/${categoryId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error removing category:', error);
      throw error;
    }
  },

  updateCategory: async (serverId: string, categoryId: string, data: CategoryForm): Promise<Category> => {
    try {
      console.log('✏️ Store Service: Update category called', serverId, categoryId, data);
      
      const response = await fetch(`${API_BASE}/servers/${serverId}/store/categories/${categoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  },

  getCategories: async (serverId: string): Promise<Category[]> => {
    try {
      console.log('📂 Store Service: Get categories called', serverId);
      
      const response = await fetch(`${API_BASE}/servers/${serverId}/store/categories`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting categories:', error);
      throw error;
    }
  },

  // Items
  getItemsByCategory: async (serverId: string, categoryId: string): Promise<StoreItem[]> => {
    try {
      console.log('🛍️ Store Service: Get items by category called', serverId, categoryId);
      
      const response = await fetch(`${API_BASE}/servers/${serverId}/store/categories/${categoryId}/items`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting items by category:', error);
      throw error;
    }
  },

  addItem: async (serverId: string, itemData: any): Promise<StoreItem> => {
    try {
      console.log('➕ Store Service: Add item called', serverId, itemData);
      
      const response = await fetch(`${API_BASE}/servers/${serverId}/store/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error adding item:', error);
      throw error;
    }
  },

  updateItem: async (serverId: string, itemId: string, itemData: any): Promise<void> => {
    try {
      console.log('✏️ Store Service: Update item called', serverId, itemId, itemData);
      
      const response = await fetch(`${API_BASE}/servers/${serverId}/store/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  },

  deleteItem: async (serverId: string, itemId: string): Promise<void> => {
    try {
      console.log('🗑️ Store Service: Delete item called', serverId, itemId);
      
      const response = await fetch(`${API_BASE}/servers/${serverId}/store/items/${itemId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      throw error;
    }
  },

  purchaseItem: async (serverId: string, itemId: string, quantity: number = 1): Promise<{ success: boolean; message: string }> => {
    try {
      console.log('💰 Store Service: Purchase item called', serverId, itemId, quantity);
      
      const response = await fetch(`${API_BASE}/servers/${serverId}/store/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, quantity })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return {
        success: result.success,
        message: result.message
      };
    } catch (error) {
      console.error('Error purchasing item:', error);
      throw error;
    }
  },

  // Get player balance for store
  getBalance: async (serverId: string): Promise<{ balance: number; currency: string }> => {
    try {
      console.log('💰 Store Service: Get balance called', serverId);
      
      const response = await fetch(`${API_BASE}/servers/${serverId}/store/balance`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting balance:', error);
      throw error;
    }
  }
};