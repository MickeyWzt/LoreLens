import type {
  ApiError,
  AppLanguage,
  DailyRecapResult,
  DecipherResult,
  HistoryItem,
} from '../types';

export class ApiClientError extends Error {
  constructor(public readonly details: ApiError) {
    super(details.message);
    this.name = 'ApiClientError';
  }
}

async function apiRequest<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null) as {
    data?: T;
    error?: ApiError;
  } | null;
  if (!response.ok || !payload?.data) {
    throw new ApiClientError(payload?.error || {
      code: response.status === 429 ? 'RATE_LIMITED' : 'NETWORK_ERROR',
      message: response.status === 429
        ? 'The service is busy. Please try again shortly.'
        : 'The request could not be completed.',
      retryable: response.status === 408 || response.status === 429 || response.status >= 500,
      requestId: response.headers.get('x-request-id') || 'unavailable',
    });
  }
  return payload.data;
}

export function decipherImage(
  base64Image: string,
  location?: { lat: number; lng: number },
  language: AppLanguage = 'en',
  signal?: AbortSignal,
): Promise<DecipherResult> {
  return apiRequest('/api/ai/decipher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Image, location, language }),
    signal,
  });
}

export function generateDailyRecap(
  items: HistoryItem[],
  language: AppLanguage,
  signal?: AbortSignal,
): Promise<DailyRecapResult> {
  if (items.length === 0) {
    return Promise.reject(new Error('No items to recap'));
  }
  return apiRequest('/api/ai/recap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records: items, language }),
    signal,
  });
}
