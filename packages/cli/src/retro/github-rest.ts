// Real IssueTracker over the REST API — the network boundary for retro's
// code-owned egress. Targets the upstream safeword repo, gated on GITHUB_TOKEN.
// Intentionally thin and untested-by-unit (it IS the boundary the wiring tests
// mock); all dedup/cap/ledger/sanitize logic lives in tested modules.

import { spawnSync } from 'node:child_process';
import process from 'node:process';

import type { ReconcileIssue, ReconcileTracker } from './reconcile.js';
import type { CreateIssueInput, IssueComment, IssueReference, IssueTracker } from './triage.js';

const UPSTREAM_REPO = 'ArcadeAI/safeword';
const ISSUES_BASE = `/repos/${UPSTREAM_REPO}/issues`;
const API = 'https://api.github.com';
// Safety bound on comment pagination (100/page → up to 2000 comments scanned).
const MAX_COMMENT_PAGES = 20;

/** Ask the `gh` CLI for the environment's GitHub token, or undefined if unavailable. */
function ghAuthToken(): string | undefined {
  try {
    const result = spawnSync('gh', ['auth', 'token'], { encoding: 'utf8', timeout: 10_000 });
    const token = (result.stdout ?? '').trim();
    return result.status === 0 && token.length > 0 ? token : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A value shaped like a real GitHub token: a modern prefixed token
 * (`ghp_`/`gho_`/`ghu_`/`ghs_`/`ghr_`, or fine-grained `github_pat_`) or a
 * legacy 40-char hex PAT. Deliberately narrow so proxy-injected placeholders
 * such as `proxy-injected` are rejected before they reach the API (#634).
 */
function looksLikeGitHubToken(value: string): boolean {
  return (
    /^gh[opusr]_[A-Za-z0-9]{20,}$/.test(value) ||
    /^github_pat_\w{20,}$/.test(value) ||
    /^[0-9a-f]{40}$/.test(value)
  );
}

/**
 * Resolve the GitHub token for retro's code-owned write, dropping the hard
 * `GITHUB_TOKEN` requirement (7D8PJP): prefer the env var, else fall back to the
 * environment's existing GitHub access via `gh auth token`. Returns undefined when
 * neither is available, so the caller can no-op gracefully instead of failing.
 *
 * The env var is only honored when it is *shaped* like a GitHub token (#634):
 * some environments (e.g. Claude cloud containers) populate `GITHUB_TOKEN` with
 * a non-credential placeholder that would 401, muddying diagnosis — treat that
 * as absent and fall through to `gh` instead of passing it to the API.
 */
export function resolveGitHubToken(
  env: Record<string, string | undefined> = process.env,
  getGhToken: () => string | undefined = ghAuthToken,
): string | undefined {
  const fromEnvironment = env.GITHUB_TOKEN;
  if (fromEnvironment && looksLikeGitHubToken(fromEnvironment)) return fromEnvironment;
  return getGhToken();
}

/**
 * Build a REST-backed transport, or undefined when no token is available. The
 * token is REQUIRED (no `process.env` default) so every caller routes through
 * `resolveGitHubToken` — a default here would silently bypass the `gh` fallback.
 */
const refOf = (tag: string): string => `tags/${tag}`;

function buildCall(headers: Record<string, string>) {
  return async function call(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`GitHub ${method} ${path} → ${response.status}`);
    }
    return response.json();
  };
}

export function createRestTransport(token: string | undefined): IssueTracker | undefined {
  if (!token) return undefined;

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'safeword-retro',
  };

  const call = buildCall(headers);

  return {
    async searchBySignature(signature: string): Promise<IssueReference[]> {
      // Search the body for the signature's hash token (the `retro:` prefix carries
      // a `:` that GitHub's grammar reads as a qualifier, degrading recall), then
      // exact-filter on the FULL signature in the returned body — GitHub search is
      // fuzzy, so a hash near-miss must be rejected to avoid matching the wrong issue.
      const hashToken = signature.replace(/^retro:/, '');
      const query = encodeURIComponent(`repo:${UPSTREAM_REPO} in:body state:open ${hashToken}`);
      const data = (await call('GET', `/search/issues?q=${query}&per_page=100`)) as {
        items?: { number: number; title: string; body?: string }[];
      };
      return (data.items ?? [])
        .filter(item => (item.body ?? '').includes(signature))
        .map(item => ({ number: item.number, title: item.title }));
    },

    async createIssue(input: CreateIssueInput): Promise<IssueReference> {
      const data = (await call('POST', ISSUES_BASE, input)) as {
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
          `${ISSUES_BASE}/${issueNumber}/comments?per_page=100&page=${page}`,
        )) as { id: number; body?: string }[];
        comments.push(...data.map(comment => ({ id: comment.id, body: comment.body ?? '' })));
        if (data.length < 100) break;
      }
      return comments;
    },

    async createComment(issueNumber: number, body: string): Promise<IssueComment> {
      const data = (await call('POST', `${ISSUES_BASE}/${issueNumber}/comments`, {
        body,
      })) as { id: number; body?: string };
      return { id: data.id, body: data.body ?? body };
    },

    async updateComment(commentId: number, body: string): Promise<void> {
      await call('PATCH', `${ISSUES_BASE}/comments/${commentId}`, { body });
    },
  };
}

