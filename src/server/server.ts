import express, { Request, Response } from 'express';
import cors from 'cors';
import { handleTelemedicineTokenRequest } from './telemedicineTokenHandler';

export function createTelemedicineServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Approved Telemedicine Token Endpoint (API-TELE-001)
  app.post('/api/v1/telemedicine/token', async (req: Request, res: Response) => {
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

  return app;
}

// Start standalone server when executed directly
if (require.main === module) {
  const port = process.env.PORT || 3000;
  const app = createTelemedicineServer();
  app.listen(port, () => {
    console.info(`[TelemedicineServer] Express listening on http://localhost:${port}`);
  });
}
