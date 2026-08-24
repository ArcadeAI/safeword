import type { PublicRetroReceipt, PublicRetroTransport } from './public-delivery.js';

declare const __SAFEWORD_PUBLIC_RETRO_ORIGIN__: string;

export const PUBLIC_RETRO_ORIGIN =
  typeof __SAFEWORD_PUBLIC_RETRO_ORIGIN__ === 'string'
    ? __SAFEWORD_PUBLIC_RETRO_ORIGIN__
    : 'https://retro-collector-production.up.railway.app';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]', 'localhost']);

function validOrigin(origin: URL): boolean {
  const secure = origin.protocol === 'https:';
  const loopbackHttp = origin.protocol === 'http:' && LOOPBACK_HOSTS.has(origin.hostname);
  return (
    (secure || loopbackHttp) &&
    origin.pathname === '/' &&
    origin.search === '' &&
    origin.hash === '' &&
    origin.username === '' &&
    origin.password === ''
  );
}

function isPublicRetroReceipt(value: unknown): value is PublicRetroReceipt {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<PublicRetroReceipt>).requestId === 'string' &&
    typeof (value as Partial<PublicRetroReceipt>).receipt === 'string'
  );
}

export function createPublicRetroTransport(options?: {
  fetch: typeof fetch;
  origin: string;
}): PublicRetroTransport {
  const send = options?.fetch ?? fetch;
  const origin = new URL(options?.origin ?? PUBLIC_RETRO_ORIGIN);
  if (!validOrigin(origin)) {
    throw new Error('Invalid public retrospective origin');
  }
  return async (request, signal) => {
    const target = new URL(request.path, origin);
    if (
      request.path !== '/v1/public-retros' ||
      target.origin !== origin.origin ||
      target.username !== '' ||
      target.password !== '' ||
      request.redirect !== 'error'
    ) {
      throw new Error('Invalid public retrospective request');
    }
    const response = await send(target.href, {
      body: request.body,
      headers: request.headers,
      method: request.method,
      redirect: 'error',
      signal,
    });
    if (!response.ok)
      throw new Error(`Public retrospective submission failed (${response.status})`);
    const result: unknown = await response.json();
    if (!isPublicRetroReceipt(result)) {
      throw new Error('Invalid public retrospective receipt');
    }
    return result;
  };
}
