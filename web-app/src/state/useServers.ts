// Server State Management using Zustand
import { create } from 'zustand';
import { Server } from '../types';

interface ServerState {
  servers: Server[];
  selectedServer: Server | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setServers: (servers: Server[]) => void;
  setSelectedServer: (server: Server | null) => void;
  addServer: (server: Server) => void;
  updateServer: (id: string, updates: Partial<Server>) => void;
  removeServer: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useServers = create<ServerState>((set, get) => ({
  servers: [],
  selectedServer: null,
  isLoading: false,
  error: null,
  
  setServers: (servers) => set({ servers }),
  setSelectedServer: (selectedServer) => set({ selectedServer }),
  
  addServer: (server) => set((state) => ({
    servers: [...state.servers, server]
  })),
  
  updateServer: (id, updates) => set((state) => ({
    servers: state.servers.map(server => 
      server.id === id ? { ...server, ...updates } : server
    )
  })),
  
  removeServer: (id) => set((state) => ({
    servers: state.servers.filter(server => server.id !== id),
    selectedServer: state.selectedServer?.id === id ? null : state.selectedServer
  })),
  
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error })
}));