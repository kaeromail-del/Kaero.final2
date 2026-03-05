import { create } from 'zustand';

interface FavoritesState {
  favorites: Set<string>;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  clearFavorites: () => void;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: new Set<string>(),
  toggleFavorite: (id) => {
    const current = new Set(get().favorites);
    if (current.has(id)) current.delete(id); else current.add(id);
    set({ favorites: current });
  },
  isFavorite: (id) => get().favorites.has(id),
  clearFavorites: () => set({ favorites: new Set<string>() }),
}));
