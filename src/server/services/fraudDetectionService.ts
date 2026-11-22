export interface FraudCheckResult {
  isSuspicious: boolean;
  riskScore: number; // 0 - 100
  flags: string[];
}

export function evaluateContentSafety(text: string, userHistory?: { totalPosts: number; accountAgeDays: number }): FraudCheckResult {
  const flags: string[] = [];
  let score = 5;

  const spamKeywords = [
    'buy followers',
    'crypto giveaway',
    'free gift card',
    'whatsapp me at',
    'cheap meds no prescription',
    'wire transfer',
    'telegram link',
    '100% guaranteed profit',
  ];

  const lower = text.toLowerCase();
  for (const kw of spamKeywords) {
    if (lower.includes(kw)) {
      flags.push(`Matched suspicious keyword: "${kw}"`);
      score += 40;
    }
  }

  // Check URL flooding
  const urlCount = (text.match(/https?:\/\//g) || []).length;
  if (urlCount > 3) {
    flags.push(`Excessive external links count: ${urlCount}`);
    score += 30;
  }

  // Check new account posting spam
  if (userHistory && userHistory.accountAgeDays < 1 && userHistory.totalPosts > 10) {
    flags.push('High posting velocity on newly created account');
    score += 35;
  }

  const finalScore = Math.min(100, score);
  return {
    isSuspicious: finalScore >= 50,
    riskScore: finalScore,
    flags,
  };
}
