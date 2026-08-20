import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  detectSourceChange,
  getMonitorSource,
  type GitHubIssueClient,
  type IssuePayload,
  type MonitorSourceKey,
  readText,
  runUpstreamMonitor,
  snapshotBody,
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
const PLUGIN_RELOAD_TRIPWIRES = [
  {
    key: 'codex-plugin-hook-reload' as const,
    issueNumber: 17_636,
    titleFragment: 'Hot-reload hook configuration',
  },
  {
    key: 'codex-removed-plugin-hooks' as const,
    issueNumber: 38_339,
    titleFragment: 'Removed plugin Stop hook',
  },
];

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

/**
 * Every source, not just the tripwire. A snapshot committed at the wrong path,
 * or under the wrong source's header, leaves the unit tests green while that
 * source either fires every week or never fires at all — and the scheduled run
 * is the only place it would surface.
 */
const SOURCE_KEYS: readonly MonitorSourceKey[] = [
  'claude-code',
  'codex-cli',
  'codex-project-plugins',
  'codex-plugin-hook-reload',
  'codex-removed-plugin-hooks',
  'cursor',
];

describe('committed snapshots', () => {
  it.each(SOURCE_KEYS)('%s reads back from its declared path', async key => {
    const watched = getMonitorSource(key);
    // Throws if the declared snapshotPath does not resolve.
    const snapshotContent = await readText(nodePath.join(repoRoot, watched.snapshotPath));

    // The header must identify this source: a copy-pasted snapshot would
    // otherwise compare one upstream's content against another's baseline.
    expect(snapshotContent).toContain(`source_key: ${key}`);
    expect(snapshotContent).toContain(`source: ${watched.url}`);

    // The body has to survive the parser the monitor actually uses. If it does
    // not, every run diffs against an empty baseline and reports drift forever.
    const body = snapshotBody(snapshotContent);
    expect(body.length).toBeGreaterThan(0);
    const unchanged = detectSourceChange({ source: watched, liveContent: body, snapshotContent });
    expect(unchanged.changed).toBe(false);
  });
});

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

    expect(result).toEqual({ reported: 1, failed: 1, immediateTriage: 0 });
    expect(filed).toHaveLength(1);
    expect(filed[0]?.title).toContain('openai/codex#18115');
    // A failed source must not read as "no change" — an unchecked source is
    // missing evidence, not a clean bill of health.
    expect(log).toContain('claude-code: check FAILED — upstream unreachable');
    expect(log.join('\n')).not.toContain('claude-code: no change');
  });
});

describe('Codex plugin-reload issue tripwires', () => {
  it.each(PLUGIN_RELOAD_TRIPWIRES)(
    '$key stays quiet while open and makes a closure immediately visible',
    async ({ key, issueNumber, titleFragment }) => {
      const watched = getMonitorSource(key);
      const open = `{"number":${issueNumber},"state":"open","state_reason":null}`;
      const closed = `{"number":${issueNumber},"state":"closed","state_reason":"completed"}`;
      const filed: IssuePayload[] = [];

      const stillOpen = await runUpstreamMonitor({
        fetchText: () => Promise.resolve(open),
        issueClient: recordingClient(filed),
        readText,
        rootDirectory: repoRoot,
        sources: [watched],
      });
      expect(stillOpen).toEqual({ reported: 0, failed: 0, immediateTriage: 0 });
      expect(filed).toEqual([]);

      const changed = await runUpstreamMonitor({
        fetchText: () => Promise.resolve(closed),
        issueClient: recordingClient(filed),
        readText,
        rootDirectory: repoRoot,
        sources: [watched],
      });
      expect(changed).toEqual({ reported: 1, failed: 0, immediateTriage: 1 });
      expect(filed).toHaveLength(1);
      expect(filed[0]?.title).toContain(titleFragment);
      expect(filed[0]?.labels).toEqual(['impact:high']);
      expect(filed[0]?.body).toContain('restart');
    },
  );
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
