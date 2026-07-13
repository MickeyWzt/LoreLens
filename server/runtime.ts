import path from 'node:path';

export function shouldUseViteMiddleware(nodeEnv: string, entryPoint?: string): boolean {
  if (nodeEnv !== 'development' || !entryPoint) return false;
  return ['.ts', '.tsx', '.mts', '.cts'].includes(path.extname(entryPoint).toLowerCase());
}
