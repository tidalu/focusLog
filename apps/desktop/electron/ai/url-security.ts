import { AIError } from './errors.js';

const localHostnames = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function validateProviderEndpoint(value: string, providerIsLocal: boolean): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AIError('INVALID_CONFIGURATION', 'Enter a valid provider URL.');
  }
  if (url.username || url.password || url.search || url.hash)
    throw new AIError(
      'INVALID_CONFIGURATION',
      'Provider URLs cannot contain credentials, queries, or fragments.'
    );
  if (url.protocol === 'https:') return url.toString().replace(/\/$/u, '');
  const isLocalHost =
    localHostnames.has(url.hostname) ||
    /^192\.168\./u.test(url.hostname) ||
    /^10\./u.test(url.hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./u.test(url.hostname);
  if (url.protocol === 'http:' && providerIsLocal && isLocalHost)
    return url.toString().replace(/\/$/u, '');
  throw new AIError(
    'INVALID_CONFIGURATION',
    'Only HTTPS endpoints are allowed, except explicitly local HTTP endpoints for local providers.'
  );
}
