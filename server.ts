import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createAiService } from './server/ai/providers';
import { createApiApp } from './server/app';
import { createBackgroundService } from './server/background/service';
import { loadServerConfig } from './server/config';
import { createLocationService } from './server/location/service';

async function startServer() {
  const config = loadServerConfig();
  const ai = createAiService(config.ai);
  const background = createBackgroundService({ accessKey: config.unsplashAccessKey });
  const location = createLocationService({ ipLocationUrl: config.ipLocationUrl });
  const app = createApiApp({
    ai,
    background,
    location,
    capabilities: config.capabilities,
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
