import { apiClient } from '../api';
import { Product, MarketplaceCategory } from '../../types/marketplace';

export const fallbackProducts: Product[] = [
  {
    slug: 'premium-kibble-5kg',
    name: 'Premium Kibble (5kg)',
    category: 'Food',
    priceUsd: 42,
    rating: 4.9,
    reviewsCount: 312,
    imageUrl: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=600&q=80',
    blurb: 'High-protein, grain-free kibble for adult dogs.',
    details: ['Grain-free recipe', '30% real chicken', 'Vet-approved formula', 'Free shipping over $50'],
    isVetApproved: true,
    verifiedSeller: true,
    sellerName: 'Global Vet Essentials',
  },
  {
    slug: 'organic-treats-pack',
    name: 'Organic Treats Pack',
    category: 'Food',
    priceUsd: 14,
    rating: 4.8,
    reviewsCount: 189,
    imageUrl: 'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?auto=format&fit=crop&w=600&q=80',
    blurb: 'Soft, organic training treats made with single-source protein.',
    details: ['100% organic', 'No artificial colours', 'Perfect for training', 'Resealable pouch'],
    isVetApproved: true,
    verifiedSeller: true,
    sellerName: 'Organic Paws Co.',
  },
  {
    slug: 'vet-grooming-kit',
    name: 'Vet Grooming Kit',
    category: 'Grooming',
    priceUsd: 58,
    rating: 4.9,
    reviewsCount: 134,
    imageUrl: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=600&q=80',
    blurb: 'Professional-grade grooming kit used by certified groomers.',
    details: ['12 stainless tools', 'Quiet motor clipper', 'Travel case', '1-year warranty'],
    isVetApproved: true,
    verifiedSeller: true,
    sellerName: 'Pro Groomers Network',
  },
  {
    slug: 'smart-feeder-pro',
    name: 'Smart Feeder Pro',
    category: 'Health',
    priceUsd: 129,
    rating: 4.7,
    reviewsCount: 88,
    imageUrl: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=600&q=80',
    blurb: 'App-controlled smart feeder with portion tracking.',
    details: ['Wi-Fi enabled', 'Voice recording', '10L capacity', 'Battery backup'],
    isVetApproved: true,
    verifiedSeller: true,
    sellerName: 'SmartPet Robotics',
  },
  {
    slug: 'cat-tower-xl',
    name: 'Cat Tower XL',
    category: 'Toys',
    priceUsd: 89,
    rating: 4.8,
    reviewsCount: 267,
    imageUrl: 'https://images.unsplash.com/photo-1545249390-6bdfa286032f?auto=format&fit=crop&w=600&q=80',
    blurb: '5-tier cat tower with sisal posts and cozy hideaways.',
    details: ['180cm tall', 'Real sisal', 'Stable wide base', 'Easy assembly'],
    isVetApproved: true,
    verifiedSeller: true,
    sellerName: 'Feline Fortresses',
  },
  {
    slug: 'egg-layer-feed-25kg',
    name: 'Egg Layer Feed (25kg)',
    category: 'Farm Supplies',
    priceUsd: 36,
    rating: 4.9,
    reviewsCount: 156,
    imageUrl: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=600&q=80',
    blurb: 'Complete layer feed for productive backyard hens.',
    details: ['16% protein', 'Calcium fortified', 'Non-GMO grains', 'Resealable bag'],
    isVetApproved: true,
    verifiedSeller: true,
    sellerName: 'AgriCare Mills',
  },
];

export async function fetchMarketplaceItems(category?: MarketplaceCategory): Promise<Product[]> {
  try {
    const res = await apiClient.request<Product[]>('marketplace/items', {
      params: category && category !== 'All' ? { category } : undefined,
      requiresAuth: false,
    });
    if (res.data && res.data.length > 0) {
      return res.data;
    }
  } catch {
    // Graceful fallback to static verified catalog
  }

  if (category && category !== 'All') {
    return fallbackProducts.filter((p) => p.category === category);
  }
  return fallbackProducts;
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const all = await fetchMarketplaceItems();
  return all.find((p) => p.slug === slug) || null;
}
