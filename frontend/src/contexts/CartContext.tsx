import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  color?: string;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
      return [];
    } catch {
      return [];
    }
  });
  const { toast } = useToast();

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const addToCart = (newItem: CartItem) => {
    if (!newItem.price || newItem.price <= 0 || !newItem.quantity || newItem.quantity < 1) {
      return;
    }
    
    setCart(currentCart => {
      const existingItem = currentCart.find(item => item.id === newItem.id);
      const MAX_QTY = 99;
      
      if (existingItem) {
        return currentCart.map(item =>
          item.id === newItem.id
            ? { ...item, quantity: Math.min(item.quantity + newItem.quantity, MAX_QTY) }
            : item
        );
      }
      
      return [...currentCart, { ...newItem, quantity: Math.min(newItem.quantity, MAX_QTY) }];
    });

    toast({
      title: "Added to cart",
      description: `${newItem.quantity}x ${newItem.name} has been added to your cart.`,
    });
  };

  const removeFromCart = (id: string) => {
    // Capture the removed item for undo
    const removedItem = cart.find(item => item.id === id);
    setCart(currentCart => currentCart.filter(item => item.id !== id));
    
    toast({
      title: "Item removed",
      description: removedItem ? `${removedItem.name} removed from your cart.` : "The item has been removed from your cart.",
      action: removedItem
        ? React.createElement(ToastAction, {
            altText: "Undo remove",
            onClick: () => {
              setCart(currentCart => {
                const exists = currentCart.find(item => item.id === removedItem.id);
                if (exists) {
                  return currentCart.map(item =>
                    item.id === removedItem.id
                      ? { ...item, quantity: item.quantity + removedItem.quantity }
                      : item
                  );
                }
                return [...currentCart, removedItem];
              });
            },
          }, "Undo")
        : undefined,
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1 || !Number.isInteger(quantity) || quantity > 99) return;
    
    setCart(currentCart =>
      currentCart.map(item =>
        item.id === id ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    const previousCart = [...cart];
    setCart([]);
    toast({
      title: "Cart cleared",
      description: `${previousCart.length} item${previousCart.length !== 1 ? 's' : ''} removed from your cart.`,
      action: previousCart.length > 0
        ? React.createElement(ToastAction, {
            altText: "Undo clear cart",
            onClick: () => {
              setCart(previousCart);
            },
          }, "Undo")
        : undefined,
    });
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartCount,
        cartTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};