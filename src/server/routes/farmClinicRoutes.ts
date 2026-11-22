import { Router } from 'express';
import { getFarms, createFarm, getClinics, createClinic } from '../controllers/farmClinicController';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/authMiddleware';

export const farmRouter = Router();
farmRouter.get('/', optionalAuthMiddleware, getFarms);
farmRouter.post('/', authMiddleware, createFarm);

export const clinicRouter = Router();
clinicRouter.get('/', optionalAuthMiddleware, getClinics);
clinicRouter.post('/', authMiddleware, createClinic);
