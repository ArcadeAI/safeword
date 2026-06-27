/**
 * Live TrackerClient adapters — the I/O boundary (JS5K5G). The GitHub adapter
 * shells out to `gh` (no new dependency; the ticket sanctions `gh` for stable
 * create/update). The Linear live client needs the Arcade integration, whose
 * auth/setup is owned by the connect-flow ticket (2TK5AD); until that lands it
 * surfaces an actionable error rather than failing obscurely. Both providers'
 * *writer logic* ships and is unit-tested (writers.test.ts) over this port — only
 * the live adapter is the untested-by-unit shim, by design ("no live tracker in
 * tests").
 */

import { execFileSync } from 'node:child_process';

import { isRateLimit, RateLimitError } from './backoff.js';
import { reconcileOwnedLabels } from './labels.js';
import type { Provider } from './types.js';
import {
  type CreateRequest,
  createWriter,
  type GraphRequest,
  type TrackerClient,
  type TrackerWriter,
  type UpdateRequest,
} from './writers.js';

/**
 * Run `gh` with an argument array (never a shell — no injection path). On a
 * rate-limit failure rethrow as RateLimitError so withBackoff retries; other
 * failures (e.g. a label that doesn't pre-exist in the repo — `gh` rejects the
 * whole create) propagate so the operator sees the real `gh` message. The token
 * is read by `gh` from the environment, never passed as an argument.
 */
function runGh(arguments_: string[]): string {
  try {
    return execFileSync('gh', arguments_, { encoding: 'utf8' });
  } catch (error) {
    const stderr = (error as { stderr?: Buffer | string }).stderr?.toString() ?? '';
    const message = `${stderr}${(error as Error).message ?? ''}`;
    if (isRateLimit(message)) throw new RateLimitError(message);
    throw error;
  }
}

function commandErrorMessage(error: unknown): string {
  const stderr = (error as { stderr?: Buffer | string }).stderr?.toString() ?? '';
  return `${stderr}${(error as Error).message ?? ''}`;
}

function isUnsupportedIssueTypeError(error: unknown): boolean {
  const message = commandErrorMessage(error);
  return /type/i.test(message) && /not found|does not exist|invalid|unsupported/i.test(message);
}

/** Adapter over `gh` for GitHub Issues. `repo` targets `owner/name`. */
function githubClient(repo: string | undefined): TrackerClient {
  const repoArguments = repo === undefined ? [] : ['--repo', repo];
  const graphEditArguments = (
    request: GraphRequest,
    options: { includeType: boolean },
  ): string[] => [
    'issue',
    'edit',
    request.id,
    ...(options.includeType ? ['--type', request.issueType] : []),
    ...(request.parentId === undefined ? [] : ['--parent', request.parentId]),
    ...request.blockedByIds.flatMap(id => ['--add-blocked-by', id]),
    ...repoArguments,
  ];
  return {
    createIssue(request: CreateRequest) {
      const labels = request.labels.flatMap(label => ['--label', label]);
      const url = runGh([
        'issue',
        'create',
        '--title',
        request.title,
        '--body',
        request.body,
        ...labels,
        ...repoArguments,
      ]).trim();
      // `gh issue create` has no --json; it prints the issue URL. The trailing
      // path segment is the number — the idempotency key — so validate it.
      const id = url.split('/').pop()?.trim() ?? '';
      if (!/^\d+$/.test(id)) {
        throw new Error(`Could not parse a GitHub issue number from gh output: "${url}"`);
      }
      return Promise.resolve({ id, url });
    },
    updateIssue(request: UpdateRequest) {
      // Reconcile owned labels so a changed epic:/type: replaces the stale one
      // (--add-label only adds). Read current labels, diff, add + remove.
      const current = runGh([
        'issue',
        'view',
        request.id,
        '--json',
        'labels',
        '--jq',
        '.labels[].name',
        ...repoArguments,
      ])
        .split('\n')
        .map(name => name.trim())
        .filter(Boolean);
      const { add, remove } = reconcileOwnedLabels(current, request.labels);
      const labelArguments = [
        ...add.flatMap(label => ['--add-label', label]),
        ...remove.flatMap(label => ['--remove-label', label]),
      ];
      runGh([
        'issue',
        'edit',
        request.id,
        '--title',
        request.title,
        ...labelArguments,
        ...repoArguments,
      ]);
      // edit + close are two gh calls (no atomic "edit and close"); a failure
      // between them leaves a partial update, but updates are idempotent and the
      // ref is already recorded, so a re-run reconciles with no double-create.
      if (request.state === 'closed') {
        runGh(['issue', 'close', request.id, ...repoArguments]);
      }
      return Promise.resolve();
    },
    projectGraph(request: GraphRequest) {
      try {
        runGh(graphEditArguments(request, { includeType: true }));
      } catch (error) {
        if (!isUnsupportedIssueTypeError(error)) throw error;
        runGh(graphEditArguments(request, { includeType: false }));
      }
      return Promise.resolve();
    },
  };
}

/**
 * Resolve a GitHub repo's visibility for the AC10 egress guard. Returns
 * `undefined` when it can't be determined (e.g. `gh` missing) — the caller
 * treats anything other than a confirmed `private` as warn-worthy (fail-safe:
 * a spurious egress warning beats a silent leak to a public repo).
 */
export function resolveRepoVisibility(repo: string | undefined): 'public' | 'private' | undefined {
  if (repo === undefined) return undefined;
  try {
    const visibility = execFileSync(
      'gh',
      ['repo', 'view', repo, '--json', 'visibility', '--jq', '.visibility'],
      { encoding: 'utf8' },
    )
      .trim()
      .toLowerCase();
    return visibility === 'public' ? 'public' : 'private';
  } catch {
    return undefined;
  }
}

/** A client whose every call throws `message` — for not-yet-wired / unused providers. */
function throwingClient(message: string): TrackerClient {
  const fail = (): never => {
    throw new Error(message);
  };
  return { createIssue: fail, updateIssue: fail, projectGraph: fail };
}

/** The Linear live client is pending the Arcade integration (2TK5AD). */
function linearNotWired(): TrackerClient {
  return throwingClient(
    'Linear projection needs the Arcade integration — run `safeword setup` to wire it (tracked by 2TK5AD).',
  );
}

/** A placeholder client for the non-selected provider — never invoked. */
function unconfigured(provider: Provider): TrackerClient {
  return throwingClient(`${provider} is not the configured provider`);
}

/**
 * Build the writer registry for the configured provider. Only the selected
 * provider gets a live client; the other is an unconfigured placeholder the
 * orchestrator never calls (it dispatches solely on the configured provider).
 */
export function buildWriterRegistry(
  provider: Provider,
  target: { repo?: string } | undefined,
): Record<Provider, TrackerWriter> {
  const liveClient = provider === 'github' ? githubClient(target?.repo) : linearNotWired();
  const other: Provider = provider === 'github' ? 'linear' : 'github';
  return {
    [provider]: createWriter(provider, liveClient),
    [other]: createWriter(other, unconfigured(other)),
  } as Record<Provider, TrackerWriter>;
}