/**
 * REST-backed reconcile transport (G19QG7), or undefined without a token. Thin
 * and untested-by-unit like `createRestTransport` — the sweep's logic lives in
 * the tested `reconcile` module; this only maps the six seam methods to REST.
 */
export function createReconcileTransport(token: string | undefined): ReconcileTracker | undefined {
  const base = createRestTransport(token);
  if (!token || !base) return undefined;

  const call = buildCall({
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'safeword-retro',
  });

  /** Committer date of a commit SHA (committer, not author — squash-merge time). */
  async function commitDate(sha: string): Promise<string | undefined> {
    const data = (await call('GET', `/repos/${UPSTREAM_REPO}/commits/${sha}`)) as {
      commit?: { committer?: { date?: string } };
    };
    return data.commit?.committer?.date;
  }

  return {
    async listIssues(query: { state: string; labels: string[] }): Promise<ReconcileIssue[]> {
      const labels = encodeURIComponent(query.labels.join(','));
      const data = (await call(
        'GET',
        `${ISSUES_BASE}?state=${encodeURIComponent(query.state)}&labels=${labels}&per_page=100`,
      )) as { number: number; title: string; body?: string; labels?: { name?: string }[] }[];
      return data.map(issue => ({
        number: issue.number,
        title: issue.title,
        body: issue.body ?? '',
        labels: (issue.labels ?? []).map(label => label.name ?? ''),
      }));
    },

    listComments: issueNumber => base.listComments(issueNumber),
    createComment: (issueNumber, body) => base.createComment(issueNumber, body),

    async addLabels(issueNumber: number, labels: string[]): Promise<void> {
      await call('POST', `${ISSUES_BASE}/${issueNumber}/labels`, { labels });
    },

    async resolveTagDate(tag: string): Promise<string | undefined> {
      // Annotated tags point at a tag object (deref once); lightweight tags
      // point straight at the commit. Any failure → undefined (never guessed).
      try {
        const ref = (await call(
          'GET',
          `/repos/${UPSTREAM_REPO}/git/ref/${encodeURIComponent(refOf(tag))}`,
        )) as { object?: { type?: string; sha?: string } };
        const target = ref.object;
        if (!target?.sha) return undefined;
        if (target.type === 'commit') return await commitDate(target.sha);
        const tagObject = (await call('GET', `/repos/${UPSTREAM_REPO}/git/tags/${target.sha}`)) as {
          object?: { sha?: string };
        };
        return tagObject.object?.sha ? await commitDate(tagObject.object.sha) : undefined;
      } catch {
        return undefined;
      }
    },

    async surfaceTouchedSince(path: string, sinceIso: string): Promise<boolean> {
      const data = (await call(
        'GET',
        `/repos/${UPSTREAM_REPO}/commits?path=${encodeURIComponent(path)}&since=${encodeURIComponent(sinceIso)}&per_page=1`,
      )) as unknown[];
      return data.length > 0;
    },
  };
}
