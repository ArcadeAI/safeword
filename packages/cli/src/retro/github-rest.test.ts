import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRestTransport, resolveGitHubToken } from './github-rest.js';

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

  it('C2: searches the body for the signature hash token and requests per_page=100', async () => {
    const calls = mockFetch(() => ({ json: () => ({ items: [] }) }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await transport.searchBySignature('retro:abc123def456');

    const decoded = decodeURIComponent(calls[0] ?? '');
    expect(calls[0]).toContain('per_page=100');
    // searches the body, by the bare hash token (no `retro:` colon qualifier)
    expect(decoded).toContain('in:body');
    expect(decoded).toContain('abc123def456');
    expect(decoded).not.toContain('retro:abc123def456');
  });

  it('C2: rejects a fuzzy near-miss whose body lacks the exact signature', async () => {
    mockFetch(() => ({
      json: () => ({
        items: [
          { number: 1, title: 'near miss', body: 'has retro:zzzzzzzzzzzz only' },
          { number: 2, title: 'exact', body: 'carries retro:abc123def456 here' },
        ],
      }),
    }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    const matches = await transport.searchBySignature('retro:abc123def456');

    expect(matches).toEqual([{ number: 2, title: 'exact' }]);
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

describe('resolveGitHubToken (7D8PJP — no hard GITHUB_TOKEN requirement)', () => {
  // Build correctly-shaped tokens at runtime so the secret scanner doesn't flag
  // a literal that looks like a real credential.
  const envToken = `ghp_${'a'.repeat(32)}`;
  const ghToken = `ghp_${'b'.repeat(32)}`;

  // invisible-retro-claude.SM1.AC1 (token arm) — GITHUB_TOKEN present → the REST
  // transport is built from it; `gh` is never consulted.
  it('invisible-retro-claude.SM1.AC1.token_present_uses_the_rest_transport', () => {
    let ghConsulted = false;
    const token = resolveGitHubToken({ GITHUB_TOKEN: envToken }, () => {
      ghConsulted = true;
      return ghToken;
    });
    expect(token).toBe(envToken);
    expect(ghConsulted).toBe(false);
    // a transport is genuinely built from the resolved token
    expect(createRestTransport(token)).toBeDefined();
  });

  // #634 — a non-token-shaped placeholder (e.g. the `proxy-injected` value some
  // cloud containers put in GITHUB_TOKEN) is treated as absent: it must NOT be
  // passed to the API, and resolution falls through to `gh` instead.
  it('ignores a non-token-shaped GITHUB_TOKEN and falls back to gh', () => {
    let ghConsulted = false;
    const token = resolveGitHubToken({ GITHUB_TOKEN: 'proxy-injected' }, () => {
      ghConsulted = true;
      return ghToken;
    });
    expect(token).toBe(ghToken);
    expect(ghConsulted).toBe(true);
  });

  // invisible-retro-claude.SM1.AC1 (no-token arm) — no GITHUB_TOKEN but the
  // environment's `gh` access provides one → filing proceeds (transport built),
  // not a failure for lack of a token.
  it('invisible-retro-claude.SM1.AC1.filing_succeeds_without_a_github_token', () => {
    const token = resolveGitHubToken({}, () => 'gh-tok');
    expect(token).toBe('gh-tok');
    expect(createRestTransport(token)).toBeDefined();
  });

  it('returns undefined when neither GITHUB_TOKEN nor gh is available (graceful no-op)', () => {
    // No token resolved → createRestTransport('') yields no transport, so the
    // command no-ops gracefully rather than failing the Stop.
    const noGh = (): string | undefined => undefined;
    expect(resolveGitHubToken({}, noGh)).toBeUndefined();
    expect(createRestTransport('')).toBeUndefined();
  });
});
