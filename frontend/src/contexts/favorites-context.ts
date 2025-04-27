import { createContext } from 'react';

export interface FavoritesContextType {
  favorites: string[];
  favoritesCount: number;
  addToFavorites: (productId: string) => void;
  removeFromFavorites: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
}

export const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);