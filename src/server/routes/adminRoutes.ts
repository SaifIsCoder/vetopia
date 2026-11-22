import { Router } from 'express';
import { getAdminReports, createReport, resolveReport, approveEntity } from '../controllers/adminController';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';

export const adminRouter = Router();

adminRouter.get('/reports', authMiddleware, requireRole('admin'), getAdminReports);
adminRouter.post('/reports', optionalAuthMiddleware, createReport);
adminRouter.patch('/reports/:id/resolve', authMiddleware, requireRole('admin'), resolveReport);
adminRouter.patch('/approvals/:entityType/:entityId', authMiddleware, requireRole('admin'), approveEntity);
