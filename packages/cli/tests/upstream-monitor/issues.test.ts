import { describe, expect, it } from 'vitest';

import {
  buildIssuePayload,
  type GitHubIssueClient,
  reportSourceChange,
} from '../../src/upstream-monitor/index.js';

describe('upstream monitor issue reporting', () => {
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
