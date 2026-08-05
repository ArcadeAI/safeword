import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  getMonitorSource,
  type GitHubIssueClient,
  type IssuePayload,
  readText,
  runUpstreamMonitor,
} from '../../src/upstream-monitor/index.js';

/**
 * Wiring coverage for the watched-issue tripwire source (#1907).
 *
 * Real collaborators throughout — the real source definition, the real
 * `readText`, and the snapshot file actually committed to this repo. Only
 * `fetchText` is stubbed, because it is the process boundary (network).
 *
 * The unit tests around `normalizeIssueState` cannot catch the failure this
 * one exists for: a snapshot committed at the wrong path, or in a shape the
 * body parser does not read back, leaves every unit test green while the
 * monitor either files an issue every single week or never fires at all.
 */

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const source = getMonitorSource('codex-project-plugins');

const UPSTREAM_OPEN = '{"number":18115,"state":"open","state_reason":null}';
const UPSTREAM_CLOSED = '{"number":18115,"state":"closed","state_reason":"completed"}';

function recordingClient(filed: IssuePayload[]): GitHubIssueClient {
  return {
    findOpenIssueByTitle: () => Promise.resolve(undefined),
    createIssue: payload => {
      filed.push(payload);
      return Promise.resolve(1);
    },
    updateIssue: (_issueNumber, payload) => {
      filed.push(payload);
      return Promise.resolve();
    },
  };
}

async function runAgainstCommittedSnapshot(upstreamResponse: string): Promise<IssuePayload[]> {
  const filed: IssuePayload[] = [];
  await runUpstreamMonitor({
    fetchText: () => Promise.resolve(upstreamResponse),
    issueClient: recordingClient(filed),
    readText,
    rootDirectory: repoRoot,
    sources: [source],
  });
  return filed;
}

describe('source isolation', () => {
  it('still checks later sources when an earlier one fails, and reports the failure', async () => {
    const filed: IssuePayload[] = [];
    const log: string[] = [];
    const broken = { ...getMonitorSource('codex-cli'), key: 'claude-code' as const };

    const result = await runUpstreamMonitor({
      // The watched-issue source is checked third in the real list, behind two
      // network fetches. Before isolation, either one throwing meant the
      // tripwire silently never ran.
      fetchText: url =>
        url === broken.url
          ? Promise.reject(new Error('upstream unreachable'))
          : Promise.resolve(UPSTREAM_CLOSED),
      issueClient: recordingClient(filed),
      log: message => {
        log.push(message);
      },
      readText,
      rootDirectory: repoRoot,
      sources: [broken, source],
    });

    expect(result).toEqual({ reported: 1, failed: 1 });
    expect(filed).toHaveLength(1);
    expect(filed[0]?.title).toContain('openai/codex#18115');
    // A failed source must not read as "no change" — an unchecked source is
    // missing evidence, not a clean bill of health.
    expect(log).toContain('claude-code: check FAILED — upstream unreachable');
    expect(log.join('\n')).not.toContain('claude-code: no change');
  });
});

describe('watched-issue tripwire wiring (openai/codex#18115)', () => {
  it('stays silent while the upstream issue is still open', async () => {
    // Reads the committed snapshot off disk. Fails if it is missing,
    // misplaced, or written in a shape the snapshot parser cannot read back.
    expect(await runAgainstCommittedSnapshot(UPSTREAM_OPEN)).toEqual([]);
  });

  it('files an actionable issue once the upstream issue closes', async () => {
    const filed = await runAgainstCommittedSnapshot(UPSTREAM_CLOSED);

    expect(filed).toHaveLength(1);
    const [issue] = filed;
    expect(issue?.title).toContain('openai/codex#18115');
    // The body has to carry the decision, not just announce a diff.
    expect(issue?.body).toContain('project-scoped plugin activation');
    expect(issue?.body).toContain('codex-project-scope-tripwire.test.ts');
    expect(issue?.body).toContain('-state: open');
    expect(issue?.body).toContain('+state: closed');
  });
});
