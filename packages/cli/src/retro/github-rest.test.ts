import { afterEach, describe, expect, it, vi } from 'vitest';

const spawnSyncMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({ spawnSync: spawnSyncMock }));

import { createRestTransport, resolveGitHubToken } from './github-rest.js';

interface MockResponse {
  ok?: boolean;
  status?: number;
  json: () => unknown;
}

const GITHUB_PAGE_SIZE = 100;
// Deliberately independent from the production value: an accidental cap change
// must fail the boundary contract instead of updating its own expectation.
const EXPECTED_DEDUP_PAGE_BOUND = 200;
const EXPECTED_DEDUP_PROBE_PAGE = EXPECTED_DEDUP_PAGE_BOUND + 1;
const EXPECTED_DEDUP_ITEM_BOUND = EXPECTED_DEDUP_PAGE_BOUND * GITHUB_PAGE_SIZE;
const PAGE_BOUNDARY_FIXTURE_SIZE = 2 * GITHUB_PAGE_SIZE + 1;

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
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe('createRestTransport', () => {
  it('returns undefined without a token', () => {
    expect(createRestTransport('')).toBeUndefined();
  });

  // #1453 — dedup must not route through GitHub's search index. The marker lives
  // in an HTML comment, and an unindexed marker returns the same empty array as a
  // genuinely absent one, so triage cannot tell "no duplicate" from "could not
  // tell". These tests pin the listing endpoint as the source of truth.
  it('#1481: enumerates all issue states in creation order, never the search index', async () => {
    const calls = mockFetch(() => ({ json: () => [] }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await transport.searchBySignature('retro:abc123def456');

    const [url = ''] = calls;
    expect(url).not.toContain('/search/');
    expect(url).toBe(
      'https://api.github.com/repos/ArcadeAI/safeword/issues' +
        '?state=all&sort=created&direction=asc&per_page=100&page=1',
    );
  });

  it('C2: rejects a fuzzy near-miss whose body lacks the exact signature', async () => {
    mockFetch(() => ({
      json: () => [
        // A hash the requested one is a strict PREFIX of. Only matching the full
        // marker — terminator included — rejects this; a bare-hash substring
        // check would accept it and dedupe against the wrong issue.
        {
          number: 1,
          title: 'near miss',
          body: '<!-- safeword-retro-signature: retro:abc123def4567 -->',
          state: 'open',
        },
        {
          number: 2,
          title: 'exact',
          body: '<!-- safeword-retro-signature: retro:abc123def456 -->',
          state: 'open',
        },
      ],
    }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    const matches = await transport.searchBySignature('retro:abc123def456');

    expect(matches).toEqual([{ number: 2, title: 'exact' }]);
  });

  it('prevent-retro-duplicate-issues.SM1.R2.rejects a canonical hash token without its exact marker', async () => {
    mockFetch(() => ({
      json: () => [
        {
          number: 1,
          title: 'near miss',
          body: 'contains canonical:abc123def456-suffix',
          state: 'open',
        },
        {
          number: 2,
          title: 'exact',
          body: '<!-- safeword-retro-canonical: canonical:abc123def456 -->',
          state: 'open',
        },
      ],
    }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    const matches = await transport.searchByCanonical('canonical:abc123def456');

    expect(matches).toEqual([{ number: 2, title: 'exact' }]);
  });

  it('rejects an exact canonical marker copied into a pull request', async () => {
    mockFetch(() => ({
      json: () => [
        {
          number: 1,
          title: 'copied marker PR',
          body: '<!-- safeword-retro-canonical: canonical:abc123def456 -->',
          state: 'open',
          pull_request: {},
        },
        {
          number: 2,
          title: 'canonical issue',
          body: '<!-- safeword-retro-canonical: canonical:abc123def456 -->',
          state: 'open',
        },
      ],
    }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchByCanonical('canonical:abc123def456')).resolves.toEqual([
      { number: 2, title: 'canonical issue' },
    ]);
  });

  it('#1481: rejects an exact marker carried only by a closed issue', async () => {
    mockFetch(() => ({
      json: () => [
        {
          number: 1,
          title: 'closed recurrence',
          body: '<!-- safeword-retro-signature: retro:abc123def456 -->',
          state: 'closed',
        },
      ],
    }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchBySignature('retro:abc123def456')).resolves.toEqual([]);
  });

  // The marker can be hand-copied into an ordinary issue when two are merged
  // (#1453 documents exactly that on #1425), so dedup must not filter by label.
  it('#1453: matches a marker on an issue that carries no retro label', async () => {
    const calls = mockFetch(() => ({
      json: () => [
        {
          number: 1425,
          title: 'hand-merged issue',
          body: 'merged\n<!-- safeword-retro-signature: retro:9230b08d2fb3 -->',
          state: 'open',
          labels: [],
        },
      ],
    }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchBySignature('retro:9230b08d2fb3')).resolves.toEqual([
      { number: 1425, title: 'hand-merged issue' },
    ]);
    expect(calls[0]).not.toContain('labels=');
  });

  it('#1453: paginates the enumeration and reuses it across lookups', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      number: i,
      title: `t${i}`,
      body: 'nothing here',
      state: 'open',
    }));
    const calls = mockFetch(url => ({
      json: () =>
        url.endsWith('page=1')
          ? fullPage
          : [
              {
                number: 999,
                title: 'on page two',
                body: '<!-- safeword-retro-signature: retro:abc123def456 -->',
                state: 'open',
              },
            ],
    }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchBySignature('retro:abc123def456')).resolves.toEqual([
      { number: 999, title: 'on page two' },
    ]);
    // One all-state sweep populates the transport cache.
    expect(calls).toHaveLength(2);

    // A second lookup reuses the enumeration — triage runs two per encounter.
    await transport.searchByCanonical('canonical:abc123def456');
    expect(calls).toHaveLength(2);
  });

  // The bug this replaces was invisible because a zero result was
  // indistinguishable from success. A truncated enumeration must fail loudly:
  // triage isolates the throw and leaves the draft spooled (recoverable) rather
  // than reading the empty result as "no duplicate" and filing one.
  it('#1453: throws instead of returning no match when the enumeration truncates', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      number: i,
      title: `t${i}`,
      body: 'no marker',
      state: 'open',
    }));
    const calls = mockFetch(() => ({ json: () => fullPage }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchBySignature('retro:abc123def456')).rejects.toThrow(/truncated/);
    // The configured bound pages + a full probe page → a genuine tail.
    expect(calls).toHaveLength(EXPECTED_DEDUP_PROBE_PAGE);
  });

  // The boundary the bound alone cannot distinguish: at exactly the configured
  // number of full pages the enumeration is COMPLETE, and throwing there would
  // halt every session's filing over a tail that does not exist.
  it('#1453: completes rather than throwing at exactly the page bound', async () => {
    const fullPage = Array.from({ length: GITHUB_PAGE_SIZE }, (_, i) => ({
      number: i,
      title: `t${i}`,
      body: 'no marker',
      state: 'open',
    }));
    const calls = mockFetch(url => ({
      json: () => (url.endsWith(`page=${EXPECTED_DEDUP_PROBE_PAGE}`) ? [] : fullPage),
    }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchBySignature('retro:abc123def456')).resolves.toEqual([]);
    expect(calls).toHaveLength(EXPECTED_DEDUP_PROBE_PAGE);
  });

  // The cap has to mean what it says. Appending the probe page instead of
  // rejecting it would silently accept items beyond the configured bound.
  it('#1453: trips the cap at the first item past the bound', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      number: i,
      title: `t${i}`,
      body: 'no marker',
      state: 'open',
    }));
    const calls = mockFetch(url => ({
      // Exactly one item past the bound — the smallest genuine tail there is.
      json: () =>
        url.endsWith(`page=${EXPECTED_DEDUP_PROBE_PAGE}`)
          ? [{ number: EXPECTED_DEDUP_ITEM_BOUND + 1, title: 'tail', body: 'x', state: 'open' }]
          : fullPage,
    }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchBySignature('retro:abc123def456')).rejects.toThrow(/truncated/);
    expect(calls).toHaveLength(EXPECTED_DEDUP_PROBE_PAGE);
  });

  // Ascending creation order appends genuinely new issues to the last page,
  // where they displace nothing already read.
  it('#1481: includes a new marker appended on a later page', async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => ({
      number: i + 1,
      title: `t${i + 1}`,
      body: 'no marker',
      state: 'open',
    }));
    mockFetch(url => ({
      json: () =>
        url.endsWith('page=1')
          ? firstPage
          : [
              {
                number: 5000,
                title: 'brand new',
                body: '<!-- safeword-retro-signature: retro:abc123def456 -->',
                state: 'open',
              },
            ],
    }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchBySignature('retro:abc123def456')).resolves.toEqual([
      { number: 5000, title: 'brand new' },
    ]);
  });

  it('#1481: finds a still-open marker when an earlier issue closes at a page boundary', async () => {
    const marker = '<!-- safeword-retro-signature: retro:abc123def456 -->';
    const settled = Array.from({ length: PAGE_BOUNDARY_FIXTURE_SIZE }, (_, i) => ({
      number: i + 1,
      title: `t${i + 1}`,
      body: i === 100 ? marker : 'no marker',
      state: 'open',
    }));
    const pageOf = (list: typeof settled, page: number) => list.slice((page - 1) * 100, page * 100);

    mockFetch(url => {
      const page = Number(/&page=(\d+)$/.exec(url)?.[1] ?? '1');
      if (url.includes('state=all')) {
        const allStates = settled.map(issue =>
          issue.number === 1 && page > 1 ? { ...issue, state: 'closed' } : issue,
        );
        return { json: () => pageOf(allStates, page) };
      }

      // The current open-only strategy sees #1 on page one, then loses it before
      // page two. Every repeated sweep suffers the same shift, so set comparison
      // cannot distinguish three equally incomplete reads from a stable result.
      const openAfterClose = settled.slice(1);
      return { json: () => pageOf(page === 1 ? settled : openAfterClose, page) };
    });
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchBySignature('retro:abc123def456')).resolves.toEqual([
      { number: 101, title: 't101' },
    ]);
  });

  // A wrong credential fails the same way every time. Retrying it once per
  // finding burns a whole sweep each and can trip rate limits (#1465 review).
  it('#1465: latches a terminal auth failure instead of re-sweeping per encounter', async () => {
    const calls = mockFetch(() => ({ ok: false, status: 401, json: () => ({}) }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchBySignature('retro:abc123def456')).rejects.toThrow('401');
    expect(calls).toHaveLength(1);

    // The next encounter fails from the latch — no second request.
    await expect(transport.searchByCanonical('canonical:abc123def456')).rejects.toThrow('401');
    expect(calls).toHaveLength(1);
  });

  it('#1520: sends an opaque Bearer credential to GitHub, where its 401 is terminal', async () => {
    const calls = mockFetchCapturing(() => ({ ok: false, status: 401, json: () => ({}) }));
    const token = resolveGitHubToken({ GITHUB_TOKEN: 'future-token~1' }, () => {
      throw new Error('gh fallback must not be consulted');
    });
    expect(token).toBe('future-token~1');
    const transport = createRestTransport(token);
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchBySignature('retro:abc123def456')).rejects.toThrow('401');
    expect(calls).toHaveLength(1);
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe(
      'Bearer future-token~1',
    );

    // The next encounter fails from the latch — no second request.
    await expect(transport.searchByCanonical('canonical:abc123def456')).rejects.toThrow('401');
    expect(calls).toHaveLength(1);
  });

  // 5xx is transient by definition, so it must stay retryable — latching it
  // would sink a whole session on one blip.
  it('#1465: still retries a transient 5xx on the next encounter', async () => {
    let attempt = 0;
    const calls = mockFetch(() => {
      attempt += 1;
      return attempt === 1 ? { ok: false, status: 503, json: () => ({}) } : { json: () => [] };
    });
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchBySignature('retro:abc123def456')).rejects.toThrow('503');
    await expect(transport.searchByCanonical('canonical:abc123def456')).resolves.toEqual([]);
    expect(calls.length).toBeGreaterThan(1);
  });

  // Truncation is deterministic: re-running it burns another full bounded sweep
  // plus the probe to reach the same answer. Only transient failures earn a retry.
  it('#1453: does not re-run a terminal truncation for every later encounter', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      number: i,
      title: `t${i}`,
      body: 'no marker',
      state: 'open',
    }));
    const calls = mockFetch(() => ({ json: () => fullPage }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchBySignature('retro:abc123def456')).rejects.toThrow(/truncated/);
    expect(calls).toHaveLength(EXPECTED_DEDUP_PROBE_PAGE);

    // The next encounter fails the same way, from the latch — no new requests.
    await expect(transport.searchByCanonical('canonical:abc123def456')).rejects.toThrow(
      /truncated/,
    );
    expect(calls).toHaveLength(EXPECTED_DEDUP_PROBE_PAGE);
  });

  // The enumeration is a snapshot from before the first create, and
  // prepareEncounters does not dedupe by signature — so one batch can carry two
  // findings with the same signature. Without this, the second consults the
  // pre-create snapshot, misses, and files the duplicate this module prevents.
  it('#1453: a lookup matches an issue created earlier in the same run', async () => {
    mockFetch(url =>
      url.includes('state=all')
        ? { json: () => [] }
        : { json: () => ({ number: 7, title: 'just filed' }) },
    );
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    const marker = '<!-- safeword-retro-signature: retro:abc123def456 -->';

    // Nothing upstream yet: the first encounter legitimately files.
    await expect(transport.searchBySignature('retro:abc123def456')).resolves.toEqual([]);
    await transport.createIssue({ title: 'just filed', body: marker, labels: ['retro'] });

    // A second encounter with the SAME signature must now see it, not re-file.
    await expect(transport.searchBySignature('retro:abc123def456')).resolves.toEqual([
      { number: 7, title: 'just filed' },
    ]);
  });

  it('#1453: retries the enumeration after a transient failure', async () => {
    let attempt = 0;
    mockFetch(() => {
      attempt += 1;
      return attempt === 1
        ? { ok: false, status: 502, json: () => ({}) }
        : {
            json: () => [
              {
                number: 7,
                title: 'found on retry',
                body: '<!-- safeword-retro-signature: retro:abc123def456 -->',
                state: 'open',
              },
            ],
          };
    });
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchBySignature('retro:abc123def456')).rejects.toThrow('502');
    // The poisoned promise was dropped, so the next encounter gets a real answer.
    await expect(transport.searchBySignature('retro:abc123def456')).resolves.toEqual([
      { number: 7, title: 'found on retry' },
    ]);
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
  // GitHub's published matcher requires at least 36 allowed characters after
  // `ghs_`; pin that exact boundary separately from the representative ~520-char
  // `ghs_APPID_JWT` rollout shape.
  const minimumStatelessToken = `ghs_${'a'.repeat(10)}_${'b'.repeat(10)}.${'c'.repeat(6)}.${'d'.repeat(7)}`;
  const representativeStatelessToken = `ghs_1234567_${'a'.repeat(160)}.${'b'.repeat(160)}.${'c'.repeat(186)}`;
  // RFC 6750 Bearer credentials are opaque to this resolver. This deliberately
  // has no GitHub prefix or minimum length, so a future token format does not
  // require a resolver release before it can reach GitHub for validation.
  const opaqueBearerToken = 'future-token~1';

  // Existing GitHub token fixtures remain regression controls; the resolver
  // must also accept an arbitrary value that satisfies the Bearer grammar.
  it.each([
    ['classic PAT (ghp_)', `ghp_${'a'.repeat(32)}`],
    ['OAuth (gho_)', `gho_${'b'.repeat(32)}`],
    ['app server-to-server (ghs_)', `ghs_${'c'.repeat(32)}`],
    ['minimum-length stateless app server-to-server (ghs_)', minimumStatelessToken],
    ['representative stateless app server-to-server (ghs_APPID_JWT)', representativeStatelessToken],
    ['fine-grained PAT (github_pat_)', `github_pat_${'d'.repeat(40)}`],
    ['legacy 40-char hex', '0123456789'.repeat(4)],
    ['single-character Bearer credential', 'a'],
    ['Bearer credential with every permitted punctuation character and padding', 'a-._~+/==='],
    ['arbitrary opaque Bearer credential', opaqueBearerToken],
    ['RFC-valid value that is not the exact documented placeholder', 'not-set'],
    ['case variant of the exact documented placeholder', 'PROXY-INJECTED'],
  ])('accepts a %s from GITHUB_TOKEN without consulting gh', (_label, shaped) => {
    let ghConsulted = false;
    const token = resolveGitHubToken({ GITHUB_TOKEN: shaped }, () => {
      ghConsulted = true;
      return ghToken;
    });
    expect(token).toBe(shaped);
    expect(ghConsulted).toBe(false);
  });

  it('passes a selected stateless GITHUB_TOKEN to the REST transport', async () => {
    const calls = mockFetchCapturing(() => ({ json: () => ({ id: 99, body: 'hi' }) }));
    const token = resolveGitHubToken({ GITHUB_TOKEN: representativeStatelessToken }, () => {
      throw new Error('gh fallback must not be consulted');
    });
    const transport = createRestTransport(token);
    if (!transport) throw new Error('expected a transport');

    await transport.createComment(42, 'hi');

    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${representativeStatelessToken}`,
    );
  });

  it.each([
    ['a proxy placeholder', 'proxy-injected'],
    ['an empty string', ''],
    ['a value containing a space', 'opaque token'],
    ['a value containing a tab', 'opaque\ttoken'],
    ['a value containing a newline', 'opaque\ntoken'],
    ['a value ending in a newline', 'opaque-token\n'],
    ['a value ending in a carriage return', 'opaque-token\r'],
    ['a value containing a NUL control character', 'opaque\0token'],
    ['a value with equals outside the optional suffix', 'opaque=token'],
  ])('rejects %s and falls back to gh', (_label, bogus) => {
    const token = resolveGitHubToken({ GITHUB_TOKEN: bogus }, () => ghToken);
    expect(token).toBe(ghToken);
  });

  it('#1602: removes a rejected GITHUB_TOKEN before asking gh for its credential', () => {
    vi.stubEnv('GITHUB_TOKEN', 'proxy-injected');
    vi.stubEnv('GH_TOKEN', 'explicit-gh-token');
    spawnSyncMock.mockReturnValue({ status: 0, stdout: 'gh-keyring-token\n' });

    expect(resolveGitHubToken()).toBe('gh-keyring-token');
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'gh',
      ['auth', 'token'],
      expect.objectContaining({ encoding: 'utf8', timeout: 10_000 }),
    );
    const spawnCall = spawnSyncMock.mock.calls[0] as [string, string[], { env: NodeJS.ProcessEnv }];
    if (!spawnCall) throw new Error('expected gh auth token to be called');
    const options = spawnCall[2];
    expect(options.env).toMatchObject({ GH_TOKEN: 'explicit-gh-token' });
    expect(options.env).not.toHaveProperty('GITHUB_TOKEN');
  });

  it('starts without a gh response configured by an earlier test', () => {
    vi.stubEnv('GITHUB_TOKEN', 'proxy-injected');

    expect(resolveGitHubToken()).toBeUndefined();
  });

  it('does not build a REST transport from malformed gh output', () => {
    vi.stubEnv('GITHUB_TOKEN', 'proxy-injected');
    spawnSyncMock.mockReturnValue({ status: 0, stdout: 'unsafe token\n' });

    const token = resolveGitHubToken();

    expect(token).toBeUndefined();
    expect(createRestTransport(token)).toBeUndefined();
  });

  it('uses process context when a lookup-only environment falls back to gh', () => {
    vi.stubEnv('SW_TEST_GH_CONTEXT', 'available');
    spawnSyncMock.mockReturnValue({ status: 0, stdout: 'gh-keyring-token\n' });

    expect(resolveGitHubToken({ GITHUB_TOKEN: 'proxy-injected' })).toBe('gh-keyring-token');

    const spawnCall = spawnSyncMock.mock.calls[0] as [string, string[], { env: NodeJS.ProcessEnv }];
    if (!spawnCall) throw new Error('expected gh auth token to be called');
    expect(spawnCall[2].env).toMatchObject({ SW_TEST_GH_CONTEXT: 'available' });
    expect(spawnCall[2].env).not.toHaveProperty('GITHUB_TOKEN');
  });

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
