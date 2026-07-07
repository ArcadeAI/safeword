import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildAutoExtractor, retroCommand, runRetro } from '../../src/commands/retro.js';
import type {
  CreateIssueInput,
  IssueComment,
  IssueReference,
  IssueTracker,
} from '../../src/retro/triage.js';
import {
  draftSpoolPath,
  readSpooledDrafts,
  verifyDraftBody,
} from '../../templates/hooks/lib/retro-draft-spool.js';
import { DIGEST_CAP, runHeadlessExtraction } from '../../templates/hooks/lib/retro-extract.js';

vi.mock('../../src/retro/github-rest.js', () => ({
  createRestTransport: () => {},
  resolveGitHubToken: () => {},
}));

// Compact in-memory transport — only the network boundary is faked.
class FakeGitHub implements IssueTracker {
  private nextIssue = 1;
  private nextComment = 1;
  readonly issues: (CreateIssueInput & { number: number })[] = [];
  readonly calls = { createIssue: 0 };

  searchBySignature(): Promise<IssueReference[]> {
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

  // ZFGWS1 NTB1.AC1 — the egress guard holds for EVERY delta window, not just the
  // first: windowing slices the INPUT transcript only; findings from a re-fire
  // (windowStart > 0) still flow through normalize → resolveSurface →
  // sanitizeTextDeep → buildDraft, never bypassing it.
  it('retro-recall.NTB1.AC1.a_secret_in_a_delta_window_finding_is_redacted', async () => {
    const transport = new FakeGitHub();
    await runRetro(
      { transcript: '/t.jsonl', windowStart: 5000 },
      dependencies({
        transport,
        extract: () =>
          Promise.resolve([
            rawFinding({
              what_happened: 'leaked sk_live_TESTONLY1 editing /Users/jdoe/app/x.ts',
            }),
          ]),
      }),
    );
    const filed = JSON.stringify(transport.issues);
    expect(filed).not.toContain('sk_live_TESTONLY1');
    expect(filed).not.toContain('/Users/jdoe/app/x.ts');
    expect(filed).toContain('[redacted]');
  });

  it('retro-recall.NTB1.AC1.a_delta_window_finding_with_an_unresolved_surface_is_dropped', async () => {
    const transport = new FakeGitHub();
    await runRetro(
      { transcript: '/t.jsonl', windowStart: 5000 },
      dependencies({
        transport,
        extract: () =>
          Promise.resolve([
            rawFinding({ safeword_surface: 'src/billing.ts', title: 'Customer bug' }),
          ]),
      }),
    );
    expect(transport.issues).toHaveLength(0);
  });
});

