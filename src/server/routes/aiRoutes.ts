import { Router } from 'express';
import { getRecommendations, getAdoptionMatches, checkFraudRisk, fastChatbot } from '../controllers/aiController';
import { optionalAuthMiddleware } from '../middleware/authMiddleware';

export const aiRouter = Router();

aiRouter.post('/recommendations', optionalAuthMiddleware, getRecommendations);
aiRouter.post('/matchmaking', optionalAuthMiddleware, getAdoptionMatches);
aiRouter.post('/fraud-check', optionalAuthMiddleware, checkFraudRisk);
aiRouter.post('/fast-chat', optionalAuthMiddleware, fastChatbot);
