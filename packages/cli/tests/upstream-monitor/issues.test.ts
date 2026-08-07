import { describe, expect, it } from 'vitest';

import {
  buildIssuePayload,
  type GitHubIssueClient,
  reportSourceChange,
} from '../../src/upstream-monitor/index.js';

describe('upstream monitor issue reporting', () => {
  it('keeps fenced upstream content inside its fence when the content has backticks', () => {
    // Upstream changelogs are third-party text and routinely contain fenced
    // code samples. The +/- prefix on every diff line is what keeps them from
    // closing the block early — a markdown fence only closes at line start.
    // Pinned here because a "cleaner" unprefixed diff would silently corrupt
    // every filed issue whose upstream content contains a fence.
    const payload = buildIssuePayload({
      source: {
        key: 'claude-code',
        label: 'Claude Code',
        url: 'https://example.test/CHANGELOG.md',
        snapshotPath: '.github/changelog-snapshots/claude-code.txt',
        platformEpic: '8R54HV',
        normalize: text => text,
      },
      previous: 'old',
      current: 'now documents ```bash\nnpm run x\n``` usage',
    });

    const fence = /^(?<fence>`+)diff$/m.exec(payload.body)?.groups?.fence;
    expect(fence).toBeDefined();
    const body = payload.body.slice(
      payload.body.indexOf(`${fence}diff\n`) + `${fence}diff\n`.length,
    );
    const closingIndex = body.indexOf(`\n${fence}`);
    // Everything the diff carries must sit before the closing fence.
    expect(body.slice(0, closingIndex)).toContain('npm run x');
  });

  it('builds an actionable bounded issue payload', () => {
    const payload = buildIssuePayload({
      source: {
        key: 'codex-cli',
        label: 'Codex CLI',
        url: 'https://github.com/openai/codex/releases.atom',
        snapshotPath: '.github/changelog-snapshots/codex-cli.txt',
        platformEpic: 'QM5G9M',
        normalize: text => text,
      },
      previous: 'v0.140.0\nold',
      current: 'v0.141.0\nnew',
    });

    expect(payload.title).toBe('[upstream-changelog] Codex CLI changed');
    expect(payload.body).toContain('https://github.com/openai/codex/releases.atom');
    expect(payload.body).toContain('.github/changelog-snapshots/codex-cli.txt');
    expect(payload.body).toContain('QM5G9M');
    expect(payload.body).toContain('-old');
    expect(payload.body).toContain('+new');
    expect(payload.body).toContain('Touches hooks lifecycle');
  });

  it('updates an existing issue instead of creating a duplicate', async () => {
    const calls: string[] = [];
    const client: GitHubIssueClient = {
      findOpenIssueByTitle(title) {
        calls.push(`find:${title}`);
        return Promise.resolve(42);
      },
      createIssue() {
        calls.push('create');
        return Promise.resolve(99);
      },
      updateIssue(number) {
        calls.push(`update:${number}`);
        return Promise.resolve();
      },
    };

    const result = await reportSourceChange(
      client,
      buildIssuePayload({
        source: {
          key: 'cursor',
          label: 'Cursor',
          url: 'https://cursor.com/changelog',
          snapshotPath: '.github/changelog-snapshots/cursor.txt',
          platformEpic: 'VAX3Z2',
          normalize: text => text,
        },
        previous: 'old',
        current: 'new',
      }),
    );

    expect(result).toEqual({ action: 'updated', issueNumber: 42 });
    expect(calls).toEqual(['find:[upstream-changelog] Cursor changed', 'update:42']);
  });
});
