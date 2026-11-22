import { create } from 'zustand';
import { CartItem, Product } from '../../types/marketplace';

export type SupportedCurrency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD' | 'INR' | 'PKR' | 'AED';

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'CA$',
  AUD: 'AU$',
  INR: '₹',
  PKR: '₨',
  AED: 'AED ',
};

export const EXCHANGE_RATES: Record<SupportedCurrency, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.28,
  JPY: 0.0067,
  CAD: 0.74,
  AUD: 0.66,
  INR: 0.012,
  PKR: 0.0036,
  AED: 0.272,
};

interface CartState {
  items: CartItem[];
  currency: SupportedCurrency;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (slug: string) => void;
  updateQuantity: (slug: string, quantity: number) => void;
  clearCart: () => void;
  setCurrency: (currency: SupportedCurrency) => void;
  getTotalUsd: () => number;
  formatPrice: (amountUsd: number) => string;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  currency: 'USD',

  addToCart: (product, quantity = 1) => {
    set((state) => {
      const existing = state.items.find((item) => item.product.slug === product.slug);
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.product.slug === product.slug
              ? { ...item, quantity: item.quantity + quantity }
              : item
          ),
        };
      }
      return { items: [...state.items, { product, quantity }] };
    });
  },

  removeFromCart: (slug) => {
    set((state) => ({
      items: state.items.filter((item) => item.product.slug !== slug),
    }));
  },

  updateQuantity: (slug, quantity) => {
    set((state) => ({
      items: quantity <= 0
        ? state.items.filter((item) => item.product.slug !== slug)
        : state.items.map((item) =>
            item.product.slug === slug ? { ...item, quantity } : item
          ),
    }));
  },

  clearCart: () => set({ items: [] }),

  setCurrency: (currency) => set({ currency }),

  getTotalUsd: () => {
    return get().items.reduce((sum, item) => sum + item.product.priceUsd * item.quantity, 0);
  },

  formatPrice: (amountUsd) => {
    const { currency } = get();
    const rate = EXCHANGE_RATES[currency] || 1.0;
    const symbol = CURRENCY_SYMBOLS[currency] || '$';
    const converted = Math.round((amountUsd / rate) * 100) / 100;

    if (currency === 'JPY' || currency === 'PKR') {
      return `${symbol}${Math.round(converted).toLocaleString()}`;
    }
    return `${symbol}${converted.toFixed(2)}`;
  },
}));
