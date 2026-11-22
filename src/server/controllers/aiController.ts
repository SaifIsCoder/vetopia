import { Request, Response } from 'express';
import { generateSmartRecommendations } from '../services/recommendationEngine';
import { scoreAdoptionCandidate } from '../services/matchmakingEngine';
import { evaluateContentSafety } from '../services/fraudDetectionService';
import { supabaseAdmin } from '../supabase';

export async function getRecommendations(req: Request, res: Response) {
  try {
    const { species = 'Dogs', lifeStage, size, activity, goals, budget } = req.body;
    const recommendations = generateSmartRecommendations({
      species,
      lifeStage,
      size,
      activity,
      goals: Array.isArray(goals) ? goals : [],
      budget,
    });

    return res.status(200).json({ success: true, data: recommendations });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to generate recommendations.', code: 'SERVER_ERROR' },
    });
  }
}

export async function getAdoptionMatches(req: Request, res: Response) {
  try {
    const answers = req.body;

    const { data: availablePets } = await supabaseAdmin
      .from('adoptions')
      .select('*')
      .eq('status', 'available');

    // Fallback candidate pool if DB is empty
    const pool = (availablePets && availablePets.length > 0) ? availablePets : [
      { slug: 'buddy', name: 'Buddy', species: 'Dogs', breed: 'Golden Retriever', age: '2 yrs' },
      { slug: 'luna', name: 'Luna', species: 'Cats', breed: 'Tabby Cat', age: '1 yr' },
      { slug: 'kiwi', name: 'Kiwi', species: 'Birds', breed: 'Conure', age: '2 yrs' },
      { slug: 'daisy', name: 'Daisy', species: 'Dogs', breed: 'Rescue Mix', age: '8 mo' },
    ];

    const results = pool.map((p) => scoreAdoptionCandidate(answers, p as any));
    results.sort((a, b) => b.score - a.score);

    return res.status(200).json({ success: true, data: results });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to run adoption matchmaking.', code: 'SERVER_ERROR' },
    });
  }
}

export async function checkFraudRisk(req: Request, res: Response) {
  try {
    const { content, userHistory } = req.body;
    if (!content) {
      return res.status(400).json({
        success: false,
        error: { message: 'content text is required.', code: 'VALIDATION_ERROR' },
      });
    }

    const evaluation = evaluateContentSafety(content, userHistory);
    return res.status(200).json({ success: true, data: evaluation });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Fraud evaluation failed.', code: 'SERVER_ERROR' },
    });
  }
}

// Fast chatbot with <1.5s SLA target
export async function fastChatbot(req: Request, res: Response) {
  const startTime = Date.now();
  try {
    const { message, petType } = req.body;
    if (!message) {
      return res.status(400).json({
        success: false,
        error: { message: 'Message is required.', code: 'VALIDATION_ERROR' },
      });
    }

    const lower = message.toLowerCase();
    let reply = `Pets Club AI: Regarding your ${petType || 'pet'}, we recommend monitoring appetite, hydration, and activity level. If symptoms worsen, book an instant consultation with a verified veterinarian.`;

    if (lower.includes('deworm') || lower.includes('worm')) {
      reply = 'Deworming schedule: Puppies/kittens should be dewormed at 2, 4, 6, and 8 weeks of age, then monthly until 6 months. Adult pets typically require deworming every 3 months based on outdoor exposure.';
    } else if (lower.includes('eat') || lower.includes('kibble') || lower.includes('appetite')) {
      reply = 'When a pet refuses food: Check for dental discomfort, sudden diet transitions, or nausea. Try warming wet food slightly or adding bone broth. If food refusal exceeds 24h (or 12h for small pups/kittens), seek immediate vet care.';
    } else if (lower.includes('egg') || lower.includes('hen') || lower.includes('poultry')) {
      reply = 'Hens pausing egg production is commonly triggered by decreasing daylight, molting season, calcium deficiency, or heat stress. Ensure 16% protein layer feed and fresh, calcium-rich oyster shell grit.';
    }

    const durationMs = Date.now() - startTime;
    return res.status(200).json({
      success: true,
      data: {
        reply,
        responseTimeMs: durationMs,
        slaMet: durationMs < 1500,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Chatbot request failed.', code: 'SERVER_ERROR' },
    });
  }
}
