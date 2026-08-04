import { describe, expect, it } from 'vitest';

import { createGitHubIssueClient } from '../../src/upstream-monitor/index.js';

interface RecordedCall {
  url: string;
  init: RequestInit | undefined;
}

const TITLE = '[upstream-changelog] Codex CLI changed';

function jsonResponse(body: unknown): Response {
  return Response.json(body, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function clientOver(pages: unknown[][], log?: (message: string) => void) {
  const calls: RecordedCall[] = [];
  const fetchStub = ((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const page = Number(new URL(url).searchParams.get('page') ?? '1');
    return Promise.resolve(jsonResponse(pages[page - 1] ?? []));
  }) as unknown as typeof fetch;

  return {
    calls,
    client: createGitHubIssueClient({
      fetch: fetchStub,
      owner: 'ArcadeAI',
      repo: 'safeword',
      token: 't',
      log,
    }),
  };
}

/** A full page, so the lookup keeps paginating. */
function fullPageOf(title: string): unknown[] {
  return Array.from({ length: 100 }, (_unused, index) => ({ number: index + 1, title }));
}

describe('GitHub issue client', () => {
  it('finds an existing open issue without relying on the search index', async () => {
    const { calls, client } = clientOver([[{ number: 7, title: TITLE }]]);

    expect(await client.findOpenIssueByTitle(TITLE)).toBe(7);
    // Search is eventually consistent — a re-run right after a scheduled run
    // would miss the issue it just created and file a duplicate.
    expect(calls[0]?.url).not.toContain('/search/');
    expect(calls[0]?.url).toContain('/repos/ArcadeAI/safeword/issues');
    expect(calls[0]?.url).toContain('state=open');
  });

  it('ignores pull requests, which the issues endpoint returns too', async () => {
    const { client } = clientOver([
      [
        { number: 41, title: TITLE, pull_request: { url: 'https://example.test/pr/41' } },
        { number: 42, title: TITLE },
      ],
    ]);

    expect(await client.findOpenIssueByTitle(TITLE)).toBe(42);
  });

  it('stops paginating on a short page', async () => {
    const { calls, client } = clientOver([[{ number: 1, title: 'something else' }]]);

    expect(await client.findOpenIssueByTitle(TITLE)).toBeUndefined();
    expect(calls).toHaveLength(1);
  });

  it('reports hitting the page cap rather than silently reporting "not found"', async () => {
    const log: string[] = [];
    // Every page full and non-matching, so the scan exhausts its budget.
    const { calls, client } = clientOver(
      Array.from({ length: 12 }, () => fullPageOf('unrelated')),
      message => {
        log.push(message);
      },
    );

    expect(await client.findOpenIssueByTitle(TITLE)).toBeUndefined();
    expect(calls).toHaveLength(10);
    // Silence here reads as "no existing issue" and files a duplicate weekly.
    expect(log.join('\n')).toContain('a duplicate may be filed');
  });

  it('bounds every request with a timeout signal', async () => {
    const { calls, client } = clientOver([[]]);
    await client.findOpenIssueByTitle(TITLE);

    // A hung connection would otherwise stall until the workflow's own
    // timeout, turning one bad request into a whole missed run.
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
  });
});
