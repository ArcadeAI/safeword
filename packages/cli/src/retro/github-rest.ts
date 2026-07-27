// Real IssueTracker over the REST API — the network boundary for retro's
// code-owned egress. Targets the upstream safeword repo, gated on GITHUB_TOKEN.
// Intentionally thin and untested-by-unit (it IS the boundary the wiring tests
// mock); all dedup/cap/ledger/sanitize logic lives in tested modules.

import { spawnSync } from 'node:child_process';
import process from 'node:process';

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
// GitHub's max page size. The paginated loops interpolate this into the URL
// AND compare against it to detect the last (short) page — one constant keeps
// the two from drifting (a mismatch silently truncates or over-fetches).
const PER_PAGE = 100;
// Safety bound on comment pagination (100/page → up to 2000 comments scanned).
const MAX_COMMENT_PAGES = 20;
// Safety bound on issue-listing pagination for the reconcile sweep (→ 1000 issues).
const MAX_ISSUE_PAGES = 10;
// Safety bound on the dedup enumeration (→ 3000 repository *items*: the stable
// all-state listing includes closed issues and PRs, which are filtered after the
// fetch, so both consume this budget). Deliberately looser than
// MAX_ISSUE_PAGES: hitting this bound THROWS rather than truncating (see
// listOpenIssues), so it halts filing entirely — it needs real headroom above
// the repo's total issue/PR count, not just enough for one sweep.
const MAX_DEDUP_PAGES = 30;

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
 * Stateless `ghs_` tokens use GitHub's published `{36,}` matcher:
 * https://github.blog/changelog/2026-05-15-github-app-installation-tokens-per-request-override-header/
 */
