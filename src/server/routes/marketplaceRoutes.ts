import { Router } from 'express';
import { getMarketplaceItems, createMarketplaceItem } from '../controllers/marketplaceController';
import { optionalAuthMiddleware, authMiddleware } from '../middleware/authMiddleware';

export const marketplaceRouter = Router();

marketplaceRouter.get('/items', optionalAuthMiddleware, getMarketplaceItems);
marketplaceRouter.post('/items', authMiddleware, createMarketplaceItem);
