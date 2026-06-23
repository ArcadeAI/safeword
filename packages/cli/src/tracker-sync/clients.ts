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

import type { Provider } from './types.js';
import {
  type CreateRequest,
  createWriter,
  type TrackerClient,
  type TrackerWriter,
  type UpdateRequest,
} from './writers.js';

/** Adapter over `gh` for GitHub Issues. `repo` targets `owner/name`. */
function githubClient(repo: string | undefined): TrackerClient {
  const repoArguments = repo === undefined ? [] : ['--repo', repo];
  return {
    createIssue(request: CreateRequest) {
      const labels = request.labels.flatMap(label => ['--label', label]);
      const url = execFileSync(
        'gh',
        [
          'issue',
          'create',
          '--title',
          request.title,
          '--body',
          request.body,
          ...labels,
          ...repoArguments,
        ],
        { encoding: 'utf8' },
      ).trim();
      const id = url.split('/').pop() ?? url;
      return Promise.resolve({ id, url });
    },
    updateIssue(request: UpdateRequest) {
      const labels = request.labels.flatMap(label => ['--add-label', label]);
      execFileSync(
        'gh',
        ['issue', 'edit', request.id, '--title', request.title, ...labels, ...repoArguments],
        { encoding: 'utf8' },
      );
      if (request.state === 'closed') {
        execFileSync('gh', ['issue', 'close', request.id, ...repoArguments], { encoding: 'utf8' });
      }
      return Promise.resolve();
    },
  };
}

/** A client whose every call throws `message` — for not-yet-wired / unused providers. */
function throwingClient(message: string): TrackerClient {
  const fail = (): never => {
    throw new Error(message);
  };
  return { createIssue: fail, updateIssue: fail };
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
