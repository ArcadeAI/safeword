// Real IssueTracker over the REST API — the network boundary for retro's
// code-owned egress. Targets the upstream safeword repo, gated on GITHUB_TOKEN.
// Intentionally thin and untested-by-unit (it IS the boundary the wiring tests
// mock); all dedup/cap/ledger/sanitize logic lives in tested modules.

import process from 'node:process';

import { isBearerCredentialSyntax, resolveGhCliToken } from '../utils/gh-cli.js';
import { canonicalMarker, signatureMarker } from './draft.js';
import type { ReconcileIssue, ReconcileTracker } from './reconcile.js';
import type { CreateIssueInput, IssueComment, IssueReference, IssueTracker } from './triage.js';

/** An open issue as the dedup enumeration keeps it — raw body included. */
interface OpenIssue {
  number: number;
  title: string;
  body: string;
}

const UPSTREAM_REPO = 'ArcadeAI/safeword';
const ISSUES_BASE = `/repos/${UPSTREAM_REPO}/issues`;
const API = 'https://api.github.com';
const GITHUB_TOKEN_ENV_KEY = 'GITHUB_TOKEN';
// GitHub's max page size. The paginated loops interpolate this into the URL
// AND compare against it to detect the last (short) page — one constant keeps
// the two from drifting (a mismatch silently truncates or over-fetches).
const PER_PAGE = 100;
// Safety bound on comment pagination (100/page → up to 2000 comments scanned).
const MAX_COMMENT_PAGES = 20;
// Safety bound on issue-listing pagination for the reconcile sweep (→ 1000 issues).
const MAX_ISSUE_PAGES = 10;
// Safety bound on the dedup enumeration (→ 20,000 repository *items*: the stable
// all-state listing includes closed issues and PRs, which are filtered after the
// fetch, so both consume this budget). Deliberately looser than
// MAX_ISSUE_PAGES: hitting this bound THROWS rather than truncating (see
// listOpenIssues), so it halts filing entirely — it needs real headroom above
// the repo's total issue/PR count, not just enough for one sweep.
//
// Measured 2026-07-27: 1,550 items (16 pages), with 1,020 created in the prior
// 30 days and 311 in the prior 7. A 200-page guard leaves 18,450 items — about
// 415 days at the faster trailing-7-day rate — without adding a request to the
// normal 16-page sweep. That is a flat-rate capacity horizon, not a forecast:
// recent rolling-window volume increased sharply. Issue #1552 makes an
// observable revisit threshold its first independent deliverable.
const MAX_DEDUP_PAGES = 200;

/**
 * `gh`'s own resolved token (keychain or its `GH_TOKEN`), used as the fallback
 * once `resolveGitHubToken` below has rejected `GITHUB_TOKEN`. `GH_TOKEN` is an
 * independent documented gh credential source with higher precedence, and the
 * exact `proxy-injected` sentinel is rejected only from `GITHUB_TOKEN`: #1637
 * keeps syntax-valid explicit `GH_TOKEN` values opaque and lets GitHub
 * authorize them.
 */
function ghAuthToken(): string | undefined {
  return resolveGhCliToken(process.env);
}

/**
 * Resolve the GitHub token for retro's code-owned write, dropping the hard
 * `GITHUB_TOKEN` requirement (7D8PJP): prefer the env var, else fall back to the
 * environment's existing GitHub access via `gh auth token`. Returns undefined when
 * neither is available, so the caller can no-op gracefully instead of failing.
 *
 * The env var is honored when it has Bearer syntax, except for the exact
 * documented `proxy-injected` cloud placeholder. Treat that value as absent and
 * fall through to `gh`; every other opaque syntax-valid value reaches GitHub,
 * where an invalid or unauthorized credential gets its terminal 401 response
 * instead of being guessed at locally.
 */
export function resolveGitHubToken(
  env: Record<string, string | undefined> = process.env,
  getGhToken: () => string | undefined = ghAuthToken,
): string | undefined {
  const fromEnvironment = env[GITHUB_TOKEN_ENV_KEY];
  if (
    fromEnvironment &&
    fromEnvironment !== 'proxy-injected' &&
    isBearerCredentialSyntax(fromEnvironment)
  ) {
    return fromEnvironment;
  }
  return getGhToken();
}

