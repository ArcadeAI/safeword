import type { PublicRetroReceipt, PublicRetroTransport } from './public-delivery.js';

declare const __SAFEWORD_PUBLIC_RETRO_ORIGIN__: string;

export const PUBLIC_RETRO_ORIGIN =
  typeof __SAFEWORD_PUBLIC_RETRO_ORIGIN__ === 'string'
    ? __SAFEWORD_PUBLIC_RETRO_ORIGIN__
    : 'https://retro-relay-production.up.railway.app';

export function createPublicRetroTransport(options?: {
  fetch: typeof fetch;
  origin: string;
}): PublicRetroTransport {
  const send = options?.fetch ?? fetch;
  const origin = new URL(options?.origin ?? PUBLIC_RETRO_ORIGIN);
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('Invalid public retrospective origin');
  }
  return async (request, signal) => {
    const response = await send(new URL(request.path, origin).href, {
      body: request.body,
      headers: request.headers,
      method: request.method,
      redirect: request.redirect,
      signal,
    });
    if (!response.ok)
      throw new Error(`Public retrospective submission failed (${response.status})`);
    return (await response.json()) as PublicRetroReceipt;
  };
}
