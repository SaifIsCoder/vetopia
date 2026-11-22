import { Router } from 'express';
import { getPets, getPetById, createPet, addVaccination } from '../controllers/petController';
import { authMiddleware } from '../middleware/authMiddleware';

export const petRouter = Router();

petRouter.get('/', authMiddleware, getPets);
petRouter.get('/:id', authMiddleware, getPetById);
petRouter.post('/', authMiddleware, createPet);
petRouter.post('/:id/vaccinations', authMiddleware, addVaccination);
