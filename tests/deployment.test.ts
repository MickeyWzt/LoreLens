import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

describe('Render deployment blueprint', () => {
  test('builds the full-stack app and keeps provider keys secret', () => {
    const blueprint = fs.readFileSync(path.join(process.cwd(), 'render.yaml'), 'utf8');

    expect(blueprint).toContain('buildCommand: npm ci --include=dev && npm run build');
    expect(blueprint).toContain('startCommand: npm start');
    expect(blueprint).toContain('healthCheckPath: /api/health');
    expect(blueprint).toContain('TRUST_PROXY_HOPS');
    expect(blueprint).toMatch(/key: AI_TIMEOUT_MS\s+value: 90000/);
    for (const key of ['QWEN_API_KEY', 'DEEPSEEK_API_KEY', 'MIMO_API_KEY', 'UNSPLASH_ACCESS_KEY']) {
      expect(blueprint).toMatch(new RegExp(`key: ${key}\\s+sync: false`));
    }
    expect(blueprint).not.toMatch(/sk-[A-Za-z0-9._-]{20,}/);
  });
});
