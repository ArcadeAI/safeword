import type { PublicRetroReceipt, PublicRetroTransport } from './public-delivery.js';

export function createPublicRetroTransport(_options: {
  fetch: typeof fetch;
  origin: string;
}): PublicRetroTransport {
  const origin = new URL(_options.origin);
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('Invalid public retrospective origin');
  }
  return async (request, signal) => {
    const response = await _options.fetch(new URL(request.path, origin).href, {
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
