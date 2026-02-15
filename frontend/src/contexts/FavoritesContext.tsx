import { useState, useEffect } from 'react';
import { FavoritesContext, FavoritesContextType } from './favorites-context';

// Synchronous initializer to prevent flash-of-empty on mount
function loadFavoritesFromStorage(): string[] {
  try {
    const saved = localStorage.getItem('favorites');
    if (saved) {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    // Corrupted data — ignore
  }
  return [];
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>(loadFavoritesFromStorage);

  const addToFavorites = (productId: string) => {
    setFavorites((prev) => {
      if (prev.includes(productId)) return prev; // Prevent duplicates
      const newFavorites = [...prev, productId];
      localStorage.setItem('favorites', JSON.stringify(newFavorites));
      return newFavorites;
    });
  };

  const removeFromFavorites = (productId: string) => {
    setFavorites((prev) => {
      const newFavorites = prev.filter(id => id !== productId);
      localStorage.setItem('favorites', JSON.stringify(newFavorites));
      return newFavorites;
    });
  };

  const isFavorite = (productId: string) => favorites.includes(productId);

  return (
    <FavoritesContext.Provider value={{ 
      favorites, 
      favoritesCount: favorites.length, 
      addToFavorites, 
      removeFromFavorites, 
      isFavorite 
    }}>
      {children}
    </FavoritesContext.Provider>
  );
}