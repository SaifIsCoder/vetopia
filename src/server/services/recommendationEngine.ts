export interface RecommendationQuery {
  species: 'Dogs' | 'Cats' | 'Birds' | 'Farm';
  lifeStage?: 'puppy' | 'adult' | 'senior';
  size?: 'small' | 'medium' | 'large';
  activity?: 'low' | 'medium' | 'high';
  goals?: string[]; // e.g. ["weight", "joints", "coat", "dental"]
  budget?: 'value' | 'balanced' | 'premium';
}

export interface RecommendationResult {
  category: string;
  title: string;
  reason: string;
  recommendedProducts: Array<{
    name: string;
    slug: string;
    priceUsd: number;
    matchScore: number;
    badge?: string;
  }>;
  vetSpecialtyRecommendation?: string;
}

export function generateSmartRecommendations(query: RecommendationQuery): RecommendationResult {
  const { species, lifeStage = 'adult', goals = [], budget = 'balanced' } = query;

  let vetSpecialty = 'General Veterinary Medicine';
  if (goals.includes('joints') || goals.includes('mobility')) {
    vetSpecialty = 'Sport Medicine & Orthopaedics';
  } else if (goals.includes('coat') || goals.includes('skin')) {
    vetSpecialty = 'Dermatology';
  } else if (goals.includes('dental')) {
    vetSpecialty = 'Dentistry';
  } else if (lifeStage === 'senior') {
    vetSpecialty = 'Internal Medicine';
  }

  const products = [];

  if (species === 'Dogs') {
    products.push({
      name: 'Premium Kibble (5kg) — High Protein Vet Formula',
      slug: 'premium-kibble-5kg',
      priceUsd: budget === 'premium' ? 54 : 42,
      matchScore: 98,
      badge: 'Vet Approved',
    });
    if (goals.includes('joints')) {
      products.push({
        name: 'Glucosamine & Chondroitin Joint Chews',
        slug: 'joint-support-chews',
        priceUsd: 28,
        matchScore: 96,
        badge: 'Top Pick for Joints',
      });
    } else {
      products.push({
        name: 'Organic Grain-Free Training Treats Pack',
        slug: 'organic-treats-pack',
        priceUsd: 14,
        matchScore: 92,
        badge: '100% Organic',
      });
    }
  } else if (species === 'Cats') {
    products.push({
      name: 'Cat Tower XL with Sisal Scratch Posts',
      slug: 'cat-tower-xl',
      priceUsd: 89,
      matchScore: 97,
      badge: 'Enrichment Favorite',
    });
    products.push({
      name: 'Hairball & Urinary Tract Wet Care Pouch',
      slug: 'urinary-care-wet-pouch',
      priceUsd: 24,
      matchScore: 94,
      badge: 'Clinical Diet',
    });
  } else if (species === 'Birds') {
    products.push({
      name: 'Nutrient-Fortified Conure & Parrot Seed Blend',
      slug: 'parrot-seed-blend-2kg',
      priceUsd: 18,
      matchScore: 95,
      badge: 'Avian Spec',
    });
  } else {
    // Farm / Poultry
    products.push({
      name: 'Egg Layer Complete Feed (25kg)',
      slug: 'egg-layer-feed-25kg',
      priceUsd: 36,
      matchScore: 99,
      badge: 'Bulk Agricultural',
    });
  }

  return {
    category: `${species} — ${lifeStage.toUpperCase()} Profile`,
    title: `AI Curated Care Plan for your ${species}`,
    reason: `Based on species: ${species}, life stage: ${lifeStage}, and health priorities: [${goals.join(', ') || 'General Wellness'}].`,
    recommendedProducts: products,
    vetSpecialtyRecommendation: vetSpecialty,
  };
}
