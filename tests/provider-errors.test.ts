import { describe, expect, test } from 'vitest';

async function loadProviderErrors() {
  return import('../server/ai/errors').catch(() => null);
}

describe('provider fallback policy', () => {
  test.each([408, 429, 500, 502, 503, 504])('allows one fallback for HTTP %s', async (status) => {
    const errors = await loadProviderErrors();
    expect(errors).not.toBeNull();
    if (!errors) return;
    expect(errors.isRetryableProviderError({ status })).toBe(true);
  });

  test.each([400, 401, 403, 404, 422])('does not fallback for HTTP %s', async (status) => {
    const errors = await loadProviderErrors();
    expect(errors).not.toBeNull();
    if (!errors) return;
    expect(errors.isRetryableProviderError({ status })).toBe(false);
  });
});
