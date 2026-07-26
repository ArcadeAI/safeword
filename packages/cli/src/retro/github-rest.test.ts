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

  // #1453 — dedup must not route through GitHub's search index. The marker lives
  // in an HTML comment, and an unindexed marker returns the same empty array as a
  // genuinely absent one, so triage cannot tell "no duplicate" from "could not
  // tell". These tests pin the listing endpoint as the source of truth.
  it('C2: enumerates open issues via the listing endpoint, never the search index', async () => {
    const calls = mockFetch(() => ({ json: () => [] }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await transport.searchBySignature('retro:abc123def456');

    const [url = ''] = calls;
    expect(url).not.toContain('/search/');
    expect(url).toBe(
      'https://api.github.com/repos/ArcadeAI/safeword/issues' +
        '?state=open&sort=created&direction=asc&per_page=100&page=1',
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
        },
        {
          number: 2,
          title: 'exact',
          body: '<!-- safeword-retro-signature: retro:abc123def456 -->',
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
        { number: 1, title: 'near miss', body: 'contains canonical:abc123def456-suffix' },
        {
          number: 2,
          title: 'exact',
          body: '<!-- safeword-retro-canonical: canonical:abc123def456 -->',
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
          pull_request: {},
        },
        {
          number: 2,
          title: 'canonical issue',
          body: '<!-- safeword-retro-canonical: canonical:abc123def456 -->',
        },
      ],
    }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchByCanonical('canonical:abc123def456')).resolves.toEqual([
      { number: 2, title: 'canonical issue' },
    ]);
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
              },
            ],
    }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchBySignature('retro:abc123def456')).resolves.toEqual([
      { number: 999, title: 'on page two' },
    ]);
    // A HIT costs one sweep and no confirmation — a page-boundary skip can hide
    // an issue, never fabricate one, so a positive match needs no second look.
    expect(calls).toHaveLength(2);

    // A second lookup reuses the enumeration — triage runs two per encounter.
    // This one MISSES, so it pays for the one-time stability confirmation.
    await transport.searchByCanonical('canonical:abc123def456');
    expect(calls).toHaveLength(4);
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
    }));
    const calls = mockFetch(() => ({ json: () => fullPage }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchBySignature('retro:abc123def456')).rejects.toThrow(/truncated/);
    // 30 bound pages + the probe page, which was also full → a genuine tail.
    expect(calls).toHaveLength(31);
  });

  // The boundary the bound alone cannot distinguish: at exactly 30 full pages the
  // enumeration is COMPLETE, and throwing there would halt every session's filing
  // over a tail that does not exist.
  it('#1453: completes rather than throwing at exactly the page bound', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      number: i,
      title: `t${i}`,
      body: 'no marker',
    }));
    const calls = mockFetch(url => ({
      json: () => (url.endsWith('page=31') ? [] : fullPage),
    }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchBySignature('retro:abc123def456')).resolves.toEqual([]);
    // 31 for the sweep, then 31 again to confirm the miss is real (nothing
    // vanished mid-sweep). Both sweeps see the same set, so the miss stands.
    expect(calls).toHaveLength(62);
  });

  // The cap has to mean what it says. Appending the probe page instead of
  // rejecting on it would silently accept 3,001–3,099 items under a "3,000" bound.
  it('#1453: trips the cap at 3001 items rather than quietly accepting the probe', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      number: i,
      title: `t${i}`,
      body: 'no marker',
    }));
    const calls = mockFetch(url => ({
      // Exactly one item past the bound — the smallest genuine tail there is.
      json: () =>
        url.endsWith('page=31') ? [{ number: 3001, title: 'tail', body: 'x' }] : fullPage,
    }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchBySignature('retro:abc123def456')).rejects.toThrow(/truncated/);
    expect(calls).toHaveLength(31);
  });

  // Ascending order stops an INSERT from shifting already-read pages, but a close
  // shifts every later item back one, so an item can cross a page boundary unseen.
  // If it carried the marker, the sweep says "no duplicate" and files one.
  it('#1453: refuses to trust a miss when an issue vanishes mid-enumeration', async () => {
    const firstSweep = Array.from({ length: 100 }, (_, i) => ({
      number: i,
      title: `t${i}`,
      body: 'no marker',
    }));
    let sweep = 0;
    mockFetch(url => {
      if (!url.endsWith('page=1')) return { json: () => [] };
      sweep += 1;
      // Second sweep is missing issue #0 — it closed in between, so the first
      // sweep's page boundaries cannot be trusted.
      const page = sweep === 1 ? firstSweep : firstSweep.slice(1);
      return { json: () => page };
    });
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchBySignature('retro:abc123def456')).rejects.toThrow(
      /shifted between sweeps/,
    );
  });

  // The shape a real skip actually takes, and the one a subset check misses
  // entirely: an issue closing mid-sweep shifts a still-open issue across a page
  // boundary, so the FIRST sweep is short and the settled second sweep is a strict
  // SUPERSET. The skipped issue surfaces late, below the high-water mark.
  it('#1453: refuses to trust a miss when an issue surfaces only in the second sweep', async () => {
    const settled = Array.from({ length: 60 }, (_, i) => ({
      number: i + 1,
      title: `t${i + 1}`,
      body: 'no marker',
    }));
    // First sweep misses #30 — it shifted across a boundary when an earlier issue
    // closed. Nothing vanished, so the old subset check saw this as clean.
    const skipped = settled.filter(issue => issue.number !== 30);
    let sweep = 0;
    mockFetch(url => {
      if (!url.endsWith('page=1')) return { json: () => [] };
      sweep += 1;
      const page = sweep === 1 ? skipped : settled;
      return { json: () => page };
    });
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchBySignature('retro:abc123def456')).rejects.toThrow(
      /shifted between sweeps/,
    );
  });

  // The benign twin of the case above: ascending order appends genuinely new
  // issues to the LAST page, so they cannot displace anything already read. Their
  // numbers sit above the first sweep's high-water mark, and treating them as
  // instability would fail closed on every session that files while a human is
  // opening issues.
  it('#1453: tolerates a genuinely new issue appearing between sweeps', async () => {
    const settled = Array.from({ length: 60 }, (_, i) => ({
      number: i + 1,
      title: `t${i + 1}`,
      body: 'no marker',
    }));
    const withNewcomer = [...settled, { number: 5000, title: 'brand new', body: 'no marker' }];
    let sweep = 0;
    mockFetch(url => {
      if (!url.endsWith('page=1')) return { json: () => [] };
      sweep += 1;
      const page = sweep === 1 ? settled : withNewcomer;
      return { json: () => page };
    });
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchBySignature('retro:abc123def456')).resolves.toEqual([]);
  });

  // Truncation is deterministic: re-running it burns another 31 requests to reach
  // the same answer. Only transient failures earn a retry.
  it('#1453: does not re-run a terminal truncation for every later encounter', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      number: i,
      title: `t${i}`,
      body: 'no marker',
    }));
    const calls = mockFetch(() => ({ json: () => fullPage }));
    const transport = createRestTransport('tok');
    if (!transport) throw new Error('expected a transport');

    await expect(transport.searchBySignature('retro:abc123def456')).rejects.toThrow(/truncated/);
    expect(calls).toHaveLength(31);

    // The next encounter fails the same way, from the latch — no new requests.
    await expect(transport.searchByCanonical('canonical:abc123def456')).rejects.toThrow(
      /truncated/,
    );
    expect(calls).toHaveLength(31);
  });

  // The enumeration is a snapshot from before the first create, and
  // prepareEncounters does not dedupe by signature — so one batch can carry two
  // findings with the same signature. Without this, the second consults the
  // pre-create snapshot, misses, and files the duplicate this module prevents.
  it('#1453: a lookup matches an issue created earlier in the same run', async () => {
    mockFetch(url =>
      url.includes('state=open')
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

  // #634 — every accepted GitHub token shape must survive resolution, or a
  // regex that quietly stopped matching one form (e.g. fine-grained PATs) would
  // break a working auth path with no test to catch it.
  it.each([
    ['classic PAT (ghp_)', `ghp_${'a'.repeat(32)}`],
    ['OAuth (gho_)', `gho_${'b'.repeat(32)}`],
    ['app server-to-server (ghs_)', `ghs_${'c'.repeat(32)}`],
    ['fine-grained PAT (github_pat_)', `github_pat_${'d'.repeat(40)}`],
    ['legacy 40-char hex', '0123456789'.repeat(4)],
  ])('accepts a %s from GITHUB_TOKEN without consulting gh', (_label, shaped) => {
    let ghConsulted = false;
    const token = resolveGitHubToken({ GITHUB_TOKEN: shaped }, () => {
      ghConsulted = true;
      return ghToken;
    });
    expect(token).toBe(shaped);
    expect(ghConsulted).toBe(false);
  });

  it.each([
    ['a proxy placeholder', 'proxy-injected'],
    ['an unknown prefix', `gha_${'a'.repeat(32)}`],
    ['an empty string', ''],
  ])('rejects %s and falls back to gh', (_label, bogus) => {
    const token = resolveGitHubToken({ GITHUB_TOKEN: bogus }, () => ghToken);
    expect(token).toBe(ghToken);
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
