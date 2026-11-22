import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { createHash, timingSafeEqual } from 'node:crypto';
import { handleTelemedicineTokenRequest, createUserSupabase } from './telemedicineTokenHandler';
import { pushDispatcher } from './pushNotificationDispatcher';
import { handleTriageChatRequest } from './ai/triageHandler';
import { authRouter } from './routes/authRoutes';
import { petRouter } from './routes/petRoutes';
import { farmRouter, clinicRouter } from './routes/farmClinicRoutes';
import { clubRouter } from './routes/clubRoutes';
import { aiRouter } from './routes/aiRoutes';
import { paymentRouter } from './routes/paymentRoutes';
import { telemedicineRouter } from './routes/telemedicineRoutes';
import { adoptionRouter } from './routes/adoptionRoutes';
import { marketplaceRouter } from './routes/marketplaceRoutes';
import { adminRouter } from './routes/adminRoutes';

export function createTelemedicineServer() {
  const app = express();

  // Explicitly configure trust proxy behavior to prevent header spoofing.
  // Only trust upstream reverse proxy headers if TRUST_PROXY is explicitly enabled.
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', true);
  } else if (process.env.TRUST_PROXY) {
    app.set('trust proxy', process.env.TRUST_PROXY);
  } else {
    app.set('trust proxy', false);
  }

  app.use(cors());
  app.use(express.json());

  const healthHandler = (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  };

  // Root health alias for backward compatibility / cloud probes
  app.get('/health', healthHandler);

  // Group all API v1 endpoints consistently under /api/v1
  const v1 = express.Router();

  // GET /api/v1/health
  v1.get('/health', healthHandler);

  // POST /api/v1/telemedicine/token
  v1.post('/telemedicine/token', async (req: Request, res: Response) => {
    try {
      const authorizationHeader = req.headers.authorization;
      const result = await handleTelemedicineTokenRequest({
        authorizationHeader,
        body: req.body,
      });

      return res.status(result.statusCode).json(result.body);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: {
          message: err?.message || 'Internal server error in telemedicine token endpoint.',
          code: 'INTERNAL_SERVER_ERROR',
        },
      });
    }
  });

  // POST /api/v1/notifications/token
  v1.post('/notifications/token', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required: Missing Bearer token.',
            code: 'UNAUTHENTICATED',
          },
        });
      }

      const jwt = authHeader.slice(7).trim();
      const supabase = createUserSupabase(jwt);
      const { data: userData, error: userError } = await supabase.auth.getUser(jwt);

      if (userError || !userData?.user) {
        return res.status(401).json({
          success: false,
          error: { message: 'Invalid or expired session token.', code: 'UNAUTHENTICATED' },
        });
      }

      const { token, platform } = req.body || {};
      if (!token || typeof token !== 'string' || token.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'Valid device push token is required.', code: 'VALIDATION_ERROR' },
        });
      }

      const safePlatform =
        platform === 'ios' || platform === 'android' || platform === 'web' ? platform : 'android';

      const { data, error } = await supabase.rpc('register_device_token', {
        p_token: token.trim(),
        p_platform: safePlatform,
      });

      if (error) {
        return res.status(500).json({
          success: false,
          error: { message: error.message, code: 'DATABASE_ERROR' },
        });
      }

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: {
          message: err?.message || 'Failed to register device token.',
          code: 'INTERNAL_SERVER_ERROR',
        },
      });
    }
  });

  const requireWorker = (req: Request, res: Response, next: NextFunction) => {
    const expected = process.env.NOTIFICATION_WORKER_SECRET || process.env.CRON_SECRET;
    if (!expected && process.env.NODE_ENV !== 'production') {
      return next();
    }
    const authHeader = req.get('authorization');
    const cronHeader = req.get('x-cron-secret');
    const provided = authHeader || (cronHeader ? `Bearer ${cronHeader}` : undefined);
    const digest = (value: string) => createHash('sha256').update(value).digest();
    if (
      !expected ||
      !provided ||
      !timingSafeEqual(digest(provided), digest(`Bearer ${expected}`))
    ) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED' } });
    }
    return next();
  };

  v1.post('/notifications/reminders/run', requireWorker, async (_req: Request, res: Response) => {
    if (!pushDispatcher) return res.status(503).json({ success: false });
    try {
      const processedCount = await pushDispatcher.runAppointmentReminderWorker();
      return res.json({ success: true, processedCount, timestamp: new Date().toISOString() });
    } catch {
      return res.status(500).json({ success: false, error: { code: 'REMINDER_WORKER_ERROR' } });
    }
  });

  v1.post('/notifications/dispatch-pending', requireWorker, async (_req: Request, res: Response) => {
    if (!pushDispatcher) return res.status(503).json({ success: false });
    try {
      const dispatchedCount = await pushDispatcher.dispatchPendingNotifications();
      return res.json({ success: true, dispatchedCount, timestamp: new Date().toISOString() });
    } catch {
      return res.status(500).json({ success: false, error: { code: 'PUSH_DISPATCH_ERROR' } });
    }
  });

  // POST /api/v1/ai/triage-chat
  v1.post('/ai/triage-chat', (req: Request, res: Response) => {
    return handleTriageChatRequest(req, res);
  });

  // Mount The Pets Club Global Modular Sub-Routers
  v1.use('/auth', authRouter);
  v1.use('/pets', petRouter);
  v1.use('/farms', farmRouter);
  v1.use('/clinics', clinicRouter);
  v1.use('/clubs', clubRouter);
  v1.use('/ai', aiRouter);
  v1.use('/payments', paymentRouter);
  v1.use('/telemedicine', telemedicineRouter);
  v1.use('/adoption', adoptionRouter);
  v1.use('/marketplace', marketplaceRouter);
  v1.use('/admin', adminRouter);

  // Mount API v1 router
  app.use('/api/v1', v1);

  return app;
}

// Start standalone server when executed directly
if (require.main === module) {
  const port = process.env.PORT || 3000;
  const app = createTelemedicineServer();

  app.listen(port, () => {
    console.info(`[AppServer] Express listening on http://localhost:${port}`);

    // Use a scheduler in production. Local worker runs require explicit database credentials.
    const isProduction = process.env.NODE_ENV === 'production';
    if (pushDispatcher && !isProduction && process.env.DISABLE_LOCAL_SCHEDULER !== 'true') {
      console.info('[AppServer] Local dev scheduler active (interval: 60s)');
      const worker = pushDispatcher;
      let running = false;
      setInterval(async () => {
        if (running) return;
        running = true;
        try {
          await worker.runAppointmentReminderWorker();
          await worker.dispatchPendingNotifications();
        } catch {
          console.warn('[AppServer] Background notification worker failed.');
        } finally {
          running = false;
        }
      }, 60_000);
    } else if (isProduction) {
      console.info('[AppServer] Production mode: relying on durable external scheduler (pg_cron/Cloud Scheduler)');
    }
  });
}
