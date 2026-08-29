import { describe, expect, it, vi } from 'vitest';

import type { PublicRetroHttpRequest } from './public-delivery.js';
import { createPublicRetroTransport } from './public-transport.js';

describe('public retro HTTPS transport', () => {
  it('constructs with the compiled production origin', () => {
    expect(createPublicRetroTransport()).toBeTypeOf('function');
  });

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
      origin: 'http://127.0.0.1:43179',
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
      'http://127.0.0.1:43179/v1/public-retros',
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

  it('rejects plaintext origins outside the loopback-only test boundary', () => {
    const plaintextOrigin = ['http:', '//collector.example'].join('');
    expect(() => createPublicRetroTransport({ fetch, origin: plaintextOrigin })).toThrow(
      'Invalid public retrospective origin',
    );
  });

  it('rejects origins containing credentials', () => {
    expect(() =>
      createPublicRetroTransport({ fetch, origin: 'https://user:secret@collector.example' }),
    ).toThrow('Invalid public retrospective origin');
  });

  it.each([
    ['https://elsewhere.example/v1/public-retros', 'error'],
    ['https://user:secret@collector.example/v1/public-retros', 'error'],
    ['//elsewhere.example/v1/public-retros', 'error'],
    ['/v1/other', 'error'],
    ['/v1/public-retros', 'follow'],
  ] as const)('rejects a request that can escape the configured origin', async (path, redirect) => {
    const transport = createPublicRetroTransport({
      fetch,
      origin: 'https://collector.example',
    });

    await expect(
      transport({
        method: 'POST',
        path,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'x-safeword-request-id': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        },
        body: new Uint8Array(),
        redirect,
      } as unknown as PublicRetroHttpRequest),
    ).rejects.toThrow('Invalid public retrospective request');
  });

  it.each(['null', '{}', '{"requestId":"fixture","receipt":123}'])(
    'rejects malformed receipt JSON',
    async receiptJson => {
      const transport = createPublicRetroTransport({
        fetch: () =>
          Promise.resolve(
            new Response(receiptJson, { headers: { 'content-type': 'application/json' } }),
          ),
        origin: 'http://127.0.0.1:43179',
      });

      await expect(
        transport({
          method: 'POST',
          path: '/v1/public-retros',
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'x-safeword-request-id': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          },
          body: new Uint8Array(),
          redirect: 'error',
        }),
      ).rejects.toThrow('Invalid public retrospective receipt');
    },
  );

  it('normalizes a non-JSON receipt failure', async () => {
    const transport = createPublicRetroTransport({
      fetch: () => Promise.resolve(new Response('<html>unavailable</html>')),
      origin: 'http://127.0.0.1:43179',
    });

    await expect(
      transport({
        method: 'POST',
        path: '/v1/public-retros',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'x-safeword-request-id': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        },
        body: new Uint8Array(),
        redirect: 'error',
      }),
    ).rejects.toThrow('Invalid public retrospective receipt');
  });

  it.each([
    ['conflict', 409],
    ['unavailable', 503],
  ] as const)('rejects a %s response before parsing a receipt', async (_name, status) => {
    const transport = createPublicRetroTransport({
      fetch: () => Promise.resolve(new Response('unavailable', { status })),
      origin: 'http://127.0.0.1:43179',
    });

    await expect(
      transport({
        method: 'POST',
        path: '/v1/public-retros',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'x-safeword-request-id': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        },
        body: new Uint8Array(),
        redirect: 'error',
      }),
    ).rejects.toThrow(`Public retrospective submission failed (${status})`);
  });

  it('rejects a receipt for a different request identity', async () => {
    const transport = createPublicRetroTransport({
      fetch: () =>
        Promise.resolve(
          Response.json({
            requestId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            receipt: 'receipt-fixture',
          }),
        ),
      origin: 'http://127.0.0.1:43179',
    });

    await expect(
      transport({
        method: 'POST',
        path: '/v1/public-retros',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'x-safeword-request-id': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        },
        body: new Uint8Array(),
        redirect: 'error',
      }),
    ).rejects.toThrow('Invalid public retrospective receipt');
  });
});
