import { describe, expect, test, vi } from 'vitest';

async function loadRunner() {
  return import('../server/ai/orchestrator').catch(() => null);
}

describe('provider orchestrator', () => {
  test('falls back exactly once after a retryable upstream failure', async () => {
    const module = await loadRunner();
    expect(module).not.toBeNull();
    if (!module) return;

    const primary = vi.fn().mockRejectedValue({ status: 429 });
    const fallback = vi.fn().mockResolvedValue('fallback-result');

    await expect(module.runWithFallback(primary, fallback)).resolves.toBe('fallback-result');
    expect(primary).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  test('does not fall back after a non-retryable client failure', async () => {
    const module = await loadRunner();
    expect(module).not.toBeNull();
    if (!module) return;

    const primary = vi.fn().mockRejectedValue({ status: 400 });
    const fallback = vi.fn().mockResolvedValue('should-not-run');

    await expect(module.runWithFallback(primary, fallback)).rejects.toMatchObject({ status: 400 });
    expect(fallback).not.toHaveBeenCalled();
  });
});
