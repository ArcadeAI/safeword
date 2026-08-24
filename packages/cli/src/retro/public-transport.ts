import type { PublicRetroTransport } from './public-delivery.js';

const unavailableTransport: PublicRetroTransport = () =>
  Promise.reject(new Error('Public retro transport is not implemented'));

export function createPublicRetroTransport(_options: {
  fetch: typeof fetch;
  origin: string;
}): PublicRetroTransport {
  return unavailableTransport;
}
