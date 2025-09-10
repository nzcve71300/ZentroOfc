import { Server } from '../types';

export const mockServers: Server[] = [
  {
    id: "srv-001",
    name: "Zentro PvP Arena",
    ip: "192.168.1.100",
    rconPort: 28016,
    hasActiveSub: true,
    imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=300&fit=crop",
    description: "High-intensity PvP combat server with custom weapons and arenas"
  },
  {
    id: "srv-002", 
    name: "Survival Paradise",
    ip: "192.168.1.101",
    rconPort: 28017,
    hasActiveSub: true,
    imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=300&fit=crop",
    description: "Ultimate survival experience with modded content and events"
  },
  {
    id: "srv-003",
    name: "Creative Builder Hub", 
    ip: "192.168.1.102",
    rconPort: 28018,
    hasActiveSub: false,
    imageUrl: "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=800&h=300&fit=crop",
    description: "Build and create with unlimited resources and custom tools"
  }
];