// Server Management Service - API Integration
import { Server, ServerConfig } from '../types';

const API_BASE = 'http://35.246.29.212:8080/api';

export const serverService = {
  // List all servers
  list: async (): Promise<Server[]> => {
    console.log('🖥️ Server Service: List all servers called');
    
    try {
      const response = await fetch(`${API_BASE}/servers`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const servers = await response.json();
      return servers;
    } catch (error) {
      console.error('Error listing servers:', error);
      throw new Error('Failed to retrieve servers');
    }
  },

  // Create a new server
  create: async (guildId: string, config: ServerConfig): Promise<Server> => {
    console.log('➕ Server Service: Create server called', guildId, config);
    
    try {
      const response = await fetch(`${API_BASE}/servers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...config,
          guildId
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const server = await response.json();
      return server;
    } catch (error) {
      console.error('Error creating server:', error);
      throw new Error('Failed to create server');
    }
  },

  // Update server configuration
  update: async (serverId: string, config: Partial<ServerConfig>): Promise<Server> => {
    console.log('✏️ Server Service: Update server called', serverId, config);
    
    try {
      const response = await fetch(`${API_BASE}/servers/${serverId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(config)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const server = await response.json();
      return server;
    } catch (error) {
      console.error('Error updating server:', error);
      throw new Error('Failed to update server');
    }
  },

  // Delete a server
  delete: async (serverId: string): Promise<void> => {
    console.log('🗑️ Server Service: Delete server called', serverId);
    
    try {
      const response = await fetch(`${API_BASE}/servers/${serverId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting server:', error);
      throw new Error('Failed to delete server');
    }
  },

  // Test RCON connection
  testConnection: async (serverId: string): Promise<boolean> => {
    console.log('🔌 Server Service: Test connection called', serverId);
    
    try {
      const response = await fetch(`${API_BASE}/servers/${serverId}/test-connection`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.connected;
    } catch (error) {
      console.error('Error testing connection:', error);
      return false;
    }
  },

  // Get server statistics
  getStats: async (serverId: string): Promise<any> => {
    console.log('📊 Server Service: Get stats called', serverId);
    
    try {
      const response = await fetch(`${API_BASE}/servers/${serverId}/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const stats = await response.json();
      return stats;
    } catch (error) {
      console.error('Error getting server stats:', error);
      throw new Error('Failed to retrieve server statistics');
    }
  }
};
