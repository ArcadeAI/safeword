import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRestTransport } from './github-rest.js';

interface MockResponse {
  ok?: boolean;
  status?: number;
  json: () => unknown;
}

function mockFetch(responder: (url: string) => MockResponse): string[] {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      calls.push(url);
      const r = responder(url);
      return Promise.resolve({
        ok: r.ok ?? true,
        status: r.status ?? 200,
        json: () => Promise.resolve(r.json()),
      });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createRestTransport', () => {
  it('returns undefined without a token', () => {
    expect(createRestTransport('')).toBeUndefined();
  });

  it('C2: strips quote/colon from the search query and requests per_page=100', async () => {
    const calls = mockFetch(() => ({ json: () => ({ items: [] }) }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await transport.searchByTitle('Gate "fails" on: x');

    const decoded = decodeURIComponent(calls[0] ?? '');
    expect(calls[0]).toContain('per_page=100');
    expect(decoded).not.toContain('"');
    expect(decoded).toContain('Gate');
    expect(decoded).toContain('fails');
  });

  it('C1: paginates listComments until a short page', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({ id: i, body: `c${i}` }));
    const calls = mockFetch(url => ({
      json: () => (url.endsWith('page=1') ? fullPage : [{ id: 999, body: 'last' }]),
    }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    const comments = await transport.listComments(42);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('page=1');
    expect(calls[1]).toContain('page=2');
    expect(comments).toHaveLength(101);
  });
});
