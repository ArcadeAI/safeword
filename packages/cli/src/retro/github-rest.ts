// Real IssueTracker over the REST API — the network boundary for retro's
// code-owned egress. Targets the upstream safeword repo, gated on GITHUB_TOKEN.
// Intentionally thin and untested-by-unit (it IS the boundary the wiring tests
// mock); all dedup/cap/ledger/sanitize logic lives in tested modules.

import process from 'node:process';

import type { CreateIssueInput, IssueComment, IssueReference, IssueTracker } from './triage.js';

const UPSTREAM_REPO = 'ArcadeAI/safeword';
const API = 'https://api.github.com';
// Safety bound on comment pagination (100/page → up to 2000 comments scanned).
const MAX_COMMENT_PAGES = 20;

/** Build a REST-backed transport, or undefined when no GitHub token is available. */
export function createRestTransport(token = process.env.GITHUB_TOKEN): IssueTracker | undefined {
  if (!token) return undefined;

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'safeword-retro',
  };

  async function call(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`GitHub ${method} ${path} → ${response.status}`);
    }
    return response.json();
  }

  return {
    async searchByTitle(title: string): Promise<IssueReference[]> {
      // Strip characters GitHub's search grammar treats specially: a `"` would
      // close the phrase early and `:` can read as a qualifier — both degrade
      // recall and risk a dedup miss (→ duplicate issue). The exact-match filter
      // below uses the ORIGINAL title, so stripping here only widens the search.
      const searchable = title.replaceAll(/[":]/g, ' ');
      const query = encodeURIComponent(`repo:${UPSTREAM_REPO} in:title state:open ${searchable}`);
      const data = (await call('GET', `/search/issues?q=${query}&per_page=100`)) as {
        items?: { number: number; title: string }[];
      };
      return (data.items ?? [])
        .filter(item => item.title === title)
        .map(item => ({ number: item.number, title: item.title }));
    },

    async createIssue(input: CreateIssueInput): Promise<IssueReference> {
      const data = (await call('POST', `/repos/${UPSTREAM_REPO}/issues`, input)) as {
        number: number;
        title: string;
      };
      return { number: data.number, title: data.title };
    },

    async listComments(issueNumber: number): Promise<IssueComment[]> {
      // Paginate fully: the retro ledger comment must be found even on a hot
      // issue with >100 comments, else triage posts a duplicate ledger and
      // re-counts every manifestation as novel (idempotency break).
      const comments: IssueComment[] = [];
      for (let page = 1; page <= MAX_COMMENT_PAGES; page++) {
        const data = (await call(
          'GET',
          `/repos/${UPSTREAM_REPO}/issues/${issueNumber}/comments?per_page=100&page=${page}`,
        )) as { id: number; body?: string }[];
        comments.push(...data.map(comment => ({ id: comment.id, body: comment.body ?? '' })));
        if (data.length < 100) break;
      }
      return comments;
    },

    async createComment(issueNumber: number, body: string): Promise<IssueComment> {
      const data = (await call('POST', `/repos/${UPSTREAM_REPO}/issues/${issueNumber}/comments`, {
        body,
      })) as { id: number; body?: string };
      return { id: data.id, body: data.body ?? body };
    },

    async updateComment(commentId: number, body: string): Promise<void> {
      await call('PATCH', `/repos/${UPSTREAM_REPO}/issues/comments/${commentId}`, { body });
    },
  };
}
