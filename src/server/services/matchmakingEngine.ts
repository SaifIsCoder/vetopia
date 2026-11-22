export interface MatchmakingQuizAnswers {
  species: string; // 'any' | 'Dogs' | 'Cats' | 'Birds' | 'Other'
  home: string; // 'apartment' | 'house_no_yard' | 'house_yard' | 'farm'
  activity: string; // 'low' | 'medium' | 'high'
  hoursAlone: string; // '<4' | '4-8' | '>8'
  family: string; // 'alone' | 'partner' | 'kids' | 'other_pets'
  experience: string; // 'first' | 'some' | 'experienced'
  vibe: string; // 'cuddle' | 'playful' | 'independent' | 'adventure'
}

export interface MatchScoreResult {
  petSlug: string;
  petName: string;
  species: string;
  score: number; // 0 - 100
  matchReason: string;
}

export function scoreAdoptionCandidate(
  answers: MatchmakingQuizAnswers,
  pet: {
    slug: string;
    name: string;
    species: string;
    breed: string;
    age: string;
  }
): MatchScoreResult {
  let score = 70; // baseline compatibility
  const reasons: string[] = [];

  // Species preference match
  if (answers.species === 'any' || answers.species.toLowerCase() === pet.species.toLowerCase()) {
    score += 15;
    reasons.push(`Matches your species preference for ${pet.species}.`);
  } else {
    score -= 20;
  }

  // Home environment
  if (answers.home === 'apartment') {
    if (pet.species === 'Cats' || pet.breed.toLowerCase().includes('conure') || pet.breed.toLowerCase().includes('small')) {
      score += 10;
      reasons.push('Comfortable in apartment living.');
    } else if (pet.breed.toLowerCase().includes('retriever') || pet.breed.toLowerCase().includes('labrador')) {
      score -= 5;
    }
  } else if (answers.home === 'house_yard' || answers.home === 'farm') {
    score += 10;
    reasons.push('Ideal space for exercise and exploration.');
  }

  // Activity compatibility
  if (answers.activity === 'high') {
    if (pet.species === 'Dogs') {
      score += 10;
      reasons.push('Great match for outdoor adventures.');
    }
  } else if (answers.activity === 'low') {
    if (pet.species === 'Cats' || pet.age.includes('5') || pet.age.includes('senior')) {
      score += 10;
      reasons.push('Matches your calm, relaxed home rhythm.');
    }
  }

  // Hours alone
  if (answers.hoursAlone === '>8') {
    if (pet.species === 'Cats') {
      score += 5;
      reasons.push('Independent personality handles daytime alone well.');
    } else {
      score -= 10;
    }
  }

  const finalScore = Math.min(99, Math.max(50, score));

  return {
    petSlug: pet.slug,
    petName: pet.name,
    species: pet.species,
    score: finalScore,
    matchReason: reasons.join(' ') || 'General lifestyle fit.',
  };
}
