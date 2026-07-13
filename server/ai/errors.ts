export interface ProviderErrorLike {
  status?: number;
  code?: string;
  name?: string;
  message?: string;
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT']);

export function isRetryableProviderError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as ProviderErrorLike;
  if (candidate.status && RETRYABLE_STATUS.has(candidate.status)) return true;
  if (candidate.code && RETRYABLE_CODES.has(candidate.code)) return true;
  return candidate.name === 'TimeoutError';
}