// BNGK9W — transport selection: spool the post-egress drafts, try REST, then drain
// only the drafts that reached the tracker (by signature). A REST auth failure (the
// cloud #568 case) leaves the drafts spooled and signals that the agent path is
// needed; a partial result drains only the filed drafts. The spool fs is real (a
// temp projectDirectory), the GitHub REST transport is the mock.
describe('runRetro transport selection (BNGK9W — spool → try-REST → drain filed)', () => {
  let projectDirectory: string;
  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-transport-'));
  });
  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  const twoFindings = [
    rawFinding({ title: 'Alpha friction', safeword_surface: 'hooks/a.ts' }),
    rawFinding({ title: 'Beta friction', safeword_surface: 'hooks/b.ts' }),
  ];

  // A transport whose createIssue rejects — simulates the cloud REST 401 per draft.
  class RejectingGitHub extends FakeGitHub {
    constructor(private readonly rejectTitle?: string) {
      super();
    }
    override createIssue(input: CreateIssueInput): Promise<IssueReference> {
      if (this.rejectTitle === undefined || input.title === this.rejectTitle) {
        return Promise.reject(new Error('401 Bad credentials'));
      }
      return super.createIssue(input);
    }
  }

  it('a valid token files all drafts and drains the spool — no agent filing needed', async () => {
    const transport = new FakeGitHub();
    const outcome = await runRetro(
      { transcript: '/t.jsonl' },
      dependencies({ transport, projectDirectory, extract: () => Promise.resolve(twoFindings) }),
    );
    expect(outcome.ok).toBe(true);
    expect(transport.calls.createIssue).toBe(2);
    expect(readSpooledDrafts(projectDirectory, 'sess-a')).toEqual([]); // fully drained
    expect(outcome.agentFilingNeeded).toBe(false);
  });

  it('a REST auth failure leaves every draft spooled and signals agent filing', async () => {
    const transport = new RejectingGitHub();
    const outcome = await runRetro(
      { transcript: '/t.jsonl' },
      dependencies({ transport, projectDirectory, extract: () => Promise.resolve(twoFindings) }),
    );
    expect(outcome.ok).toBe(true);
    expect(readSpooledDrafts(projectDirectory, 'sess-a')).toHaveLength(2); // nothing filed → retained
    expect(outcome.agentFilingNeeded).toBe(true);
  });

  it('a partial REST result drains only the filed draft, retaining the rejected one', async () => {
    const transport = new RejectingGitHub('Beta friction');
    const outcome = await runRetro(
      { transcript: '/t.jsonl' },
      dependencies({ transport, projectDirectory, extract: () => Promise.resolve(twoFindings) }),
    );
    const remaining = readSpooledDrafts(projectDirectory, 'sess-a');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.title).toBe('Beta friction');
    expect(outcome.agentFilingNeeded).toBe(true);
  });

  it('does not spool when no projectDirectory is provided (opt-in; existing callers unchanged)', async () => {
    const transport = new FakeGitHub();
    const outcome = await runRetro({ transcript: '/t.jsonl' }, dependencies({ transport }));
    expect(outcome.ok).toBe(true);
    expect(outcome.agentFilingNeeded).toBeFalsy();
  });

  // NTB1.AC1 — only post-egress fields reach the spool. A finding carrying a
  // distinctive secret + customer path flows through the REAL egress pipeline; the
  // draft is spooled (REST 401 keeps it on disk), and the spool FILE carries neither
  // the secret nor the path — the no-leak guarantee holds on disk, not just upstream.
  it('the spool file carries only sanitized post-egress drafts — no secret, no customer path', async () => {
    const transport = new RejectingGitHub(); // 401 → the draft stays spooled to inspect
    await runRetro(
      { transcript: '/t.jsonl' },
      dependencies({
        transport,
        projectDirectory,
        extract: () =>
          Promise.resolve([
            rawFinding({
              what_happened:
                'gate fired editing /acme-corp/prod/secrets.ts with key sk_live_TESTONLY1',
            }),
          ]),
      }),
    );
    const raw = readFileSync(draftSpoolPath(projectDirectory, 'sess-a'), 'utf8');
    expect(raw).not.toContain('sk_live_TESTONLY1'); // recognized secret shape → redacted
    expect(raw).not.toContain('/acme-corp/prod/secrets.ts'); // customer path → redacted
    expect(raw).toContain('[redacted]');
    // Only the code-assembled fields ever reach disk (bodyDigest is the JDK0F0 body seal).
    const lines = raw.split('\n').filter(line => line.trim());
    for (const line of lines) {
      expect(Object.keys(JSON.parse(line)).toSorted((a, b) => a.localeCompare(b))).toEqual([
        'body',
        'bodyDigest',
        'labels',
        'signature',
        'title',
      ]);
    }
    // Close the wiring chain in one place: the drafts read back from the REAL
    // pipeline's spool (real sanitizer, real disk) pass the spool-side verifier.
    const readBack = readSpooledDrafts(projectDirectory, 'sess-a');
    expect(readBack.length).toBeGreaterThan(0);
    expect(readBack.every(draft => verifyDraftBody(draft))).toBe(true);
  });

  it('retroCommand still spools sanitized drafts when no GitHub transport is available', async () => {
    const transcript = nodePath.join(projectDirectory, 'transcript.jsonl');
    const findings = nodePath.join(projectDirectory, 'findings.json');
    writeFileSync(transcript, 'transcript content');
    writeFileSync(findings, JSON.stringify(twoFindings));

    const previousProjectDirectory = process.env.CLAUDE_PROJECT_DIR;
    const previousExitCode = process.exitCode;
    process.env.CLAUDE_PROJECT_DIR = projectDirectory;
    process.exitCode = undefined;
    try {
      await retroCommand({ transcript, findings, sessionId: 'sess-a' });
    } finally {
      if (previousProjectDirectory === undefined) {
        delete process.env.CLAUDE_PROJECT_DIR;
      } else {
        process.env.CLAUDE_PROJECT_DIR = previousProjectDirectory;
      }
      process.exitCode = previousExitCode;
    }

    const remaining = readSpooledDrafts(projectDirectory, 'sess-a');
    expect(remaining).toHaveLength(2);
    expect(remaining.map(draft => draft.title).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'Alpha friction',
      'Beta friction',
    ]);
  });
});

// ZFGWS1 SM1.AC2 — the RUNNER (buildAutoExtractor), not just the headless-default
// concept, requests sonnet by default and honors the retro.model config override.
// Covers the done_when "a test covers buildAutoExtractor's model".
describe('buildAutoExtractor (SM1.AC2 — runner model: sonnet default, config-overridable)', () => {
  let projectDirectory: string;
  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-runner-'));
  });
  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  async function modelFromRunner(
    directory: string,
    agent: 'claude' | 'codex' = 'claude',
  ): Promise<{ argv: string[]; model: string | undefined }> {
    let argvSeen: string[] = [];
    const extract = await buildAutoExtractor(directory, {
      agent,
      spawn: (argv: string[]) => {
        argvSeen = argv;
        return Promise.resolve({ code: 0, stdout: '' });
      },
    });
    await extract('transcript');
    const modelFlag = agent === 'codex' ? '-m' : '--model';
    return { argv: argvSeen, model: argvSeen[argvSeen.indexOf(modelFlag) + 1] };
  }

  it('builds the extractor with sonnet when no retro.model is configured', async () => {
    const result = await modelFromRunner(projectDirectory);
    expect(result.model).toBe('sonnet');
  });

  it('builds the Codex extractor with gpt-5.5 when no retro.model is configured', async () => {
    const result = await modelFromRunner(projectDirectory, 'codex');
    expect(result.argv[0]).toBe('exec');
    expect(result.model).toBe('gpt-5.5');
  });

  it('uses the configured retro.model override', async () => {
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(projectDirectory, '.safeword', 'config.json'),
      JSON.stringify({ retro: { model: 'haiku' } }),
    );
    const claude = await modelFromRunner(projectDirectory);
    const codex = await modelFromRunner(projectDirectory, 'codex');
    expect(claude.model).toBe('haiku');
    expect(codex.model).toBe('haiku');
  });
});
