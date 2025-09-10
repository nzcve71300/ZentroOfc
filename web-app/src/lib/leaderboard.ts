// Leaderboard Service Stubs
import { PlayerStats } from '../types';
import { mockLeaderboard, mockMyStats } from '../mocks/leaderboard';

export const leaderboardService = {
  fetchTop20: async (serverId: string): Promise<PlayerStats[]> => {
    console.log('🏆 Leaderboard Service: Fetch top 20 called', serverId);
    
    // TODO: Call backend API
    // const response = await fetch(`/api/servers/${serverId}/leaderboard?limit=20`);
    // return response.json();
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 700));
    return mockLeaderboard;
  },

  fetchMyStats: async (serverId: string, playerIgn: string): Promise<PlayerStats> => {
    console.log('👤 Leaderboard Service: Fetch my stats called', serverId, playerIgn);
    
    // TODO: Call backend API
    // const response = await fetch(`/api/servers/${serverId}/players/${playerIgn}/stats`);
    // return response.json();
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockMyStats;
  },

  fetchPlayerStats: async (serverId: string, playerIgn: string): Promise<PlayerStats | null> => {
    console.log('🔍 Leaderboard Service: Fetch player stats called', serverId, playerIgn);
    
    // TODO: Call backend API
    // const response = await fetch(`/api/servers/${serverId}/players/${playerIgn}/stats`);
    // return response.json();
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const player = mockLeaderboard.find(p => p.ign.toLowerCase() === playerIgn.toLowerCase());
    return player || null;
  },

  refreshStats: async (serverId: string): Promise<{ success: boolean; message: string }> => {
    console.log('🔄 Leaderboard Service: Refresh stats called', serverId);
    
    // TODO: Trigger backend stats refresh from game server
    // const response = await fetch(`/api/servers/${serverId}/leaderboard/refresh`, {
    //   method: 'POST'
    // });
    // return response.json();
    
    // Simulate refresh time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      success: true,
      message: 'Leaderboard stats refreshed successfully!'
    };
  }
};