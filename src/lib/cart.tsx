import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { ShopProduct } from '../data/shopProducts';

type CartContextValue = {
  add: (product: ShopProduct) => void;
  clear: () => void;
  decrement: (id: string) => void;
  getQuantity: (id: string) => number;
  increment: (id: string) => void;
  products: Record<string, ShopProduct>;
  quantities: Record<string, number>;
  totalItems: number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [products, setProducts] = useState<Record<string, ShopProduct>>({});

  const add = useCallback((product: ShopProduct) => {
    setProducts((current) => ({ ...current, [product.id]: product }));
    setQuantities((current) => ({
      ...current,
      [product.id]: (current[product.id] ?? 0) + 1,
    }));
  }, []);

  const clear = useCallback(() => {
    setProducts({});
    setQuantities({});
  }, []);

  const increment = useCallback((id: string) => {
    setQuantities((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
  }, []);

  const decrement = useCallback((id: string) => {
    setQuantities((current) => {
      const nextQty = (current[id] ?? 0) - 1;
      if (nextQty > 0) {
        return { ...current, [id]: nextQty };
      }

      const rest: Record<string, number> = {};
      for (const key of Object.keys(current)) {
        if (key !== id) {
          rest[key] = current[key] as number;
        }
      }
      return rest;
    });
  }, []);

  const getQuantity = useCallback(
    (id: string) => quantities[id] ?? 0,
    [quantities],
  );

  const totalItems = useMemo(
    () => Object.values(quantities).reduce((sum, qty) => sum + qty, 0),
    [quantities],
  );

  const value = useMemo(
    () => ({
      add,
      clear,
      decrement,
      getQuantity,
      increment,
      products,
      quantities,
      totalItems,
    }),
    [
      add,
      clear,
      decrement,
      getQuantity,
      increment,
      products,
      quantities,
      totalItems,
    ],
  );

  return (
    <CartContext.Provider value={value}>{children}</CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
