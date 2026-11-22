import { Router } from 'express';
import { getAdoptionPets, applyForAdoption, updateAdoptionStatus } from '../controllers/adoptionWorkflowController';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/authMiddleware';

export const adoptionRouter = Router();

adoptionRouter.get('/pets', optionalAuthMiddleware, getAdoptionPets);
adoptionRouter.post('/pets/:petSlug/apply', optionalAuthMiddleware, applyForAdoption);
adoptionRouter.patch('/pets/:petSlug/status', optionalAuthMiddleware, updateAdoptionStatus);
