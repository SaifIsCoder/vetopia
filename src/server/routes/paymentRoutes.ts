import { Router } from 'express';
import { getCurrencies, processPayment, getUserPayments } from '../controllers/paymentController';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/authMiddleware';

export const paymentRouter = Router();

paymentRouter.get('/currencies', getCurrencies);
paymentRouter.post('/charge', optionalAuthMiddleware, processPayment);
paymentRouter.get('/history', authMiddleware, getUserPayments);
