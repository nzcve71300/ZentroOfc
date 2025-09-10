// Store Configuration State Management using Zustand
import { create } from 'zustand';
import { Category, StoreItem } from '../types';

interface StoreConfigState {
  categories: Category[];
  items: StoreItem[];
  selectedCategory: Category | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCategories: (categories: Category[]) => void;
  setItems: (items: StoreItem[]) => void;
  setSelectedCategory: (category: Category | null) => void;
  addCategory: (category: Category) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  removeCategory: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useStoreConfig = create<StoreConfigState>((set) => ({
  categories: [],
  items: [],
  selectedCategory: null,
  isLoading: false,
  error: null,
  
  setCategories: (categories) => set({ categories }),
  setItems: (items) => set({ items }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  
  addCategory: (category) => set((state) => ({
    categories: [...state.categories, category]
  })),
  
  updateCategory: (id, updates) => set((state) => ({
    categories: state.categories.map(category =>
      category.id === id ? { ...category, ...updates } : category
    )
  })),
  
  removeCategory: (id) => set((state) => ({
    categories: state.categories.filter(category => category.id !== id),
    items: state.items.filter(item => item.categoryId !== id),
    selectedCategory: state.selectedCategory?.id === id ? null : state.selectedCategory
  })),
  
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error })
}));