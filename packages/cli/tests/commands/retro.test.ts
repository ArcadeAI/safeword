import { describe, expect, it } from 'vitest';

import { runRetro } from '../../src/commands/retro.js';
import type {
  CreateIssueInput,
  IssueComment,
  IssueReference,
  IssueTracker,
} from '../../src/retro/triage.js';
import { DIGEST_CAP, runHeadlessExtraction } from '../../templates/hooks/lib/retro-extract.js';

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

  // invisible-retro-claude.NTB1.AC1 — the --auto-extract path (headless extractor)
  // feeds findings through the SAME egress guard end-to-end: a secret + customer
  // path are scrubbed, and a finding whose surface does not resolve is dropped.
  it('invisible-retro-claude.NTB1.AC1.auto_extracted_findings_pass_the_egress_guard', async () => {
    const envelope = (text: string) =>
      JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: text });
    const extracted = JSON.stringify([
      {
        category: 'rough-edge',
        title: 'Gate omits the file',
        safeword_surface: 'hooks/stop-quality.ts',
        what_happened: 'blocked editing /Users/jdoe/app/secret.ts with key sk_live_TESTONLY1',
        why_friction: 'could not unblock',
        repro: 'safeword check',
      },
      // unresolved surface → must be dropped, not filed
      {
        category: 'bug',
        title: 'Customer-surface finding',
        safeword_surface: 'src/billing.ts',
        what_happened: 'x',
        why_friction: 'y',
        repro: 'z',
      },
    ]);

    const autoExtractor = (transcript: string) =>
      runHeadlessExtraction(transcript, {
        spawn: () => Promise.resolve({ code: 0, stdout: envelope(extracted) }),
        writeDigest: () => '/tmp/neutral/digest.txt',
        env: {},
        cwd: '/tmp/neutral',
        model: 'haiku',
      });

    const transport = new FakeGitHub();
    await runRetro(
      { transcript: '/tmp/t.jsonl' },
      dependencies({ transport, extract: autoExtractor }),
    );

    // The unresolved-surface finding was dropped; only the safeword one filed.
    expect(transport.issues).toHaveLength(1);
    const filed = JSON.stringify(transport.issues);
    expect(filed).not.toContain('/Users/jdoe/app/secret.ts');
    expect(filed).not.toContain('sk_live_TESTONLY1');
    expect(filed).not.toContain('src/billing.ts');
    expect(filed).toContain('[redacted]');
  });

  // ZFGWS1 — a friction only in the BACK HALF (beyond the digest head cap) is
  // filed by a delta fire that windows from the prior offset, and a head-capped
  // fire over the same transcript files nothing. Drives the real runRetro →
  // windowFor → runHeadlessExtraction → buildDigest → triage path; the spawn is
  // gated on whether the (windowed) digest actually contains the back-half marker.
  it('retro-recall.SM1.AC1.back_half_finding_beyond_the_head_cap_is_filed', async () => {
    const headText = 'x'.repeat(DIGEST_CAP + 1000); // alone exceeds the digest cap
    const headEntry = JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: headText }] },
    });
    const backEntry = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'BACKHALF friction in hooks/stop-quality.ts' }],
      },
    });
    const transcript = `${headEntry}\n${backEntry}`;
    const windowStart = headEntry.length + 1; // first char of the back-half line

    const envelope = (text: string) =>
      JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: text });
    const findingJSON = JSON.stringify([
      {
        category: 'rough-edge',
        title: 'Back-half friction',
        safeword_surface: 'hooks/stop-quality.ts',
        what_happened: 'surfaced only late in the session',
        why_friction: 'a fire-once retro head-caps and never reads it',
        repro: 'safeword check late in a long session',
      },
    ]);

    // The spawn "sees" the back-half finding only when the digest it was built from
    // actually contains the marker — i.e. only when the window read the back half.
    let digest = '';
    const autoExtractor = (window: string) =>
      runHeadlessExtraction(window, {
        writeDigest: (d: string) => {
          digest = d;
          return '/tmp/neutral/digest.txt';
        },
        spawn: () =>
          Promise.resolve({
            code: 0,
            stdout: envelope(digest.includes('BACKHALF') ? findingJSON : '[]'),
          }),
        env: {},
        cwd: '/tmp/neutral',
        model: 'sonnet',
      });

    // Head fire (windowStart 0): the digest head-caps → no BACKHALF → files nothing.
    const headTransport = new FakeGitHub();
    await runRetro(
      { transcript: '/t.jsonl', windowStart: 0 },
      dependencies({
        transport: headTransport,
        extract: autoExtractor,
        readFile: () => transcript,
      }),
    );
    expect(headTransport.issues).toHaveLength(0);

    // Delta fire (windowStart at the back half): the window digest carries BACKHALF
    // → the finding is filed, which the head-capped fire above would have missed.
    const deltaTransport = new FakeGitHub();
    await runRetro(
      { transcript: '/t.jsonl', windowStart },
      dependencies({
        transport: deltaTransport,
        extract: autoExtractor,
        readFile: () => transcript,
      }),
    );
    expect(deltaTransport.issues).toHaveLength(1);
    expect(deltaTransport.issues[0]?.body).toContain('hooks/stop-quality.ts');
  });
});
