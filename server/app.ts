import { randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';
import {
  appLanguageSchema,
  locationSnapshotSchema,
  parseDailyRecap,
  parseDecipherResult,
  type DailyRecapResult,
  type DecipherResult,
} from '../domain/model';
import { isRetryableProviderError } from './ai/errors';
import type { BackgroundResult } from './background/service';
import type { LocationService } from './location/service';

const decipherRequestSchema = z.object({
  base64Image: z.string().startsWith('data:image/').max(10 * 1024 * 1024),
  language: appLanguageSchema,
  locationLabel: z.string().trim().max(200).optional(),
  location: locationSnapshotSchema.pick({ lat: true, lng: true }).optional(),
});

const recapRequestSchema = z.object({
  language: appLanguageSchema,
  records: z.array(z.unknown()).min(1).max(100),
});

interface ApiDependencies {
  ai: {
    decipher(input: z.infer<typeof decipherRequestSchema>): Promise<DecipherResult>;
    recap(input: z.infer<typeof recapRequestSchema>): Promise<DailyRecapResult>;
  };
  background: {
    getBackground(query: string, timeBucket: string): Promise<BackgroundResult | null>;
    trackDownload(downloadLocation: string): Promise<void>;
  };
  location?: LocationService;
  capabilities: {
    vision: boolean;
    text: boolean;
    background: boolean;
    ipLocation?: boolean;
  };
}

type AsyncHandler = (request: Request, response: Response, next: NextFunction) => Promise<void>;
const asyncRoute = (handler: AsyncHandler) => (
  request: Request,
  response: Response,
  next: NextFunction,
) => void handler(request, response, next).catch(next);

function sendError(
  response: Response,
  status: number,
  code: string,
  message: string,
  retryable: boolean,
) {
  response.status(status).json({
    error: {
      code,
      message,
      retryable,
      requestId: response.locals.requestId,
    },
  });
}

export function createApiApp(dependencies: ApiDependencies) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use((request, response, next) => {
    const requestId = String(request.header('x-request-id') || randomUUID()).slice(0, 128);
    response.locals.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  });
  app.use(express.json({ limit: '10mb' }));
  app.use('/api', rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }));

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true, capabilities: dependencies.capabilities });
  });

  app.post('/api/ai/decipher', asyncRoute(async (request, response) => {
    const parsed = decipherRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(response, 400, 'VALIDATION_ERROR', 'The image or language is invalid.', false);
      return;
    }
    if (!dependencies.capabilities.vision) {
      sendError(response, 503, 'VISION_NOT_CONFIGURED', 'Image analysis is not configured.', false);
      return;
    }
    const result = parseDecipherResult(await dependencies.ai.decipher(parsed.data));
    response.json({ data: result, requestId: response.locals.requestId });
  }));

  app.post('/api/ai/recap', asyncRoute(async (request, response) => {
    const parsed = recapRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(response, 400, 'VALIDATION_ERROR', 'The recap request is invalid.', false);
      return;
    }
    if (!dependencies.capabilities.text) {
      sendError(response, 503, 'TEXT_NOT_CONFIGURED', 'Text summaries are not configured.', false);
      return;
    }
    const result = parseDailyRecap(await dependencies.ai.recap(parsed.data));
    response.json({ data: result, requestId: response.locals.requestId });
  }));

  app.get('/api/background', asyncRoute(async (request, response) => {
    const query = typeof request.query.query === 'string' ? request.query.query.trim() : '';
    const timeBucket = typeof request.query.timeBucket === 'string'
      ? request.query.timeBucket.trim()
      : '';
    if (!query || !timeBucket) {
      sendError(response, 400, 'VALIDATION_ERROR', 'A location and time bucket are required.', false);
      return;
    }
    const result = await dependencies.background.getBackground(query, timeBucket);
    if (!result) {
      response.status(204).end();
      return;
    }
    response.json({ data: result, requestId: response.locals.requestId });
  }));

  app.post('/api/background/download', asyncRoute(async (request, response) => {
    const parsed = z.object({ downloadLocation: z.string().url() }).safeParse(request.body);
    if (!parsed.success) {
      sendError(response, 400, 'VALIDATION_ERROR', 'The download location is invalid.', false);
      return;
    }
    await dependencies.background.trackDownload(parsed.data.downloadLocation);
    response.status(204).end();
  }));

  app.get('/api/location/reverse', asyncRoute(async (request, response) => {
    const lat = Number(request.query.lat);
    const lng = Number(request.query.lng);
    const language = typeof request.query.language === 'string' ? request.query.language : 'en';
    if (!dependencies.location || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      sendError(response, 400, 'VALIDATION_ERROR', 'Valid coordinates are required.', false);
      return;
    }
    const result = await dependencies.location.reverse(lat, lng, language);
    response.json({ data: result, requestId: response.locals.requestId });
  }));

  app.get('/api/location/ip', asyncRoute(async (_request, response) => {
    if (!dependencies.location || !dependencies.capabilities.ipLocation) {
      response.status(204).end();
      return;
    }
    const result = await dependencies.location.locateIp();
    if (!result) {
      response.status(204).end();
      return;
    }
    response.json({ data: result, requestId: response.locals.requestId });
  }));

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) {
      sendError(response, 502, 'INVALID_PROVIDER_RESPONSE', 'The AI response was invalid.', true);
      return;
    }
    const candidate = error as { status?: number; code?: string };
    const status = candidate.status && candidate.status >= 400 && candidate.status < 600
      ? candidate.status
      : 500;
    const retryable = isRetryableProviderError(error);
    sendError(
      response,
      status,
      candidate.code || (retryable ? 'UPSTREAM_UNAVAILABLE' : 'INTERNAL_ERROR'),
      retryable ? 'The service is temporarily unavailable.' : 'The request could not be completed.',
      retryable,
    );
  });

  return app;
}
