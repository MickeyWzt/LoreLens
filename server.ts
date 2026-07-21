import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createAiService } from './server/ai/providers';
import { createApiApp } from './server/app';
import { createBackgroundService } from './server/background/service';
import { loadServerConfig } from './server/config';
import { createLocationService } from './server/location/service';
import { shouldUseViteMiddleware } from './server/runtime';
import { createTtsService } from './server/tts/service';

async function startServer() {
  const config = loadServerConfig();
  const useViteMiddleware = shouldUseViteMiddleware(config.nodeEnv, process.argv[1]);
  const ai = createAiService(config.ai);
  const background = createBackgroundService({ accessKey: config.unsplashAccessKey });
  const location = createLocationService({ ipLocationUrl: config.ipLocationUrl });
  const tts = createTtsService(config.tts);
  const app = createApiApp({
    ai,
    background,
    location,
    tts,
    capabilities: config.capabilities,
    trustProxyHops: config.trustProxyHops,
    rateLimits: config.rateLimits,
    developmentMode: useViteMiddleware,
  });

  if (useViteMiddleware) {
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
