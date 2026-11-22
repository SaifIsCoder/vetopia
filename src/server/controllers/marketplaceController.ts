import { Request, Response } from 'express';
import { supabaseAdmin } from '../supabase';

const FALLBACK_ITEMS = [
  {
    sellerId: 'verified_vet_supplies_co',
    sellerName: 'Global Vet Care Essentials',
    slug: 'premium-kibble-5kg',
    name: 'Premium Kibble (5kg)',
    category: 'Food',
    priceUsd: 42,
    rating: 4.9,
    reviewsCount: 312,
    imageUrl: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=600&q=80',
    blurb: 'High-protein, grain-free kibble for adult dogs.',
    details: ['Grain-free recipe', '30% real chicken', 'Vet-approved formula', 'Free shipping over $50'],
    stockQuantity: 120,
    isVetApproved: true,
    verifiedSeller: true,
  },
  {
    sellerId: 'verified_vet_supplies_co',
    sellerName: 'Global Vet Care Essentials',
    slug: 'smart-feeder-pro',
    name: 'Smart Feeder Pro',
    category: 'Health',
    priceUsd: 129,
    rating: 4.7,
    reviewsCount: 88,
    imageUrl: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=600&q=80',
    blurb: 'App-controlled smart feeder with portion tracking.',
    details: ['Wi-Fi enabled', 'Voice recording', '10L capacity', 'Battery backup'],
    stockQuantity: 45,
    isVetApproved: true,
    verifiedSeller: true,
  },
  {
    sellerId: 'agri_supplies_corp',
    sellerName: 'Heritage Farm Feeds',
    slug: 'egg-layer-feed-25kg',
    name: 'Egg Layer Complete Feed (25kg)',
    category: 'Farm Supplies',
    priceUsd: 36,
    rating: 4.9,
    reviewsCount: 156,
    imageUrl: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=600&q=80',
    blurb: 'Complete layer feed for productive backyard hens.',
    details: ['16% protein', 'Calcium fortified', 'Non-GMO grains', 'Resealable bag'],
    stockQuantity: 300,
    isVetApproved: true,
    verifiedSeller: true,
  },
];

export async function getMarketplaceItems(req: Request, res: Response) {
  try {
    const { category, search } = req.query;
    let query = supabaseAdmin.from('marketplace_items').select('*').order('rating', { ascending: false });

    if (category && category !== 'All') {
      query = query.eq('category', category);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,blurb.ilike.%${search}%`);
    }

    const { data: items, error } = await query;
    if (error) {
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'DATABASE_ERROR' },
      });
    }

    if (!items || items.length === 0) {
      return res.status(200).json({ success: true, data: FALLBACK_ITEMS });
    }

    const formatted = items.map((item: any) => ({
      id: item.id,
      _id: item.id,
      sellerId: item.seller_id,
      sellerName: item.seller_name,
      name: item.name,
      slug: item.slug,
      category: item.category,
      priceUsd: Number(item.price_usd),
      rating: Number(item.rating),
      reviewsCount: item.reviews_count,
      imageUrl: item.image_url,
      blurb: item.blurb,
      details: item.details || [],
      stockQuantity: item.stock_quantity,
      isVetApproved: item.is_vet_approved,
      verifiedSeller: item.verified_seller,
      createdAt: item.created_at,
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to fetch marketplace items.', code: 'SERVER_ERROR' },
    });
  }
}

export async function createMarketplaceItem(req: Request, res: Response) {
  try {
    const sellerId = req.user?.id || req.body.sellerId;
    const { name, category, priceUsd, imageUrl, blurb, details, stockQuantity } = req.body;

    if (!sellerId || !name || !category || !priceUsd || !imageUrl) {
      return res.status(400).json({
        success: false,
        error: { message: 'sellerId, name, category, priceUsd, and imageUrl are required.', code: 'VALIDATION_ERROR' },
      });
    }

    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    const isSellerUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sellerId);

    const { data: item, error } = await supabaseAdmin
      .from('marketplace_items')
      .insert({
        seller_id: isSellerUuid ? sellerId : null,
        seller_name: req.body.sellerName || 'Verified Merchant',
        name,
        slug,
        category,
        price_usd: Number(priceUsd),
        rating: 5.0,
        reviews_count: 0,
        image_url: imageUrl,
        blurb: blurb || '',
        details: Array.isArray(details) ? details : [],
        stock_quantity: Number(stockQuantity) || 50,
        is_vet_approved: true,
        verified_seller: true,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'DATABASE_ERROR' },
      });
    }

    const formatted = {
      id: item.id,
      _id: item.id,
      sellerId: item.seller_id,
      sellerName: item.seller_name,
      name: item.name,
      slug: item.slug,
      category: item.category,
      priceUsd: Number(item.price_usd),
      rating: Number(item.rating),
      reviewsCount: item.reviews_count,
      imageUrl: item.image_url,
      blurb: item.blurb,
      details: item.details,
      stockQuantity: item.stock_quantity,
      isVetApproved: item.is_vet_approved,
      verifiedSeller: item.verified_seller,
      createdAt: item.created_at,
    };

    return res.status(201).json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to create marketplace item.', code: 'SERVER_ERROR' },
    });
  }
}
