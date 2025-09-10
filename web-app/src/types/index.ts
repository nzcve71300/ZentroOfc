// Core Types for Zentro Gaming App

export interface AuthUser {
  ign: string;
  email?: string;
  token?: string;
}

export interface Server {
  id: string;
  name: string;
  ip: string;
  rconPort: number;
  hasActiveSub: boolean;
  imageUrl?: string;
  description?: string;
  connectionStatus?: 'connected' | 'disconnected' | 'error';
  lastConnectionAt?: string | null;
}

export interface Category {
  id: string;
  name: string;
  type: 'item' | 'kit' | 'vehicle';
}

export interface StoreItem {
  id: string;
  categoryId: string;
  name: string;
  shortName: string;
  price: number;
  iconUrl?: string;
}

export interface PlayerStats {
  ign: string;
  kills: number;
  deaths: number;
  kd: number;
  playtimeHours: number;
}

export interface BalanceSummary {
  current: number;
  afterPurchase: number;
  currency: string;
}

export interface PayPalPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  features: string[];
}

export interface ServerConfig {
  name: string;
  ip: string;
  rconPort: number;
  rconPassword: string;
}

// Form Types
export interface LoginForm {
  ign: string;
  password: string;
}

export interface SignupForm {
  ign: string;
  email: string;
  password: string;
}

export interface CategoryForm {
  name: string;
  type: 'item' | 'kit' | 'vehicle';
}