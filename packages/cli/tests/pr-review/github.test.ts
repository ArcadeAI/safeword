import { describe, expect, it } from 'vitest';

import {
  createGitHubRequest,
  fetchCheckRuns,
  fetchPullFacts,
  fetchRulesetRequiredChecks,
  findReviewedSha,
} from '../../src/pr-review/github.js';
import { type GitHubRequest, RECEIPT_CHECK_NAME } from '../../src/pr-review/poster.js';

const CONTEXT = { owner: 'acme', repo: 'monorepo', pull: 42 };

/** A request seam that answers from a path→payload table and records calls. */
function stubRequest(routes: Record<string, unknown>) {
  const paths: string[] = [];
  const request: GitHubRequest = (_method, path) => {
    paths.push(path);
    const key = Object.keys(routes).find(route => path.startsWith(route));
    return Promise.resolve(key === undefined ? {} : routes[key]);
  };
  return { paths, request };
}

describe('createGitHubRequest — the network boundary (36EEMY slice 3)', () => {
  it('sends the token and the pinned API version, and parses the body', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const request = createGitHubRequest('ghs_token', ((url: string, init: RequestInit) => {
      seen = { url, init };
      return Promise.resolve(
        Response.json(
          { ok: true },
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );
    }) as unknown as typeof fetch);

    const body = await request('GET', '/repos/acme/monorepo/pulls/42');

    expect(seen?.url).toBe('https://api.github.com/repos/acme/monorepo/pulls/42');
    expect((seen?.init.headers as Record<string, string>).authorization).toBe('Bearer ghs_token');
    expect((seen?.init.headers as Record<string, string>)['x-github-api-version']).toBe(
      '2022-11-28',
    );
    expect(body).toEqual({ ok: true });
  });

  it('throws loudly on a non-2xx instead of returning an empty result', async () => {
    // A swallowed 403 would surface as "the reviewer found nothing", which is
    // indistinguishable from a clean pull request. It has to be a red job.
    const request = createGitHubRequest('t', () =>
      Promise.resolve(new Response('forbidden', { status: 403, statusText: 'Forbidden' })),
    );

    await expect(request('GET', '/repos/acme/monorepo/pulls/42')).rejects.toThrow(/403/);
  });
});

describe('reading the facts the trigger decides on', () => {
  it('reads draft state, head SHA and base ref from the pull request', async () => {
    const { request } = stubRequest({
      '/repos/acme/monorepo/pulls/42': {
        draft: true,
        head: { sha: 'abc123', repo: { full_name: 'acme/monorepo' } },
        base: { ref: 'main' },
      },
    });

    await expect(fetchPullFacts(request, CONTEXT)).resolves.toEqual({
      isDraft: true,
      headSha: 'abc123',
      baseRef: 'main',
      isFork: false,
    });
  });

  it('reads fork-ness from the head repo, since it decides whether code may RUN', async () => {
    // The one fact SM1.R3 turns on. Derived from head-repo identity rather than
    // GitHub's `fork` flag: that flag is true for any repo which is itself a
    // fork, even when the branch lives here — what matters is whether the head
    // is ours.
    const { request } = stubRequest({
      '/repos/acme/monorepo/pulls/42': {
        draft: false,
        head: { sha: 'abc123', repo: { full_name: 'contributor/monorepo' } },
        base: { ref: 'main' },
      },
    });

    await expect(fetchPullFacts(request, CONTEXT)).resolves.toMatchObject({ isFork: true });
  });

  it('treats an UNIDENTIFIABLE head repo as foreign, not as ours', async () => {
    // An absent head.repo (a deleted fork) means provenance could not be
    // established. This is a security decision, not an availability one: the
    // only safe reading of "we don't know whose code this is" is "not ours".
    // Skipping a run gate costs one finding; executing unidentified code is the
    // pwn-request the two-stage split exists to prevent.
    const { request } = stubRequest({
      '/repos/acme/monorepo/pulls/42': { draft: false, head: { sha: 'abc' }, base: { ref: 'main' } },
    });

    await expect(fetchPullFacts(request, CONTEXT)).resolves.toMatchObject({ isFork: true });
  });

  it('maps a still-running check to an absent conclusion, not a failure', async () => {
    // Parsed from the literal wire format rather than written as an object
    // literal: GitHub really sends `"conclusion": null` for a running check, and
    // mapping that to undefined is the behavior under test — substituting
    // undefined in the fixture would assert nothing.
    const wire = JSON.parse(
      '{"check_runs":[{"name":"build","conclusion":"success"},{"name":"test","conclusion":null}]}',
    ) as unknown;
    const { request } = stubRequest({ '/repos/acme/monorepo/commits/abc123/check-runs': wire });

    const checks = await fetchCheckRuns(request, CONTEXT, 'abc123');

    // `null` from the API must become `undefined`, which the pure layer reads
    // as pending. Treating it as a failure would make the reviewer skip every
    // PR whose CI is merely still running.
    expect(checks).toEqual([
      { name: 'build', conclusion: 'success' },
      { name: 'test', conclusion: undefined },
    ]);
  });

  it('extracts required checks from rulesets, ignoring unrelated rule types', async () => {
    const { request } = stubRequest({
      '/repos/acme/monorepo/rules/branches/main': [
        { type: 'pull_request' },
        {
          type: 'required_status_checks',
          parameters: { required_status_checks: [{ context: 'build' }, { context: 'test' }] },
        },
      ],
    });

    await expect(fetchRulesetRequiredChecks(request, CONTEXT, 'main')).resolves.toEqual([
      'build',
      'test',
    ]);
  });

  it('returns no required checks when the repo uses classic branch protection', async () => {
    // The rules endpoint legitimately returns an empty list; the caller then
    // falls through to configured checks rather than treating this as green.
    const { request } = stubRequest({ '/repos/acme/monorepo/rules/branches/main': [] });
    await expect(fetchRulesetRequiredChecks(request, CONTEXT, 'main')).resolves.toEqual([]);
  });
});

describe('finding the previously reviewed SHA', () => {
  it('returns the head SHA when the receipt is already on it — fires once', async () => {
    const { paths, request } = stubRequest({});
    const reviewed = await findReviewedSha(request, CONTEXT, 'head', [
      { name: RECEIPT_CHECK_NAME, conclusion: 'neutral' },
    ]);

    expect(reviewed).toBe('head');
    // Costs nothing: the receipt was already in hand, so no commit walk.
    expect(paths).toHaveLength(0);
  });

  it('walks back through earlier commits to find the last review', async () => {
    const { request } = stubRequest({
      '/repos/acme/monorepo/pulls/42/commits': [{ sha: 'old' }, { sha: 'mid' }, { sha: 'head' }],
      '/repos/acme/monorepo/commits/mid/check-runs': {
        check_runs: [{ name: RECEIPT_CHECK_NAME, conclusion: 'neutral' }],
      },
      '/repos/acme/monorepo/commits/old/check-runs': { check_runs: [] },
    });

    await expect(findReviewedSha(request, CONTEXT, 'head', [])).resolves.toBe('mid');
  });

  it('reports no prior review when none is within the lookback', async () => {
    const { request } = stubRequest({
      '/repos/acme/monorepo/pulls/42/commits': [{ sha: 'a' }, { sha: 'head' }],
      '/repos/acme/monorepo/commits/a/check-runs': { check_runs: [] },
    });

    // Undefined makes the next run a FIRST review rather than a re-review, so
    // the failure direction is a duplicate comment, never silence.
    await expect(findReviewedSha(request, CONTEXT, 'head', [])).resolves.toBeUndefined();
  });
});
