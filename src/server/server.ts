import express, { Request, Response } from 'express';
import cors from 'cors';
import { handleTelemedicineTokenRequest, defaultSupabase } from './telemedicineTokenHandler';
import { pushDispatcher } from './pushNotificationDispatcher';
import { handleTriageChatRequest } from './ai/triageHandler';

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

      const jwt = authHeader.split(' ')[1];
      const { data: userData, error: userError } = await defaultSupabase.auth.getUser(jwt);

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

      const { data, error } = await defaultSupabase
        .from('device_tokens')
        .upsert(
          {
            user_id: userData.user.id,
            token: token.trim(),
            platform: safePlatform,
            is_active: true,
            updated_at: new Date().toISOString(),
            last_used_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,token' },
        )
        .select()
        .single();

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

  // POST /api/v1/notifications/reminders/run
  v1.post('/notifications/reminders/run', async (_req: Request, res: Response) => {
    try {
      const processedCount = await pushDispatcher.runAppointmentReminderWorker();
      return res.status(200).json({
        success: true,
        processedCount,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: {
          message: err?.message || 'Failed to execute reminder worker.',
          code: 'INTERNAL_SERVER_ERROR',
        },
      });
    }
  });

  // POST /api/v1/notifications/dispatch-pending
  v1.post('/notifications/dispatch-pending', async (_req: Request, res: Response) => {
    try {
      const dispatchedCount = await pushDispatcher.dispatchPendingNotifications();
      return res.status(200).json({
        success: true,
        dispatchedCount,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: {
          message: err?.message || 'Failed to dispatch pending notifications.',
          code: 'INTERNAL_SERVER_ERROR',
        },
      });
    }
  });

  // POST /api/v1/ai/triage-chat
  v1.post('/ai/triage-chat', (req: Request, res: Response) => {
    return handleTriageChatRequest(req, res);
  });

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

    // Standalone local development fallback runner:
    // In production environments, scheduled jobs are invoked externally via durable schedulers
    // (e.g. Supabase pg_cron, Kubernetes CronJob, or AWS EventBridge) to avoid in-memory state loss.
    setInterval(() => {
      pushDispatcher.runAppointmentReminderWorker().catch((err) => {
        console.warn('[AppServer] Background reminder worker error:', err);
      });
      pushDispatcher.dispatchPendingNotifications().catch((err) => {
        console.warn('[AppServer] Background outbox dispatcher error:', err);
      });
    }, 60000);
  });
}
