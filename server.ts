import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createAiService } from './server/ai/providers';
import { createApiApp } from './server/app';
import { createBackgroundService } from './server/background/service';
import { loadServerConfig } from './server/config';

async function startServer() {
  const config = loadServerConfig();
  const ai = createAiService(config.ai);
  const background = createBackgroundService({ accessKey: config.unsplashAccessKey });
  const app = createApiApp({
    ai,
    background,
    capabilities: config.capabilities,
  });

  // Compatibility proxy retained until the location module completes its V2 migration.
  const reverseCache = new Map<string, unknown>();
  app.get('/api/nominatim/reverse', async (request, response) => {
    const lat = Number(request.query.lat);
    const lon = Number(request.query.lon);
    const lang = typeof request.query.lang === 'string' ? request.query.lang : 'en';
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      response.status(400).json({ error: { code: 'VALIDATION_ERROR', retryable: false } });
      return;
    }
    const key = `${lat.toFixed(4)},${lon.toFixed(4)},${lang}`;
    const cached = reverseCache.get(key);
    if (cached) {
      response.json(cached);
      return;
    }
    try {
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.search = new URLSearchParams({
        format: 'json',
        lat: String(lat),
        lon: String(lon),
        zoom: '12',
        addressdetails: '1',
        'accept-language': lang,
      }).toString();
      const upstream = await fetch(url, {
        headers: { 'User-Agent': 'LoreLens/7.14 (support@lorelens.org)' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!upstream.ok) {
        response.status(upstream.status).json({ error: { code: 'GEO_UNAVAILABLE', retryable: true } });
        return;
      }
      const data = await upstream.json();
      reverseCache.set(key, data);
      if (reverseCache.size > 500) reverseCache.delete(reverseCache.keys().next().value!);
      response.json(data);
    } catch {
      response.status(503).json({ error: { code: 'GEO_UNAVAILABLE', retryable: true } });
    }
  });

  if (config.nodeEnv !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use((await import('express')).default.static(distPath));
    app.get('*all', (_request, response) => {
      response.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.info(JSON.stringify({
      level: 'info',
      event: 'server_started',
      port: config.port,
      capabilities: config.capabilities,
    }));
  });
}

startServer().catch((error) => {
  console.error(JSON.stringify({
    level: 'error',
    event: 'server_start_failed',
    message: error instanceof Error ? error.message : 'Unknown startup error',
  }));
  process.exitCode = 1;
});
