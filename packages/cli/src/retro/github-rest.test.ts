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

// The write-path test needs the fetch `init` arg the simpler mock above drops —
// method, headers, and serialized body are the exact things a regression could
// silently break and still ship green.
interface CapturedCall {
  url: string;
  init: RequestInit;
}

function mockFetchCapturing(responder: (url: string) => MockResponse): CapturedCall[] {
  const calls: CapturedCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      calls.push({ url, init });
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

  // SPNZKM: the write path (createIssue/createComment) was previously unasserted
  // because the mock discarded the fetch init arg — a dropped auth header or
  // wrong method would have shipped green.
  it('createIssue POSTs with the auth header and a JSON body to the issues endpoint', async () => {
    const calls = mockFetchCapturing(() => ({ json: () => ({ number: 7, title: 'T' }) }));
    const transport = createRestTransport('sekret-tok');
    if (!transport) throw new Error('expected a transport');

    const ref = await transport.createIssue({ title: 'T', body: 'B', labels: ['retro'] });

    expect(ref).toEqual({ number: 7, title: 'T' });
    const [call] = calls;
    expect(call?.url).toBe('https://api.github.com/repos/ArcadeAI/safeword/issues');
    expect(call?.init.method).toBe('POST');
    const headers = call?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sekret-tok');
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(call?.init.body as string)).toEqual({
      title: 'T',
      body: 'B',
      labels: ['retro'],
    });
  });

  it('createComment POSTs the body to the comments endpoint with auth', async () => {
    const calls = mockFetchCapturing(() => ({ json: () => ({ id: 99, body: 'hi' }) }));
    const transport = createRestTransport('sekret-tok');
    if (!transport) throw new Error('expected a transport');

    const comment = await transport.createComment(42, 'hi');

    expect(comment).toEqual({ id: 99, body: 'hi' });
    const [call] = calls;
    expect(call?.url).toBe('https://api.github.com/repos/ArcadeAI/safeword/issues/42/comments');
    expect(call?.init.method).toBe('POST');
    expect((call?.init.headers as Record<string, string>).Authorization).toBe('Bearer sekret-tok');
    expect(JSON.parse(call?.init.body as string)).toEqual({ body: 'hi' });
  });

  it('updateComment PATCHes the comment endpoint with the new body', async () => {
    const calls = mockFetchCapturing(() => ({ json: () => ({}) }));
    const transport = createRestTransport('sekret-tok');
    if (!transport) throw new Error('expected a transport');

    await transport.updateComment(123, 'edited');

    const [call] = calls;
    expect(call?.url).toBe('https://api.github.com/repos/ArcadeAI/safeword/issues/comments/123');
    expect(call?.init.method).toBe('PATCH');
    expect(JSON.parse(call?.init.body as string)).toEqual({ body: 'edited' });
  });
});