function looksLikeGitHubToken(value: string): boolean {
  return (
    /^ghs_[\w.-]{36,}$/.test(value) ||
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
 * Build a REST-backed transport, or undefined when no token is available. The
 * token is REQUIRED (no `process.env` default) so every caller routes through
 * `resolveGitHubToken` — a default here would silently bypass the `gh` fallback.
 */
export function createRestTransport(token: string | undefined): IssueTracker | undefined {
  if (!token) return undefined;

  const call = buildCall(token);

  /**
   * Every open issue body, fetched once per transport (#1453, #1481).
   *
   * Dedup used to ask `/search/issues` for the signature's hash token and filter
   * the hits. That made the search INDEX the arbiter of "already filed", and the
   * marker lives in an HTML comment — whether the index tokenizes comment text is
   * undocumented and could not be verified. The fatal part is not the uncertainty
   * but the shape of a wrong answer: an unindexed marker and a genuinely absent
   * one both return an empty array, so triage cannot tell "no duplicate" from
   * "could not tell" and confidently files a duplicate. Index lag had the same
   * signature, which is why this read as flaky for so long.
   *
   * The listing endpoint returns raw bodies verbatim, so the marker check becomes
   * a local string compare — exact and index-independent. The pagination universe
   * is `state=all`: closing or reopening an issue changes its state but not its
   * membership or creation-order position, so it cannot shift a later open marker
   * across a page boundary. Closed issues are filtered locally and remain
   * ineligible matches. No label filter: this keeps the old query's recall, so a
   * marker hand-copied into an unlabeled issue (as happens when issues are merged)
   * still dedups. Deletion or transfer can still remove an item from this
   * repository-wide universe; those administrative mutations remain outside the
   * close/reopen race addressed here.
   *
   * Cached because triage runs up to two lookups per encounter; a 12-finding
   * session would otherwise re-list 24 times.
   */
  let openIssues: Promise<OpenIssue[]> | undefined;
  /**
   * A failure the enumeration cannot recover from by trying again — the bound was
   * exceeded. Unlike a transient 5xx, this is deterministic, so re-running costs
   * a full 31-request sweep to reach the same answer. Latched for the transport's
   * life and rethrown to every later encounter (each still lands as its own
   * isolated `failed` in triage).
   */
  let terminalFailure: Error | undefined;

  function latchTerminal(message: string): Error {
    terminalFailure = new Error(message);
    return terminalFailure;
  }

  /**
   * One page from the all-state issue/PR universe. `rawLength` is the page size
   * BEFORE closed issues and pull requests are filtered out — a full page with no
   * eligible issue still means "there is more", so the last-page test has to read
   * the raw count, not the kept count.
   */
  async function fetchIssuePage(page: number): Promise<{ issues: OpenIssue[]; rawLength: number }> {
    const data = (await call(
      'GET',
      // Ascending by creation appends new items to the last page. `state=all`
      // keeps close/reopen transitions in the same ordered universe, while the
      // local filter below preserves the existing open-only match policy.
      `${ISSUES_BASE}?state=all&sort=created&direction=asc&per_page=${PER_PAGE}&page=${page}`,
    )) as {
      number: number;
      title: string;
      body?: string;
      state: 'open' | 'closed';
      pull_request?: unknown;
    }[];
    const issues = data
      // Falsy, not `=== undefined`: this module's asymmetry is that a missed
      // match files a duplicate, so a `pull_request: null` must not drop a
      // real issue out of the dedup view.
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
    // The bound was reached with a full final page. Probe one page PAST it, but
    // never accept the probe's contents: at exactly MAX_DEDUP_PAGES * PER_PAGE the
    // probe is empty and the enumeration is genuinely complete, while anything at
    // all on it means a real tail. Appending the probe instead would quietly raise
    // the advertised cap to 3099 — the cap has to mean what it says.
    const probe = await fetchIssuePage(MAX_DEDUP_PAGES + 1);
    if (probe.rawLength > 0) {
      // A real unread tail, so "no match" would be a guess about it. Throw: triage
      // isolates this as a failed encounter and leaves the draft spooled, which is
      // recoverable. Silently returning [] would file the duplicate this replaces.
      throw latchTerminal(
        `retro dedup: repository items exceed ${MAX_DEDUP_PAGES * PER_PAGE}; enumeration truncated`,
      );
    }
    return issues;
  }

  // Drop the cached promise on failure, or one transient 5xx would sink every
  // later encounter in the session instead of just its own. The reset lands after
  // the await, by which point the assignment below has already completed. A
  // latched terminal failure short-circuits before this ever re-runs.
  async function loadOpenIssues(): Promise<OpenIssue[]> {
    try {
      return await listOpenIssues();
    } catch (error) {
      // A wrong or missing credential fails identically every time, so retrying
      // it once per finding just burns a full sweep each. Latch it; only
      // genuinely transient statuses earn the retry.
      if (isTerminalStatus(error)) {
        terminalFailure = error as Error;
      }
      openIssues = undefined;
      throw error;
    }
  }

  async function currentSnapshot(): Promise<OpenIssue[]> {
    if (terminalFailure) throw terminalFailure;
    openIssues ??= loadOpenIssues();
    return await openIssues;
  }

  /**
   * Issues this transport filed during the current run.
   *
   * The enumeration above is a snapshot taken before the first create, and
   * triage files inside the same transport instance. `prepareEncounters` does
   * NOT dedupe by signature (pipeline.ts), so one batch can carry two findings
   * that hash to the same signature — and without this, the second would consult
   * the pre-create snapshot, miss, and file the finding a second time. That is
   * the exact duplicate this module exists to prevent. (The old search-based
   * path had the same hole for a different reason: the index cannot return an
   * issue created seconds earlier.)
   */
  const createdThisRun: { number: number; title: string; body: string }[] = [];

  function matchesIn(issues: readonly OpenIssue[], marker: string): IssueReference[] {
    return [...issues, ...createdThisRun]
      .filter(issue => issue.body.includes(marker))
      .map(issue => ({ number: issue.number, title: issue.title }));
  }

  async function findByExactMarker(marker: string): Promise<IssueReference[]> {
    return matchesIn(await currentSnapshot(), marker);
  }

  return {
    async searchBySignature(signature: string): Promise<IssueReference[]> {
      // Match the FULL marker, not the bare hash: the body is ours and the marker
      // is exact, so a near-miss hash sharing a prefix must never count as filed.
      return findByExactMarker(signatureMarker(signature));
    },

    async searchByCanonical(canonicalSignature: string): Promise<IssueReference[]> {
      return findByExactMarker(canonicalMarker(canonicalSignature));
    },

    async createIssue(input: CreateIssueInput): Promise<IssueReference> {
      const data = (await call('POST', ISSUES_BASE, input)) as {
        number: number;
        title: string;
      };
      const reference = { number: data.number, title: data.title };
      // Fold the new issue into the dedup view before returning, so a later
      // encounter in this run matches it instead of filing it again.
      createdThisRun.push({ ...reference, body: input.body });
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
