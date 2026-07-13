import { describe, expect, test } from 'vitest';

async function loadRuntime() {
  return import('../server/runtime').catch(() => null);
}

describe('server runtime mode', () => {
  test('uses Vite only for the TypeScript development entrypoint', async () => {
    const module = await loadRuntime();
    expect(module).not.toBeNull();
    if (!module) return;

    expect(module.shouldUseViteMiddleware('development', 'D:/app/server.ts')).toBe(true);
    expect(module.shouldUseViteMiddleware('development', 'D:/app/dist/server.cjs')).toBe(false);
    expect(module.shouldUseViteMiddleware('production', 'D:/app/server.ts')).toBe(false);
  });
});
