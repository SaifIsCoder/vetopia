export type MarketplaceCategory =
  | 'All'
  | 'Food'
  | 'Toys'
  | 'Grooming'
  | 'Health'
  | 'Farm Supplies'
  | 'Pre-loved';

export interface Product {
  id?: string;
  slug: string;
  name: string;
  category: MarketplaceCategory;
  priceUsd: number;
  rating: number;
  reviewsCount: number;
  imageUrl: string;
  blurb: string;
  details: string[];
  stockQuantity?: number;
  isVetApproved: boolean;
  verifiedSeller: boolean;
  sellerName?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
