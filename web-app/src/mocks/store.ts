import { Category, StoreItem } from '../types';

export const mockCategories: Category[] = [
  { id: "cat-001", name: "Weapons", type: "item" },
  { id: "cat-002", name: "Armor Sets", type: "kit" },
  { id: "cat-003", name: "Vehicles", type: "vehicle" },
  { id: "cat-004", name: "Resources", type: "item" },
  { id: "cat-005", name: "Special Items", type: "item" }
];

export const mockStoreItems: StoreItem[] = [
  // Weapons
  {
    id: "item-001",
    categoryId: "cat-001",
    name: "Assault Rifle",
    shortName: "ak47",
    price: 150,
    iconUrl: "https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=100&h=100&fit=crop"
  },
  {
    id: "item-002", 
    categoryId: "cat-001",
    name: "Sniper Rifle",
    shortName: "bolt_rifle",
    price: 300,
    iconUrl: "https://images.unsplash.com/photo-1544077960-604201fe74bc?w=100&h=100&fit=crop"
  },
  
  // Armor Sets
  {
    id: "item-003",
    categoryId: "cat-002", 
    name: "Metal Armor Kit",
    shortName: "metal_kit",
    price: 200,
    iconUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=100&h=100&fit=crop"
  },
  
  // Vehicles
  {
    id: "item-004",
    categoryId: "cat-003",
    name: "Attack Helicopter", 
    shortName: "heli",
    price: 500,
    iconUrl: "https://images.unsplash.com/photo-1544077960-604201fe74bc?w=100&h=100&fit=crop"
  },
  
  // Resources
  {
    id: "item-005",
    categoryId: "cat-004",
    name: "High Quality Metal",
    shortName: "hqm", 
    price: 50,
    iconUrl: "https://images.unsplash.com/photo-1597678935572-f3e04e5c2fad?w=100&h=100&fit=crop"
  }
];