/** The one place auth + API headers are wired to fetch; both transports compose this. */
function buildCall(token: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'safeword-retro',
  };
  return async function call(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      // Carry the status on the error. The dedup enumeration retries a failed
      // sweep on the next encounter, and without the status it cannot tell a
      // 502 worth retrying from a 401 that will fail identically every time —
      // so a bad token would burn a full sweep per finding (#1465 review).
      throw new HttpError(`GitHub ${method} ${path} → ${response.status}`, response.status);
    }
    return response.json();
  };
}

/** A failed GitHub response, with the status kept for retry classification. */
class HttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * Statuses that will not change on retry within a run: the credential is wrong
 * or absent (401/403), the resource is gone (404), or the request itself is
 * invalid (422). Rate limiting also arrives as 403, but a retry-per-encounter
 * makes that strictly worse, so it belongs on this side of the line too.
 *
 * Deliberately NOT here: 5xx and 429, which are transient by definition.
 * Honoring `Retry-After` with real backoff is a separate concern that predates
 * this module's retry behavior — this only stops the amplification.
 */
function isTerminalStatus(error: unknown): boolean {
  return error instanceof HttpError && [401, 403, 404, 422].includes(error.status);
}

/**
 * Cached, exact-marker view over every open issue body (#1453, #1481).
 *
 * The listing endpoint returns raw bodies, so marker matching stays local and
 * independent of search-index tokenization or lag. `state=all` keeps pagination
 * stable across close/reopen transitions; closed issues and pull requests are
 * filtered locally. New issues created through this transport are folded into
 * the snapshot immediately so duplicate findings in one run cannot double-file.
 */
function createOpenIssueSnapshot(call: ReturnType<typeof buildCall>): {
  findByExactMarker(marker: string): Promise<IssueReference[]>;
  recordCreated(issue: OpenIssue): void;
} {
  let openIssues: Promise<OpenIssue[]> | undefined;
  let terminalFailure: Error | undefined;
  // `prepareEncounters` (pipeline.ts) does not dedupe by signature, so one batch
  // can carry two findings that hash the same; without this, the second would
  // consult the pre-create snapshot, miss, and file the finding a second time.
  const createdThisRun: OpenIssue[] = [];

  function latchTerminal(message: string): Error {
    terminalFailure = new Error(message);
    return terminalFailure;
  }

  /**
   * `rawLength` is measured before filtering: a full page containing only
   * closed issues or pull requests still means another page may exist.
   */
  async function fetchIssuePage(page: number): Promise<{ issues: OpenIssue[]; rawLength: number }> {
    const data = (await call(
      'GET',
      `${ISSUES_BASE}?state=all&sort=created&direction=asc&per_page=${PER_PAGE}&page=${page}`,
    )) as {
      number: number;
      title: string;
      body?: string;
      state: 'open' | 'closed';
      pull_request?: unknown;
    }[];
    const issues = data
      .filter(issue => !issue.pull_request && issue.state === 'open')
      .map(issue => ({ number: issue.number, title: issue.title, body: issue.body ?? '' }));
    return { issues, rawLength: data.length };
  }

  async function listOpenIssues(): Promise<OpenIssue[]> {
    const issues: OpenIssue[] = [];
    for (let page = 1; page <= MAX_DEDUP_PAGES; page++) {
      const { issues: pageIssues, rawLength } = await fetchIssuePage(page);
      issues.push(...pageIssues);
      if (rawLength < PER_PAGE) return issues;
    }
    // Probe one page beyond the bound to distinguish an exact-boundary corpus
    // from a real unread tail; never accept the probe's contents.
    const probe = await fetchIssuePage(MAX_DEDUP_PAGES + 1);
    if (probe.rawLength > 0) {
      throw latchTerminal(
        `retro dedup: repository items exceed ${MAX_DEDUP_PAGES * PER_PAGE}; enumeration truncated`,
      );
    }
    return issues;
  }

  async function loadOpenIssues(): Promise<OpenIssue[]> {
    try {
      return await listOpenIssues();
    } catch (error) {
      // Authentication/resource/request failures cannot recover during this
      // transport's lifetime; transient failures clear the promise and retry
      // on the next encounter.
      if (isTerminalStatus(error)) terminalFailure = error as Error;
      openIssues = undefined;
      throw error;
    }
  }

  async function currentSnapshot(): Promise<OpenIssue[]> {
    if (terminalFailure) throw terminalFailure;
    openIssues ??= loadOpenIssues();
    return await openIssues;
  }

  return {
    async findByExactMarker(marker: string): Promise<IssueReference[]> {
      return [...(await currentSnapshot()), ...createdThisRun]
        .filter(issue => issue.body.includes(marker))
        .map(issue => ({ number: issue.number, title: issue.title }));
    },
    recordCreated(issue: OpenIssue): void {
      createdThisRun.push(issue);
    },
  };
}

