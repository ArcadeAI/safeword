import { describe, expect, it, vi } from 'vitest';

import { createPublicRetroTransport } from './public-transport.js';

describe('public retro HTTPS transport', () => {
  it('posts canonical bytes to the sole origin and returns the echoed receipt', async () => {
    const send = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        Response.json({
          requestId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          receipt: 'receipt-fixture',
        }),
      ),
    );
    const transport = createPublicRetroTransport({
      fetch: send,
      origin: 'https://collector.example',
    });
    const body = new TextEncoder().encode('{"version":"v1"}');

    await expect(
      transport({
        method: 'POST',
        path: '/v1/public-retros',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'x-safeword-request-id': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        },
        body,
        redirect: 'error',
      }),
    ).resolves.toEqual({
      requestId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      receipt: 'receipt-fixture',
    });

    expect(send).toHaveBeenCalledWith(
      'https://collector.example/v1/public-retros',
      expect.objectContaining({
        body,
        method: 'POST',
        redirect: 'error',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'x-safeword-request-id': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        },
      }),
    );
  });
});
