import { isRetryableProviderError } from './errors';

export type ProviderTask<T> = () => Promise<T>;

export async function runWithFallback<T>(
  primary: ProviderTask<T>,
  fallback?: ProviderTask<T>,
): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    if (!fallback || !isRetryableProviderError(error)) throw error;
    return fallback();
  }
}