/**
 * Build a REST-backed transport, or undefined when no token is available. The
 * token is REQUIRED (no `process.env` default) so every caller routes through
 * `resolveGitHubToken` — a default here would silently bypass the `gh` fallback.
 */
export function createRestTransport(token: string | undefined): IssueTracker | undefined {
  if (!token) return undefined;

  const call = buildCall(token);
  const snapshot = createOpenIssueSnapshot(call);

  return {
    async searchBySignature(signature: string): Promise<IssueReference[]> {
      // Match the FULL marker, not the bare hash: the body is ours and the marker
      // is exact, so a near-miss hash sharing a prefix must never count as filed.
      return snapshot.findByExactMarker(signatureMarker(signature));
    },

    async searchByCanonical(canonicalSignature: string): Promise<IssueReference[]> {
      return snapshot.findByExactMarker(canonicalMarker(canonicalSignature));
    },

    async createIssue(input: CreateIssueInput): Promise<IssueReference> {
      const data = (await call('POST', ISSUES_BASE, input)) as {
        number: number;
        title: string;
      };
      const reference = { number: data.number, title: data.title };
      // Fold the new issue into the dedup view before returning, so a later
      // encounter in this run matches it instead of filing it again.
      snapshot.recordCreated({ ...reference, body: input.body });
      return reference;
    },

    async listComments(issueNumber: number): Promise<IssueComment[]> {
      // Paginate fully: the retro ledger comment must be found even on a hot
      // issue with >100 comments, else triage posts a duplicate ledger and
      // re-counts every manifestation as novel (idempotency break).
      const comments: IssueComment[] = [];
      for (let page = 1; page <= MAX_COMMENT_PAGES; page++) {
        const data = (await call(
          'GET',
          `${ISSUES_BASE}/${issueNumber}/comments?per_page=${PER_PAGE}&page=${page}`,
        )) as { id: number; body?: string }[];
        comments.push(...data.map(comment => ({ id: comment.id, body: comment.body ?? '' })));
        if (data.length < PER_PAGE) break;
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

  const call = buildCall(token);

  /** Committer date of a commit SHA (committer, not author — squash-merge time). */
  async function commitDate(sha: string): Promise<string | undefined> {
    const data = (await call('GET', `/repos/${UPSTREAM_REPO}/commits/${sha}`)) as {
      commit?: { committer?: { date?: string } };
    };
    return data.commit?.committer?.date;
  }

  return {
    async listIssues(query: { state: string; labels: string[] }): Promise<ReconcileIssue[]> {
      // Paginate with a bound (mirrors listComments): created-desc default order
      // would otherwise starve the oldest issues past 100. PRs share this
      // endpoint (distinguished by `pull_request`) and are not sweep targets.
      const labels = encodeURIComponent(query.labels.join(','));
      const issues: ReconcileIssue[] = [];
      for (let page = 1; page <= MAX_ISSUE_PAGES; page++) {
        const data = (await call(
          'GET',
          `${ISSUES_BASE}?state=${encodeURIComponent(query.state)}&labels=${labels}&per_page=${PER_PAGE}&page=${page}`,
        )) as {
          number: number;
          title: string;
          body?: string;
          labels?: { name?: string }[];
          pull_request?: unknown;
        }[];
        issues.push(
          ...data
            .filter(issue => issue.pull_request === undefined)
            .map(issue => ({
              number: issue.number,
              title: issue.title,
              body: issue.body ?? '',
              labels: (issue.labels ?? []).map(label => label.name ?? ''),
            })),
        );
        if (data.length < PER_PAGE) break;
      }
      return issues;
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
        const tagReference = `tags/${tag}`;
        const ref = (await call(
          'GET',
          `/repos/${UPSTREAM_REPO}/git/ref/${encodeURIComponent(tagReference)}`,
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
