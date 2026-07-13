import type { TFunction } from 'i18next';
import type { ApiError } from '../types';

export function localizeApiError(error: ApiError, t: TFunction): string {
  const code = error.code.toUpperCase();
  if (code.includes('NOT_CONFIGURED') || code.includes('KEY') || code.includes('AUTH') || code.includes('PERMISSION')) {
    return t('errors.serviceNotConfigured');
  }
  if (code.includes('RATE') || code.includes('QUOTA') || code === 'RESOURCE_EXHAUSTED') {
    return t('errors.rateLimited');
  }
  if (code === 'NETWORK_ERROR' && typeof navigator !== 'undefined' && !navigator.onLine) {
    return t('errors.offlineRetry');
  }
  return error.message || t('errors.analysisFailed');
}
