import { describe, expect, it } from 'vitest';

import { runRetro } from '../../src/commands/retro.js';
import type {
  CreateIssueInput,
  IssueComment,
  IssueReference,
  IssueTracker,
} from '../../src/retro/triage.js';

// Compact in-memory transport — only the network boundary is faked.
class FakeGitHub implements IssueTracker {
  private nextIssue = 1;
  private nextComment = 1;
  readonly issues: (CreateIssueInput & { number: number })[] = [];
  readonly calls = { createIssue: 0 };

  searchByTitle(): Promise<IssueReference[]> {
    return Promise.resolve([]);
  }

  createIssue(input: CreateIssueInput): Promise<IssueReference> {
    this.calls.createIssue += 1;
    const issue = { number: this.nextIssue++, ...input };
    this.issues.push(issue);
    return Promise.resolve({ number: issue.number, title: issue.title });
  }

  listComments(): Promise<IssueComment[]> {
    return Promise.resolve([]);
  }

  createComment(_n: number, body: string): Promise<IssueComment> {
    return Promise.resolve({ id: this.nextComment++, body });
  }

  updateComment(): Promise<void> {
    return Promise.resolve();
  }
}

const rawFinding = (over: Record<string, unknown> = {}) => ({
  category: 'rough-edge',
  title: 'Coverage gate message omits file and number',
  safeword_surface: 'hooks/stop-quality.ts',
  what_happened: 'The coverage gate blocked with no file and no number.',
  why_friction: 'I could not tell the user how to unblock.',
  repro: 'safeword check after an edit that drops coverage',
  ...over,
});

const dependencies = (over: Partial<Parameters<typeof runRetro>[1]> = {}) => ({
  extract: () => Promise.resolve([rawFinding()]),
  transport: new FakeGitHub(),
  sessionId: 'sess-a',
  harness: 'claude',
  readFile: () => 'transcript content',
  ...over,
});

describe('runRetro', () => {
  it('retro-transcript-mining.TB1.AC2.planted_friction_signal_is_extracted', async () => {
    const transport = new FakeGitHub();
    const outcome = await runRetro(
      { transcript: '/tmp/t.jsonl' },
      dependencies({
        transport,
        extract: () => Promise.resolve([rawFinding({ category: 'rough-edge' })]),
      }),
    );
    expect(outcome.ok).toBe(true);
    expect(transport.issues).toHaveLength(1);
    expect(transport.issues[0]?.body).toContain('hooks/stop-quality.ts');
    expect(transport.issues[0]?.labels).toContain('rough-edge');
  });

  it('retro-transcript-mining.TB1.AC2.missing_flag_fails_loudly_and_files_nothing', async () => {
    const transport = new FakeGitHub();
    const outcome = await runRetro({}, dependencies({ transport }));
    expect(outcome.ok).toBe(false);
    expect(outcome.errorMessage).toMatch(/--transcript/);
    expect(transport.calls.createIssue).toBe(0);
  });

  it('retro-transcript-mining.TB1.AC2.unreadable_path_fails_loudly_and_files_nothing', async () => {
    const transport = new FakeGitHub();
    const outcome = await runRetro(
      { transcript: '/nope/missing.jsonl' },
      dependencies({
        transport,
        readFile: () => {
          throw new Error('ENOENT');
        },
      }),
    );
    expect(outcome.ok).toBe(false);
    expect(transport.calls.createIssue).toBe(0);
  });

  it('retro-transcript-mining.TB1.AC1.findings_are_filed_without_approval', async () => {
    const transport = new FakeGitHub();
    const outcome = await runRetro({ transcript: '/tmp/t.jsonl' }, dependencies({ transport }));
    expect(outcome.ok).toBe(true);
    expect(transport.calls.createIssue).toBe(1);
    expect(outcome.result?.created).toHaveLength(1);
  });

  it('retro-transcript-mining.NTB1.AC2.unresolvable_surface_is_dropped_not_filed', async () => {
    const transport = new FakeGitHub();
    await runRetro(
      { transcript: '/tmp/t.jsonl' },
      dependencies({
        transport,
        extract: () =>
          Promise.resolve([
            rawFinding({ safeword_surface: 'src/billing.ts', title: 'Customer bug' }),
            rawFinding({ title: 'Real safeword friction' }),
          ]),
      }),
    );
    expect(transport.issues).toHaveLength(1);
    expect(transport.issues[0]?.title).toBe('Real safeword friction');
  });

  it('retro-transcript-mining.NTB1.AC2.end_to_end_filed_payload_carries_no_customer_data', async () => {
    const transport = new FakeGitHub();
    await runRetro(
      { transcript: '/tmp/t.jsonl' },
      dependencies({
        transport,
        extract: () =>
          Promise.resolve([
            rawFinding({
              what_happened:
                'gate fired editing /Users/jdoe/app/billing.ts with key sk_live_TESTONLY1',
            }),
          ]),
      }),
    );
    const filed = JSON.stringify(transport.issues);
    expect(filed).not.toContain('/Users/jdoe/app/billing.ts');
    expect(filed).not.toContain('sk_live_TESTONLY1');
    expect(filed).toContain('[path]');
    expect(filed).toContain('[redacted]');
  });
});
