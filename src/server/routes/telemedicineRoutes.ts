import { Router } from 'express';
import { createConsultation, updateConsultationStatus, requestSecondOpinion } from '../controllers/telemedicineWorkflowController';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/authMiddleware';

export const telemedicineRouter = Router();

telemedicineRouter.post('/consultations', optionalAuthMiddleware, createConsultation);
telemedicineRouter.patch('/consultations/:id/status', optionalAuthMiddleware, updateConsultationStatus);
telemedicineRouter.post('/second-opinion', optionalAuthMiddleware, requestSecondOpinion);
