import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { rememberCloseoutBinding } from '../templates/hooks/lib/closeout-binding.ts';
import {
  draftSpoolPath,
  markDraftsFiled,
  recordFiledAck,
} from '../templates/hooks/lib/retro-draft-spool.ts';
import {
  applyCleanupPlan,
  buildCleanupPlan,
  classifyRetroFailure,
  cleanupPlanDigest,
  type CloseoutObservation,
  defaultBranchArguments,
  executeCleanupOperation,
  operationCommand,
  parseWorktrees,
  POST_MERGE_VERIFICATION_KINDS,
  pullRequestIdentity,
  resolveCloseoutBinding,
  resolveHostedCheckRollup,
  resolveHostedVerification,
  resolveProtection,
  resolveRemoteRef as resolveRemoteReference,
  resolveRequiredChecks,
  retroAgentForRuntime,
  retroForMergedPullRequest,
  runBoundRetro,
  safewordCliCommand,
  transcriptMatchesBinding,
  VERIFICATION_COMMAND_TIMEOUT_MS,
  workingStateHash,
} from '../templates/scripts/closeout-cleanup.ts';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');

function normalizedCloseoutScript(path: string): string {
  return readFileSync(path, 'utf8')
    .replace('../../runtime/hooks/lib/closeout-binding.ts', '../hooks/lib/closeout-binding.ts')
    .replace(
      /import \{\s*draftSpoolPath,\s*readAcks,\s*readSpooledDrafts,?\s*\} from '\.\.\/\.\.\/runtime\/hooks\/lib\/retro-draft-spool\.ts';/u,
      "import { draftSpoolPath, readAcks, readSpooledDrafts } from '../hooks/lib/retro-draft-spool.ts';",
    )
    .replace('../../runtime/hooks/lib/run-identity.ts', '../hooks/lib/run-identity.ts')
    .replace(
      'bun "${CLAUDE_PLUGIN_ROOT}"/resources/scripts/closeout-cleanup.ts',
      'bun .safeword/scripts/closeout-cleanup.ts',
    )
    .replace(
      `'"\${CLAUDE_PLUGIN_ROOT}"/resources/scripts/closeout-cleanup.ts'`,
      "'.safeword/scripts/closeout-cleanup.ts'",
    );
}

function safeObservation(overrides: Partial<CloseoutObservation> = {}): CloseoutObservation {
  return {
    pullRequests: [
      {
        url: 'https://github.com/acme/widget/pull/42',
        state: 'MERGED',
        headOwner: 'acme',
        headRepository: 'widget',
        headRefName: 'feature/closeout',
        headRefOid: 'a'.repeat(40),
        ciChecks: 'passed',
      },
    ],
    remote: {
      name: 'origin',
      url: 'git@github.com:acme/widget.git',
      pushUrl: 'git@github.com:acme/widget.git',
      oid: 'a'.repeat(40),
    },
    remoteResolution: 'matched',
    localRefOid: 'a'.repeat(40),
    defaultBranch: 'main',
    protection: 'unprotected',
    deliveryWorktreePath: '/repo-closeout',
    worktrees: [
      {
        path: '/repo',
        branch: 'main',
        oid: 'b'.repeat(40),
        main: true,
        realPath: '/repo',
        device: 1,
        inode: 1,
        gitDirectory: '/repo/.git',
      },
      {
        path: '/repo-closeout',
        branch: 'feature/closeout',
        oid: 'a'.repeat(40),
        main: false,
        realPath: '/repo-closeout',
        device: 1,
        inode: 2,
        gitDirectory: '/repo/.git/worktrees/repo-closeout',
      },
    ],
    verification: { current: true, passed: true, headOid: 'a'.repeat(40), stateHash: 'clean' },
    retro: { bound: true, complete: true, pendingDrafts: 0, evidenceHash: 'retro-clean' },
    ...overrides,
  };
}

function pullRequest() {
  const value = safeObservation().pullRequests[0];
  if (!value) throw new Error('fixture pull request missing');
  return value;
}

function worktree(index: number) {
  const value = safeObservation().worktrees[index];
  if (!value) throw new Error(`fixture worktree ${index} missing`);
  return value;
}

function runGit(...arguments_: string[]): string {
  const result = spawnSync('git', arguments_, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

function filingNeededRetroResult() {
  return {
    status: 0,
    stdout: JSON.stringify({ state: 'changed', data: { agent_filing_needed: true } }),
    stderr: '',
  };
}

function completedRetroResult() {
  return {
    status: 0,
    stdout: JSON.stringify({ state: 'healthy', data: { agent_filing_needed: false } }),
    stderr: '',
  };
}

describe('closeout cleanup guard (93C14D TBU1.R2/R3)', () => {
  it('does not run retrospective work before the exact pull request is confirmed merged', () => {
    const binding = { runtime: 'codex' as const, id: 'thread-42', projectRoot: '/repo' };
    let calls = 0;
    const runRetro = () => {
      calls += 1;
      return safeObservation().retro;
    };

    expect(retroForMergedPullRequest('/repo', binding, [], runRetro)).toMatchObject({
      complete: false,
    });
    expect(
      retroForMergedPullRequest('/repo', binding, [{ ...pullRequest(), state: 'OPEN' }], runRetro),
    ).toMatchObject({ complete: false });
    expect(calls).toBe(0);

    expect(retroForMergedPullRequest('/repo', binding, [pullRequest()], runRetro)).toMatchObject({
      complete: true,
    });
    expect(calls).toBe(1);
  });

  it('revalidates immutable merged code without rerunning mutable dependency intelligence', () => {
    expect(POST_MERGE_VERIFICATION_KINDS).toEqual(['verify', 'build', 'typecheck', 'bdd']);
    expect(POST_MERGE_VERIFICATION_KINDS).not.toContain('deps');
    expect(VERIFICATION_COMMAND_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it('uses Codex Desktop identity only when a fresh bridge agrees with the authenticated task', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-closeout-codex-desktop-'));
    try {
      spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8' });
      mkdirSync(nodePath.join(root, '.safeword'));
      writeFileSync(nodePath.join(root, '.safeword', 'SAFEWORD.md'), '# SafeWord\n');

      expect(resolveCloseoutBinding(root, { CODEX_THREAD_ID: 'desktop-thread-42' })).toEqual({
        runtime: 'codex',
        id: 'desktop-thread-42',
        projectRoot: realpathSync(root),
      });
      expect(resolveCloseoutBinding(root, {})).toBeUndefined();

      rememberCloseoutBinding({
        projectDirectory: root,
        runtime: 'codex',
        id: 'different-thread',
      });
      expect(
        resolveCloseoutBinding(root, { CODEX_THREAD_ID: 'desktop-thread-42' }),
      ).toBeUndefined();
      expect(resolveCloseoutBinding(root, { CODEX_THREAD_ID: 'desktop-thread-42' })).toEqual({
        runtime: 'codex',
        id: 'desktop-thread-42',
        projectRoot: realpathSync(root),
      });

      rememberCloseoutBinding({
        projectDirectory: root,
        runtime: 'codex',
        id: 'desktop-thread-42',
      });
      expect(resolveCloseoutBinding(root, { CODEX_THREAD_ID: 'desktop-thread-42' })).toEqual({
        runtime: 'codex',
        id: 'desktop-thread-42',
        projectRoot: realpathSync(root),
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('selects the mandatory retro extractor from the bound host runtime', () => {
    expect(retroAgentForRuntime('claude')).toBe('claude');
    expect(retroAgentForRuntime('codex')).toBe('codex');
    expect(retroAgentForRuntime('cursor')).toBe('cursor');
  });

  it.each(['claude', 'codex', 'cursor'] as const)(
    'passes the bound %s runtime to the real retro command boundary',
    runtime => {
      const root = mkdtempSync(nodePath.join(tmpdir(), 'closeout-retro-agent-'));
      const transcript =
        runtime === 'cursor'
          ? nodePath.join(root, 'agent-transcripts', `${runtime}-42`, `${runtime}-42.jsonl`)
          : nodePath.join(root, 'transcript.jsonl');
      mkdirSync(nodePath.dirname(transcript), { recursive: true });
      if (runtime === 'codex') spawnSync('git', ['init', '--quiet', root]);
      writeFileSync(
        transcript,
        `${JSON.stringify(
          runtime === 'cursor'
            ? { role: 'user', message: { content: [{ type: 'text', text: 'hello' }] } }
            : { session_id: `${runtime}-42`, cwd: root },
        )}\n`,
      );
      let observedEnvironment: Record<string, string | undefined> | undefined;
      let observedArguments: string[] = [];
      try {
        const result = runBoundRetro(
          root,
          { runtime, id: `${runtime}-42`, projectRoot: root, transcriptPath: transcript },
          (_cwd, arguments_, env) => {
            observedArguments = arguments_;
            observedEnvironment = env;
            return {
              status: 0,
              stdout: JSON.stringify({
                state: 'healthy',
                data: { agent_filing_needed: false },
              }),
              stderr: '',
            };
          },
        );

        expect(result.complete).toBe(true);
        expect(observedArguments).toContain('--auto-extract');
        expect(observedEnvironment?.SAFEWORD_RETRO_AGENT).toBe(runtime);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it('reuses a completed extraction after acknowledged filing drains its pending drafts', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'closeout-retro-filing-recovery-'));
    const id = 'claude-filing-recovery';
    const transcript = nodePath.join(root, 'transcript.jsonl');
    try {
      spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8' });
      writeFileSync(transcript, `${JSON.stringify({ session_id: id, cwd: root })}\n`);
      const spool = draftSpoolPath(root, id);
      mkdirSync(nodePath.dirname(spool), { recursive: true });
      writeFileSync(
        spool,
        `${JSON.stringify({
          signature: 'retro:filing-recovery',
          title: 'File the completed retrospective',
          body: 'A safe, already-extracted finding.',
          labels: ['retro'],
        })}\n`,
      );
      const binding = {
        runtime: 'claude' as const,
        id,
        projectRoot: root,
        transcriptPath: transcript,
      };
      let runs = 0;
      const runner = () => {
        runs += 1;
        return filingNeededRetroResult();
      };

      expect(runBoundRetro(root, binding, runner)).toMatchObject({
        complete: false,
        failure: 'filing',
      });
      expect(recordFiledAck(root, id, { signature: 'retro:filing-recovery', issue: 2176 })).toBe(
        true,
      );
      markDraftsFiled(root, id, ['retro:filing-recovery']);
      expect(runBoundRetro(root, binding, runner)).toMatchObject({
        complete: true,
        pendingDrafts: 0,
      });
      expect(runs).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not treat disappearance of an unacknowledged draft as filing proof', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'closeout-retro-unacknowledged-loss-'));
    const id = 'claude-unacknowledged-loss';
    const transcript = nodePath.join(root, 'transcript.jsonl');
    try {
      spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8' });
      writeFileSync(transcript, `${JSON.stringify({ session_id: id, cwd: root })}\n`);
      const spool = draftSpoolPath(root, id);
      mkdirSync(nodePath.dirname(spool), { recursive: true });
      writeFileSync(
        spool,
        `${JSON.stringify({
          signature: 'retro:unacknowledged-loss',
          title: 'Preserve filing proof',
          body: 'A draft that must not disappear silently.',
          labels: ['retro'],
        })}\n`,
      );
      const binding = {
        runtime: 'claude' as const,
        id,
        projectRoot: root,
        transcriptPath: transcript,
      };
      let runs = 0;
      const runner = () => {
        runs += 1;
        return filingNeededRetroResult();
      };

      expect(runBoundRetro(root, binding, runner).complete).toBe(false);
      markDraftsFiled(root, id, ['retro:unacknowledged-loss']);
      expect(runBoundRetro(root, binding, runner)).toMatchObject({
        complete: false,
        failure: 'filing',
        pendingDrafts: 0,
      });
      expect(runs).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires acknowledgements for captured drafts even when extraction reports filing complete', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'closeout-retro-complete-with-drafts-'));
    const id = 'claude-complete-with-drafts';
    const transcript = nodePath.join(root, 'transcript.jsonl');
    try {
      spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8' });
      writeFileSync(transcript, `${JSON.stringify({ session_id: id, cwd: root })}\n`);
      const spool = draftSpoolPath(root, id);
      mkdirSync(nodePath.dirname(spool), { recursive: true });
      writeFileSync(
        spool,
        `${JSON.stringify({
          signature: 'retro:complete-with-drafts',
          title: 'Do not infer filing from disappearance',
          body: 'A pre-existing draft still needs an acknowledgement.',
          labels: ['retro'],
        })}\n`,
      );
      const binding = {
        runtime: 'claude' as const,
        id,
        projectRoot: root,
        transcriptPath: transcript,
      };
      let runs = 0;
      const runner = () => {
        runs += 1;
        return completedRetroResult();
      };

      expect(runBoundRetro(root, binding, runner).complete).toBe(false);
      markDraftsFiled(root, id, ['retro:complete-with-drafts']);
      expect(runBoundRetro(root, binding, runner)).toMatchObject({
        complete: false,
        failure: 'filing',
        pendingDrafts: 0,
      });
      expect(runs).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reruns an inconsistent filing-needed result when no recoverable draft exists', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'closeout-retro-missing-draft-'));
    const id = 'claude-missing-draft';
    const transcript = nodePath.join(root, 'transcript.jsonl');
    try {
      spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8' });
      writeFileSync(transcript, `${JSON.stringify({ session_id: id, cwd: root })}\n`);
      const binding = {
        runtime: 'claude' as const,
        id,
        projectRoot: root,
        transcriptPath: transcript,
      };
      let runs = 0;
      const runner = () => {
        runs += 1;
        return filingNeededRetroResult();
      };

      expect(runBoundRetro(root, binding, runner).complete).toBe(false);
      expect(runBoundRetro(root, binding, runner).complete).toBe(false);
      expect(runs).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reruns extraction when the bound transcript grows', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'closeout-retro-transcript-growth-'));
    const id = 'claude-transcript-growth';
    const transcript = nodePath.join(root, 'transcript.jsonl');
    try {
      spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8' });
      writeFileSync(transcript, `${JSON.stringify({ session_id: id, cwd: root })}\n`);
      const binding = {
        runtime: 'claude' as const,
        id,
        projectRoot: root,
        transcriptPath: transcript,
      };
      let runs = 0;
      const invocations: string[][] = [];
      const runner = (_root: string, arguments_: string[]) => {
        runs += 1;
        invocations.push(arguments_);
        return completedRetroResult();
      };

      expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      writeFileSync(transcript, `${JSON.stringify({ role: 'user', text: 'new content' })}\n`, {
        flag: 'a',
      });
      expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      expect(runs).toBe(2);
      expect(invocations[1]).toContain('--window-start');
      expect(invocations[1]?.at(-1)).toBe(
        String(`${JSON.stringify({ session_id: id, cwd: root })}\n`.length),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    [
      'metadata-only appended records',
      (records: string[]) => [...records, JSON.stringify({ type: 'metadata', value: 'new' })],
    ],
    [
      'mixed host and user records',
      (records: string[]) => [
        ...records,
        JSON.stringify({ role: 'assistant', text: 'host' }),
        JSON.stringify({ role: 'user', text: 'user' }),
      ],
    ],
    ['reordered existing records', (records: string[]) => records.toReversed()],
    ['truncated existing records', (records: string[]) => records.slice(0, 1)],
    [
      'an ambiguous unclassified record',
      (records: string[]) => [...records, JSON.stringify({ unknown: 'record' })],
    ],
  ] as const)('reruns extraction after %s change the bound transcript bytes', (_case, mutate) => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'closeout-retro-transcript-mutation-'));
    const id = 'claude-transcript-mutation';
    const transcript = nodePath.join(root, 'transcript.jsonl');
    const records = [
      JSON.stringify({ session_id: id, cwd: root }),
      JSON.stringify({ role: 'user', text: 'original' }),
    ];
    try {
      spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8' });
      writeFileSync(transcript, `${records.join('\n')}\n`);
      const binding = {
        runtime: 'claude' as const,
        id,
        projectRoot: root,
        transcriptPath: transcript,
      };
      let runs = 0;
      const runner = () => {
        runs += 1;
        return completedRetroResult();
      };

      expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      writeFileSync(transcript, `${mutate(records).join('\n')}\n`);
      expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      expect(runs).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('evaluates transcript content appended during extraction before returning complete', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'closeout-retro-concurrent-append-'));
    const id = 'codex-concurrent-append';
    const transcript = nodePath.join(root, 'transcript.jsonl');
    try {
      spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8' });
      const firstRecord = `${JSON.stringify({ session_id: id, cwd: root })}\n`;
      const lateRecord = `${JSON.stringify({ role: 'assistant', text: 'late finding' })}\n`;
      writeFileSync(transcript, firstRecord);
      const binding = {
        runtime: 'codex' as const,
        id,
        projectRoot: root,
        transcriptPath: transcript,
      };
      const windows: string[] = [];
      let runs = 0;
      const runner = (_root: string, arguments_: string[]) => {
        runs += 1;
        windows.push(arguments_.includes('--window-start') ? (arguments_.at(-1) ?? '') : 'full');
        if (runs === 1) {
          writeFileSync(transcript, lateRecord, { flag: 'a' });
          return completedRetroResult();
        }
        const spool = draftSpoolPath(root, id);
        mkdirSync(nodePath.dirname(spool), { recursive: true });
        writeFileSync(
          spool,
          `${JSON.stringify({
            signature: 'retro:late-finding',
            title: 'Preserve the late finding',
            body: 'A finding appended while retrospective extraction was running.',
            labels: ['retro'],
          })}\n`,
        );
        return filingNeededRetroResult();
      };

      expect(runBoundRetro(root, binding, runner)).toMatchObject({
        complete: false,
        failure: 'filing',
        pendingDrafts: 1,
        spoolPath: realpathSync(draftSpoolPath(root, id)),
      });
      expect(windows).toEqual(['full', String(firstRecord.length)]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed after bounded extraction windows when the transcript never settles', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'closeout-retro-continuous-append-'));
    const id = 'codex-continuous-append';
    const transcript = nodePath.join(root, 'transcript.jsonl');
    try {
      spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8' });
      writeFileSync(transcript, `${JSON.stringify({ session_id: id, cwd: root })}\n`);
      const binding = {
        runtime: 'codex' as const,
        id,
        projectRoot: root,
        transcriptPath: transcript,
      };
      let runs = 0;
      const runner = () => {
        runs += 1;
        const text = `late finding ${runs}`;
        writeFileSync(transcript, `${JSON.stringify({ role: 'assistant', text })}\n`, {
          flag: 'a',
        });
        return completedRetroResult();
      };

      expect(runBoundRetro(root, binding, runner)).toMatchObject({
        complete: false,
        failure: 'unknown',
      });
      expect(runs).toBe(3);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('ignores only Codex tool lifecycle records appended by the running closeout', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'closeout-retro-tool-progress-'));
    const id = 'codex-tool-progress';
    const transcript = nodePath.join(root, 'transcript.jsonl');
    try {
      spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8' });
      writeFileSync(
        transcript,
        `${JSON.stringify({ type: 'session_meta', payload: { id, cwd: root } })}\n`,
      );
      const binding = {
        runtime: 'codex' as const,
        id,
        projectRoot: root,
        transcriptPath: transcript,
      };
      let runs = 0;
      const runner = () => {
        runs += 1;
        writeFileSync(
          transcript,
          `${JSON.stringify({
            type: 'response_item',
            payload: {
              type: 'custom_tool_call_output',
              call_id: 'closeout-exec',
              output: 'Script running',
            },
          })}\n`,
          { flag: 'a' },
        );
        return completedRetroResult();
      };

      expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      expect(runs).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('ignores Codex commentary appended by the turn running closeout', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'closeout-retro-turn-progress-'));
    const id = 'codex-turn-progress';
    const turnId = 'closeout-turn';
    const transcript = nodePath.join(root, 'transcript.jsonl');
    try {
      spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8' });
      writeFileSync(
        transcript,
        `${[
          JSON.stringify({ type: 'session_meta', payload: { id, cwd: root } }),
          JSON.stringify({
            type: 'response_item',
            payload: {
              type: 'custom_tool_call',
              name: 'exec',
              internal_chat_message_metadata_passthrough: { turn_id: turnId },
            },
          }),
        ].join('\n')}\n`,
      );
      const binding = {
        runtime: 'codex' as const,
        id,
        projectRoot: root,
        transcriptPath: transcript,
      };
      let runs = 0;
      const runner = () => {
        runs += 1;
        writeFileSync(
          transcript,
          `${[
            JSON.stringify({ type: 'event_msg', payload: { type: 'token_count' } }),
            JSON.stringify({
              type: 'response_item',
              payload: {
                type: 'reasoning',
                internal_chat_message_metadata_passthrough: { turn_id: turnId },
              },
            }),
            JSON.stringify({
              type: 'event_msg',
              payload: {
                type: 'agent_message',
                message: 'Closeout is still running.',
                phase: 'commentary',
              },
            }),
            JSON.stringify({
              type: 'response_item',
              payload: {
                type: 'message',
                role: 'assistant',
                phase: 'commentary',
                content: [{ type: 'output_text', text: 'Closeout is still running.' }],
                internal_chat_message_metadata_passthrough: { turn_id: turnId },
              },
            }),
            JSON.stringify({
              type: 'response_item',
              payload: {
                type: 'message',
                role: 'developer',
                internal_chat_message_metadata_passthrough: { turn_id: turnId },
              },
            }),
          ].join('\n')}\n`,
          { flag: 'a' },
        );
        return completedRetroResult();
      };

      expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      expect(runs).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('re-extracts differently attributed or unpaired Codex commentary', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'closeout-retro-other-turn-'));
    const id = 'codex-other-turn';
    const transcript = nodePath.join(root, 'transcript.jsonl');
    try {
      spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8' });
      writeFileSync(
        transcript,
        `${[
          JSON.stringify({ type: 'session_meta', payload: { id, cwd: root } }),
          JSON.stringify({
            type: 'response_item',
            payload: {
              type: 'custom_tool_call',
              name: 'exec',
              internal_chat_message_metadata_passthrough: { turn_id: 'closeout-turn' },
            },
          }),
        ].join('\n')}\n`,
      );
      const binding = {
        runtime: 'codex' as const,
        id,
        projectRoot: root,
        transcriptPath: transcript,
      };
      let runs = 0;
      const runner = () => {
        runs += 1;
        if (runs === 1) {
          writeFileSync(
            transcript,
            `${JSON.stringify({
              type: 'response_item',
              payload: {
                type: 'message',
                role: 'assistant',
                phase: 'commentary',
                content: [{ type: 'output_text', text: 'A later turn found something.' }],
                internal_chat_message_metadata_passthrough: { turn_id: 'later-turn' },
              },
            })}\n`,
            { flag: 'a' },
          );
        }
        return completedRetroResult();
      };

      expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      expect(runs).toBe(2);

      writeFileSync(
        transcript,
        `${JSON.stringify({
          type: 'event_msg',
          payload: {
            type: 'agent_message',
            message: 'An unpaired commentary event.',
            phase: 'commentary',
          },
        })}\n`,
        { flag: 'a' },
      );
      expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      expect(runs).toBe(3);

      writeFileSync(
        transcript,
        `${JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'assistant',
            phase: 'commentary',
            content: [{ type: 'output_text', text: 'An unpaired commentary response.' }],
            internal_chat_message_metadata_passthrough: { turn_id: 'closeout-turn' },
          },
        })}\n`,
        { flag: 'a' },
      );
      expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      expect(runs).toBe(4);

      writeFileSync(
        transcript,
        `${JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: 'Stop and preserve this finding.' }],
            internal_chat_message_metadata_passthrough: { turn_id: 'closeout-turn' },
          },
        })}\n`,
        { flag: 'a' },
      );
      expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      expect(runs).toBe(5);

      writeFileSync(
        transcript,
        `${JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'assistant',
            phase: 'final_answer',
            content: [{ type: 'output_text', text: 'A substantive closeout finding.' }],
            internal_chat_message_metadata_passthrough: { turn_id: 'closeout-turn' },
          },
        })}\n`,
        { flag: 'a' },
      );
      expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      expect(runs).toBe(6);

      writeFileSync(transcript, `${JSON.stringify({ type: 'world_state', payload: {} })}\n`, {
        flag: 'a',
      });
      expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      expect(runs).toBe(7);

      writeFileSync(transcript, '{"type":"response_item"\n', { flag: 'a' });
      expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      expect(runs).toBe(8);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('derives the delta offset from the sealed UTF-16 prefix and defers a partial tail', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'closeout-retro-sealed-prefix-'));
    const id = 'claude-sealed-prefix';
    const transcript = nodePath.join(root, 'transcript.jsonl');
    try {
      spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8' });
      const firstRecord = `${JSON.stringify({ session_id: id, cwd: root, text: '🧪' })}\n`;
      writeFileSync(transcript, firstRecord);
      const binding = {
        runtime: 'claude' as const,
        id,
        projectRoot: root,
        transcriptPath: transcript,
      };
      const invocations: string[][] = [];
      const runner = (_root: string, arguments_: string[]) => {
        invocations.push(arguments_);
        return completedRetroResult();
      };

      expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      writeFileSync(transcript, '{"role":"assistant"', { flag: 'a' });
      expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      expect(invocations).toHaveLength(1);

      writeFileSync(transcript, ',"text":"done"}\n', { flag: 'a' });
      expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      expect(invocations).toHaveLength(2);
      expect(invocations[1]?.at(-1)).toBe(String(firstRecord.length));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not cache retro output without an explicit filing verdict', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'closeout-retro-malformed-output-'));
    const id = 'claude-malformed-retro';
    const transcript = nodePath.join(root, 'transcript.jsonl');
    try {
      spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8' });
      writeFileSync(transcript, `${JSON.stringify({ session_id: id, cwd: root })}\n`);
      let runs = 0;
      const binding = {
        runtime: 'claude' as const,
        id,
        projectRoot: root,
        transcriptPath: transcript,
      };
      const runner = () => {
        runs += 1;
        return {
          status: 0,
          stdout: JSON.stringify({ state: 'healthy', data: {} }),
          stderr: '',
        };
      };

      expect(runBoundRetro(root, binding, runner).complete).toBe(false);
      expect(runBoundRetro(root, binding, runner).complete).toBe(false);
      expect(runs).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects incomplete and wrongly typed retro receipts', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'closeout-retro-invalid-receipt-'));
    const id = 'claude-invalid-retro-receipt';
    const transcript = nodePath.join(root, 'transcript.jsonl');
    try {
      spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8' });
      writeFileSync(transcript, `${JSON.stringify({ session_id: id, cwd: root })}\n`);
      const binding = {
        runtime: 'claude' as const,
        id,
        projectRoot: root,
        transcriptPath: transcript,
      };
      let runs = 0;
      const runner = () => {
        runs += 1;
        return completedRetroResult();
      };
      expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      const receiptPath = nodePath.join(root, '.git', 'safeword', 'closeout-retro.json');
      const valid = JSON.parse(readFileSync(receiptPath, 'utf8')) as Record<string, unknown>;
      const jsonNull: unknown = JSON.parse('null');
      const invalidReceipts = [
        { ...valid, agentFilingNeeded: undefined },
        { ...valid, agentFilingNeeded: jsonNull },
        { ...valid, agentFilingNeeded: 'false' },
        { ...valid, pendingDrafts: jsonNull },
        { ...valid, pendingDrafts: -1 },
        { ...valid, pendingDrafts: '0' },
        { ...valid, pendingDraftSignatures: undefined },
        { ...valid, pendingDraftSignatures: ['unexpected'] },
        {
          ...valid,
          snapshot: {
            ...(valid.snapshot as Record<string, unknown>),
            byteLength: 0.5,
          },
        },
        {
          ...valid,
          snapshot: {
            ...(valid.snapshot as Record<string, unknown>),
            utf16Length: 0,
          },
        },
      ];

      for (const receipt of invalidReceipts) {
        writeFileSync(receiptPath, `${JSON.stringify(receipt)}\n`);
        expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      }
      expect(runs).toBe(1 + invalidReceipts.length);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    { invalidEvidence: 'a missing filing verdict', patch: { agentFilingNeeded: undefined } },
    { invalidEvidence: 'a non-boolean filing verdict', patch: { agentFilingNeeded: 'false' } },
    { invalidEvidence: 'a negative pending-draft count', patch: { pendingDrafts: -1 } },
    { invalidEvidence: 'a fractional sealed byte length', patch: { snapshotByteLength: 0.5 } },
  ])('replaces malformed retro receipt evidence: $invalidEvidence', ({ patch }) => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'closeout-retro-invalid-example-'));
    const id = 'claude-invalid-retro-example';
    const transcript = nodePath.join(root, 'transcript.jsonl');
    try {
      spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8' });
      writeFileSync(transcript, `${JSON.stringify({ session_id: id, cwd: root })}\n`);
      const binding = {
        runtime: 'claude' as const,
        id,
        projectRoot: root,
        transcriptPath: transcript,
      };
      let runs = 0;
      const runner = () => {
        runs += 1;
        return completedRetroResult();
      };
      expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      const receiptPath = nodePath.join(root, '.git', 'safeword', 'closeout-retro.json');
      const valid = JSON.parse(readFileSync(receiptPath, 'utf8')) as Record<string, unknown>;
      const { snapshotByteLength, ...receiptPatch } = patch;
      const receipt = {
        ...valid,
        ...receiptPatch,
        ...(snapshotByteLength !== undefined && {
          snapshot: {
            ...(valid.snapshot as Record<string, unknown>),
            byteLength: snapshotByteLength,
          },
        }),
      };
      writeFileSync(receiptPath, `${JSON.stringify(receipt)}\n`);
      expect(runBoundRetro(root, binding, runner).complete).toBe(true);
      expect(runs).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not represent a failed git status as a clean state hash', () => {
    expect(workingStateHash('/definitely/not/a/repository', 'a'.repeat(40))).toBeUndefined();
  });
  it.each([
    {
      complete: true,
      errorText: '',
      processStatus: 0,
      agentFilingNeeded: false,
      pendingDrafts: 0,
      expected: undefined,
    },
    {
      complete: false,
      errorText: 'Retro extraction failed.',
      processStatus: 1,
      agentFilingNeeded: false,
      pendingDrafts: 0,
      expected: 'extraction',
    },
    {
      complete: false,
      errorText: '',
      processStatus: 0,
      agentFilingNeeded: true,
      pendingDrafts: 0,
      expected: 'filing',
    },
    {
      complete: false,
      errorText: '',
      processStatus: 0,
      agentFilingNeeded: false,
      pendingDrafts: 1,
      expected: 'filing',
    },
    {
      complete: false,
      errorText: 'command failed on stderr',
      processStatus: 1,
      agentFilingNeeded: false,
      pendingDrafts: 0,
      expected: 'extraction',
    },
    {
      complete: false,
      errorText: 'malformed output',
      processStatus: 0,
      agentFilingNeeded: false,
      pendingDrafts: 0,
      expected: 'unknown',
    },
  ] as const)(
    'classifies the current retro outcome ($complete, $errorText, $processStatus, $agentFilingNeeded, $pendingDrafts)',
    ({ complete, errorText, processStatus, agentFilingNeeded, pendingDrafts, expected }) => {
      expect(
        classifyRetroFailure({
          complete,
          errorText,
          processStatus,
          agentFilingNeeded,
          pendingDrafts,
        }),
      ).toBe(expected);
    },
  );

  it('resolves the project-local SafeWord CLI before the package runner fallback', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-closeout-cli-'));
    try {
      const installed = nodePath.join(root, 'node_modules', 'safeword', 'dist');
      mkdirSync(installed, { recursive: true });
      writeFileSync(nodePath.join(installed, 'cli.js'), '');

      expect(safewordCliCommand(root)).toEqual(['bun', nodePath.join(installed, 'cli.js')]);
      rmSync(nodePath.join(root, 'node_modules'), { recursive: true, force: true });
      expect(safewordCliCommand(root)).toEqual(['bunx', 'safeword']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('looks up the default branch in the pull request head repository', () => {
    expect(defaultBranchArguments(pullRequest())).toEqual([
      'repo',
      'view',
      'acme/widget',
      '--json',
      'defaultBranchRef',
    ]);
  });

  it('maps current GitHub pull request shapes without trusting incomplete identities', () => {
    const expected = pullRequest();
    expect(
      pullRequestIdentity(
        {
          url: expected.url,
          state: expected.state,
          headRefName: expected.headRefName,
          headRefOid: expected.headRefOid,
          headRepositoryOwner: { login: expected.headOwner },
          headRepository: { name: expected.headRepository },
        },
        'passed',
      ),
    ).toEqual(expected);
    expect(
      pullRequestIdentity(
        {
          url: expected.url,
          state: expected.state,
          headRefName: expected.headRefName,
          headRefOid: expected.headRefOid,
          headRepository: { nameWithOwner: `${expected.headOwner}/${expected.headRepository}` },
        },
        'passed',
      ),
    ).toEqual(expected);
    expect(
      pullRequestIdentity({
        url: expected.url,
        state: expected.state,
        headRefName: expected.headRefName,
        headRefOid: expected.headRefOid,
      }),
    ).toBeUndefined();
  });

  it('trusts hosted verification only when required checks are explicitly complete', () => {
    expect(resolveRequiredChecks(undefined)).toBe('unknown');
    expect(resolveRequiredChecks([])).toBe('absent');
    expect(resolveRequiredChecks([{ bucket: 'pass', state: 'SUCCESS' }])).toBe('passed');
    expect(resolveRequiredChecks([{ bucket: 'pending', state: 'PENDING' }])).toBe('pending');
    expect(resolveRequiredChecks([{ bucket: 'fail', state: 'FAILURE' }])).toBe('failed');
    expect(resolveRequiredChecks([{ bucket: 'unexpected', state: 'SUCCESS' }])).toBe('unknown');
  });

  it('requires both required checks and the complete hosted rollup to be green', () => {
    expect(
      resolveHostedCheckRollup([
        { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS' },
        { __typename: 'StatusContext', state: 'SUCCESS' },
      ]),
    ).toBe('passed');
    expect(
      resolveHostedCheckRollup([
        { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'FAILURE' },
      ]),
    ).toBe('failed');
    expect(
      resolveHostedCheckRollup([{ __typename: 'CheckRun', status: 'IN_PROGRESS', conclusion: '' }]),
    ).toBe('pending');
    expect(resolveHostedVerification('passed', 'passed')).toBe('passed');
    expect(resolveHostedVerification('passed', 'failed')).toBe('failed');
    expect(resolveHostedVerification('passed', 'pending')).toBe('pending');
    expect(resolveHostedVerification('absent', 'passed')).toBe('unknown');
    expect(resolveHostedVerification('unknown', 'passed')).toBe('unknown');
  });

  it('derives branch protection conservatively while allowing a proven-absent remote ref', () => {
    expect(resolveProtection('absent')).toBe('unprotected');
    expect(resolveProtection('matched', true)).toBe('protected');
    expect(resolveProtection('matched', false)).toBe('unprotected');
    expect(resolveProtection('matched')).toBe('unknown');
    expect(resolveProtection('unknown', false)).toBe('unprotected');
  });

  it('keeps installed and native-plugin closeout guards in canonical parity', () => {
    const template = normalizedCloseoutScript(
      nodePath.join(repoRoot, 'packages/cli/templates/scripts/closeout-cleanup.ts'),
    );
    expect(
      normalizedCloseoutScript(nodePath.join(repoRoot, '.safeword/scripts/closeout-cleanup.ts')),
    ).toBe(template);
    expect(
      normalizedCloseoutScript(
        nodePath.join(repoRoot, 'plugin/resources/scripts/closeout-cleanup.ts'),
      ),
    ).toBe(template);
  });

  it('previews exact cleanup in worktree, remote, local order with a stable digest', () => {
    const observation = safeObservation();
    const plan = buildCleanupPlan(observation);

    expect(plan.blockers).toEqual([]);
    expect(plan.operations.map(operation => operation.kind)).toEqual([
      'remove-worktree',
      'delete-remote-ref',
      'delete-local-ref',
    ]);
    expect(plan.operations[0]).toMatchObject({ path: '/repo-closeout', oid: 'a'.repeat(40) });
    expect(plan.operations[1]).toMatchObject({
      remote: 'origin',
      pushUrl: 'git@github.com:acme/widget.git',
      oid: 'a'.repeat(40),
    });
    expect(plan.operations[2]).toMatchObject({ ref: 'refs/heads/feature/closeout' });
    expect(cleanupPlanDigest(plan)).toMatch(/^[a-f0-9]{64}$/);
    expect(cleanupPlanDigest(plan)).toBe(cleanupPlanDigest(buildCleanupPlan(observation)));
  });

  it('keeps the cleanup authorization stable when only transcript evidence advances', () => {
    const first = buildCleanupPlan(safeObservation());
    const later = buildCleanupPlan(
      safeObservation({ retro: { ...safeObservation().retro, evidenceHash: 'retro-appended' } }),
    );

    expect(later.retroStateHash).not.toBe(first.retroStateHash);
    expect(cleanupPlanDigest(later)).toBe(cleanupPlanDigest(first));
  });

  it('keeps cleanup available while exposing the pending filing recovery path', () => {
    const pendingRetro = {
      ...safeObservation().retro,
      complete: false,
      pendingDrafts: 1,
      failure: 'filing' as const,
    };
    const completed = buildCleanupPlan(safeObservation());
    const withPath = buildCleanupPlan(
      safeObservation({
        retro: {
          ...pendingRetro,
          spoolPath: '/repo/.safeword/retro-drafts/claude-task.jsonl',
        },
      }),
    );

    expect(withPath.retro).toEqual({
      spoolPath: '/repo/.safeword/retro-drafts/claude-task.jsonl',
      durableSpoolPath: '/repo/.safeword/retro-drafts/claude-task.jsonl',
    });
    expect(withPath.blockers).toEqual([]);
    expect(withPath.advisories).toEqual([
      'retrospective filing failed; resolve the filing failure',
      'the current session filing spool has pending drafts',
    ]);
    expect(withPath.operations).toEqual(completed.operations);
    expect(cleanupPlanDigest(withPath)).toBe(cleanupPlanDigest(completed));
  });

  it('exposes only the binding-derived spool path when retrospective filing is pending', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'closeout-retro-spool-path-'));
    const id = 'claude-spool-path';
    const transcript = nodePath.join(root, 'transcript.jsonl');
    try {
      spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8' });
      writeFileSync(transcript, `${JSON.stringify({ session_id: id, cwd: root })}\n`);
      const spool = draftSpoolPath(root, id);
      mkdirSync(nodePath.dirname(spool), { recursive: true });
      writeFileSync(
        spool,
        `${JSON.stringify({
          signature: 'retro:spool-path',
          title: 'Recover pending filing',
          body: 'A bound draft.',
          labels: ['retro'],
        })}\n`,
      );

      expect(
        runBoundRetro(
          root,
          { runtime: 'claude', id, projectRoot: root, transcriptPath: transcript },
          () => filingNeededRetroResult(),
        ),
      ).toMatchObject({ pendingDrafts: 1, spoolPath: realpathSync(spool) });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses the unique default-branch worktree when the primary worktree is detached', () => {
    const observation = safeObservation({
      worktrees: [
        { path: '/repo-main', branch: 'main', oid: 'b'.repeat(40), main: false },
        worktree(1),
      ],
    });

    const plan = buildCleanupPlan(observation);

    expect(plan.blockers).toEqual([]);
    expect(plan.operations).toHaveLength(3);
    expect(plan.operations.every(operation => operation.cwd === '/repo-main')).toBe(true);
  });

  it('never removes the primary worktree even when another worktree holds the default branch', () => {
    const plan = buildCleanupPlan(
      safeObservation({
        worktrees: [
          { path: '/repo-main', branch: 'main', oid: 'b'.repeat(40), main: false },
          { ...worktree(1), main: true },
        ],
      }),
    );

    expect(plan.blockers).toContain('the main worktree is never a closeout target');
    expect(plan.operations).toEqual([]);
  });

  function expectEveryDeletionBlocked(
    overrides: Partial<CloseoutObservation>,
    expectedBlocker: string,
  ): void {
    const observation = safeObservation(overrides);
    const plan = buildCleanupPlan(observation);
    let executions = 0;
    expect(plan.blockers).toContain(expectedBlocker);
    const result = applyCleanupPlan({
      plan,
      digest: cleanupPlanDigest(plan),
      observe: () => observation,
      execute: () => {
        executions += 1;
      },
    });
    expect(result.applied).toBe(false);
    expect(executions).toBe(0);
  }

  it('stale verification evidence blocks every deletion', () => {
    expectEveryDeletionBlocked(
      { verification: { ...safeObservation().verification, current: false } },
      'local verification is stale',
    );
  });

  it.each([
    ['no pull request', { pullRequests: [] }, 'exactly one matching pull request is required'],
    [
      'ambiguous pull request',
      { pullRequests: [...safeObservation().pullRequests, ...safeObservation().pullRequests] },
      'exactly one matching pull request is required',
    ],
    [
      'unmerged pull request',
      { pullRequests: [{ ...pullRequest(), state: 'OPEN' }] },
      'the exact pull request is not confirmed merged',
    ],
  ] satisfies [string, Partial<CloseoutObservation>, string][])(
    '%s blocks deletion when pull request identity is unsafe',
    (_name, overrides, expectedBlocker) => {
      expectEveryDeletionBlocked(overrides, expectedBlocker);
    },
  );

  it.each([
    [
      'fork or remote mismatch',
      {
        remote: {
          name: 'origin',
          url: 'git@github.com:other/widget.git',
          pushUrl: 'git@github.com:other/widget.git',
          oid: 'a'.repeat(40),
        },
      },
      'the pull request head repository does not match the selected git remote',
    ],
    [
      'lookalike remote host',
      {
        remote: {
          name: 'origin',
          url: 'https://evil.example/github.com/acme/widget.git',
          pushUrl: 'https://evil.example/github.com/acme/widget.git',
          oid: 'a'.repeat(40),
        },
      },
      'the pull request head repository does not match the selected git remote',
    ],
    [
      'separate push repository',
      {
        remote: {
          name: 'origin',
          url: 'git@github.com:acme/widget.git',
          pushUrl: 'git@github.com:other/widget.git',
          oid: 'a'.repeat(40),
        },
      },
      'the pull request head repository does not match the selected git remote',
    ],
    [
      'ambiguous remote mapping',
      { remote: undefined, remoteResolution: 'ambiguous' },
      'the pull request head repository does not map to exactly one git remote',
    ],
  ] satisfies [string, Partial<CloseoutObservation>, string][])(
    '%s blocks deletion when remote identity is unsafe',
    (_name, overrides, expectedBlocker) => {
      expectEveryDeletionBlocked(overrides, expectedBlocker);
    },
  );

  it.each([
    [
      'dirty worktree',
      { worktrees: [worktree(0), { ...worktree(1), dirty: true }] },
      'the linked worktree is dirty: /repo-closeout',
    ],
    [
      'locked worktree',
      { worktrees: [worktree(0), { ...worktree(1), locked: true }] },
      'the linked worktree is locked: /repo-closeout',
    ],
    [
      'ambiguous worktree',
      { worktrees: [worktree(0), worktree(1), worktree(1)] },
      'the linked topic worktree is ambiguous',
    ],
    [
      'stale registration',
      { worktrees: [worktree(0), { ...worktree(1), prunable: true }] },
      'the worktree registration is stale: /repo-closeout',
    ],
  ] satisfies [string, Partial<CloseoutObservation>, string][])(
    '%s blocks deletion when worktree identity is unsafe',
    (_name, overrides, expectedBlocker) => {
      expectEveryDeletionBlocked(overrides, expectedBlocker);
    },
  );

  it.each([
    [
      'default branch',
      { pullRequests: [{ ...pullRequest(), headRefName: 'main' }] },
      'the default branch is never a closeout target',
    ],
    ['protected branch', { protection: 'protected' }, 'the topic branch is protected'],
  ] satisfies [string, Partial<CloseoutObservation>, string][])(
    '%s blocks deletion when the branch is protected from cleanup',
    (_name, overrides, expectedBlocker) => {
      expectEveryDeletionBlocked(overrides, expectedBlocker);
    },
  );

  it.each([
    [
      'changed local ref',
      { localRefOid: 'c'.repeat(40) },
      'the local branch no longer matches the pull request head',
    ],
    [
      'changed remote ref',
      {
        remote: {
          name: 'origin',
          url: 'git@github.com:acme/widget.git',
          pushUrl: 'git@github.com:acme/widget.git',
          oid: 'c'.repeat(40),
        },
      },
      'the remote branch no longer matches the pull request head',
    ],
    [
      'unobservable remote branch',
      { remote: undefined, remoteResolution: 'unknown' },
      'the remote branch state could not be observed',
    ],
    ['unknown default branch', { defaultBranch: '' }, 'the default branch is unknown'],
    ['unknown protection', { protection: 'unknown' }, 'branch protection state is unknown'],
    [
      'missing default-branch worktree',
      { worktrees: [worktree(1)] },
      'exactly one surviving default-branch worktree is required',
    ],
    [
      'ambiguous default-branch worktree',
      {
        worktrees: [
          worktree(0),
          { ...worktree(0), path: '/another-main', main: false },
          worktree(1),
        ],
      },
      'exactly one surviving default-branch worktree is required',
    ],
    [
      'dirty surviving worktree',
      { worktrees: [{ ...worktree(0), dirty: true }, worktree(1)] },
      'the surviving worktree is dirty: /repo',
    ],
    [
      'locked surviving worktree',
      { worktrees: [{ ...worktree(0), locked: true }, worktree(1)] },
      'the surviving worktree is locked: /repo',
    ],
    [
      'stale surviving worktree registration',
      { worktrees: [{ ...worktree(0), prunable: true }, worktree(1)] },
      'the surviving worktree registration is stale: /repo',
    ],
    [
      'failed verification',
      { verification: { ...safeObservation().verification, passed: false } },
      'local verification failed',
    ],
  ] satisfies [string, Partial<CloseoutObservation>, string][])(
    '%s blocks every deletion',
    (_name, overrides, expectedBlocker) => {
      expectEveryDeletionBlocked(overrides, expectedBlocker);
    },
  );

  it.each([
    [
      'missing session binding',
      { retro: { ...safeObservation().retro, bound: false } },
      'the current host session binding is missing or expired',
    ],
    [
      'incomplete retro',
      { retro: { ...safeObservation().retro, complete: false } },
      'the current session retrospective is incomplete',
    ],
    [
      'failed retro extraction',
      { retro: { ...safeObservation().retro, complete: false, failure: 'extraction' } },
      'retrospective extraction failed; resolve the extraction failure',
    ],
    [
      'failed retro filing',
      { retro: { ...safeObservation().retro, complete: false, failure: 'filing' } },
      'retrospective filing failed; resolve the filing failure',
    ],
    [
      'pending drafts',
      { retro: { ...safeObservation().retro, pendingDrafts: 2 } },
      'the current session filing spool has pending drafts',
    ],
  ] satisfies [string, Partial<CloseoutObservation>, string][])(
    '%s is advisory for cleanup',
    (_name, overrides, expectedAdvisory) => {
      const plan = buildCleanupPlan(safeObservation(overrides));

      expect(plan.blockers).toEqual([]);
      expect(plan.advisories).toContain(expectedAdvisory);
      expect(plan.operations).toHaveLength(3);
    },
  );

  it('preserves a topic branch used by a different worktree', () => {
    const plan = buildCleanupPlan(safeObservation({ deliveryWorktreePath: '/somewhere-else' }));

    expect(plan.blockers).toContain(
      'the topic branch is used by a different worktree: /repo-closeout',
    );
    expect(plan.operations).toEqual([]);
  });

  it('treats proven-absent exact targets as complete without broadening scope', () => {
    const plan = buildCleanupPlan(
      safeObservation({
        worktrees: [worktree(0)],
        remote: undefined,
        remoteResolution: 'absent',
        localRefOid: undefined,
      }),
    );
    expect(plan.blockers).toEqual([]);
    expect(plan.operations).toEqual([]);
    expect(plan.completed).toEqual(['worktree', 'remote branch', 'local branch']);
  });

  it('applies only a digest-bound unchanged plan using compare-and-swap commands', () => {
    const observation = safeObservation();
    const afterWorktree = safeObservation({ worktrees: [worktree(0)] });
    const afterRemote = safeObservation({
      worktrees: [worktree(0)],
      remote: undefined,
      remoteResolution: 'absent',
    });
    const afterLocal = safeObservation({
      worktrees: [worktree(0)],
      remote: undefined,
      remoteResolution: 'absent',
      localRefOid: undefined,
    });
    let current = observation;
    const plan = buildCleanupPlan(observation);
    const executed: string[][] = [];

    const result = applyCleanupPlan({
      plan,
      digest: cleanupPlanDigest(plan),
      observe: () => current,
      execute: operation => {
        executed.push(operationCommand(operation));
        if (operation.kind === 'remove-worktree') current = afterWorktree;
        else if (operation.kind === 'delete-remote-ref') current = afterRemote;
        else current = afterLocal;
      },
    });

    expect(result.applied).toBe(true);
    expect(executed).toEqual([
      ['git', '-C', '/repo', 'worktree', 'remove', '/repo-closeout'],
      [
        'git',
        '-C',
        '/repo',
        'push',
        `--force-with-lease=refs/heads/feature/closeout:${'a'.repeat(40)}`,
        'git@github.com:acme/widget.git',
        ':refs/heads/feature/closeout',
      ],
      ['git', '-C', '/repo', 'update-ref', '-d', 'refs/heads/feature/closeout', 'a'.repeat(40)],
    ]);
    expect(executed.flat()).not.toContain('--force');
  });

  it('applies after transcript growth when refreshed retro evidence is complete', () => {
    const preview = safeObservation();
    const refreshed = safeObservation({
      retro: { ...preview.retro, evidenceHash: 'retro-appended-and-reviewed' },
    });
    const plan = buildCleanupPlan(preview);
    let current = refreshed;

    const result = applyCleanupPlan({
      plan,
      digest: cleanupPlanDigest(plan),
      observe: () => current,
      execute: operation => {
        if (operation.kind === 'remove-worktree') {
          current = { ...refreshed, worktrees: [worktree(0)] };
        } else if (operation.kind === 'delete-remote-ref') {
          current = {
            ...refreshed,
            worktrees: [worktree(0)],
            remote: undefined,
            remoteResolution: 'absent',
          };
        } else {
          current = {
            ...refreshed,
            worktrees: [worktree(0)],
            remote: undefined,
            remoteResolution: 'absent',
            localRefOid: undefined,
          };
        }
      },
    });

    expect(result.applied).toBe(true);
  });

  it('reports transcript growth as advisory without changing cleanup authorization', () => {
    const preview = safeObservation();
    const plan = buildCleanupPlan(preview);
    const refreshed = buildCleanupPlan(
      safeObservation({
        retro: {
          ...preview.retro,
          complete: false,
          evidenceHash: 'retro-appended-not-reviewed',
        },
      }),
    );

    expect(refreshed.blockers).toEqual([]);
    expect(refreshed.advisories).toContain('the current session retrospective is incomplete');
    expect(cleanupPlanDigest(refreshed)).toBe(cleanupPlanDigest(plan));
  });

  it('reports stale verification without retrospective advisories', () => {
    const plan = buildCleanupPlan(
      safeObservation({ verification: { ...safeObservation().verification, current: false } }),
    );

    expect(plan.advisories).toEqual([]);
    expect(plan.blockers).toEqual(['local verification is stale']);
  });

  it('invalidates stale digests and changed observations before mutation', () => {
    const plan = buildCleanupPlan(safeObservation());
    const execute = () => {
      throw new Error('must not execute');
    };

    expect(
      applyCleanupPlan({ plan, digest: 'stale', observe: safeObservation, execute }).blockers,
    ).toContain('cleanup plan digest does not match');
    expect(
      applyCleanupPlan({
        plan,
        digest: cleanupPlanDigest(plan),
        observe: () =>
          safeObservation({
            verification: { ...safeObservation().verification, stateHash: 'changed' },
          }),
        execute,
      }).blockers,
    ).toContain('repository state changed after preview');
    expect(
      applyCleanupPlan({
        plan,
        digest: cleanupPlanDigest(plan),
        observe: () => safeObservation({ protection: 'protected' }),
        execute,
      }).blockers,
    ).toContain('the topic branch is protected');
  });

  it('re-observes each remaining target and stops after a concurrent ref change', () => {
    const initial = safeObservation();
    const remote = initial.remote;
    if (!remote) throw new Error('fixture remote missing');
    const changedRemote = safeObservation({
      worktrees: [worktree(0)],
      remote: { ...remote, oid: 'c'.repeat(40) },
    });
    const observations = [initial, initial, changedRemote];
    const executed: string[] = [];
    const plan = buildCleanupPlan(initial);

    const result = applyCleanupPlan({
      plan,
      digest: cleanupPlanDigest(plan),
      observe: () => observations.shift() ?? changedRemote,
      execute: operation => {
        executed.push(operation.kind);
      },
    });

    expect(result.applied).toBe(false);
    expect(result.blockers).toContain('delete-remote-ref target changed during cleanup');
    expect(executed).toEqual(['remove-worktree']);
  });

  it('stops before local deletion when the local branch advances during cleanup', () => {
    const initial = safeObservation();
    const afterWorktree = safeObservation({ worktrees: [worktree(0)] });
    const afterRemote = {
      ...afterWorktree,
      remote: undefined,
      remoteResolution: 'absent' as const,
    };
    const changedLocal = { ...afterRemote, localRefOid: 'c'.repeat(40) };
    const observations = [
      initial,
      initial,
      afterWorktree,
      afterWorktree,
      afterRemote,
      changedLocal,
    ];
    const executed: string[] = [];
    const plan = buildCleanupPlan(initial);

    const result = applyCleanupPlan({
      plan,
      digest: cleanupPlanDigest(plan),
      observe: () => observations.shift() ?? changedLocal,
      execute: operation => {
        executed.push(operation.kind);
      },
    });

    expect(result.applied).toBe(false);
    expect(result.blockers).toContain('delete-local-ref target changed during cleanup');
    expect(executed).toEqual(['remove-worktree', 'delete-remote-ref']);
  });

  it('stops before remote deletion when branch protection changes during cleanup', () => {
    const initial = safeObservation();
    const afterWorktree = safeObservation({ worktrees: [worktree(0)] });
    const protectedBranch = { ...afterWorktree, protection: 'protected' as const };
    const observations = [initial, initial, afterWorktree, protectedBranch];
    const executed: string[] = [];
    const plan = buildCleanupPlan(initial);

    const result = applyCleanupPlan({
      plan,
      digest: cleanupPlanDigest(plan),
      observe: () => observations.shift() ?? protectedBranch,
      execute: operation => {
        executed.push(operation.kind);
      },
    });

    expect(result.applied).toBe(false);
    expect(result.blockers).toContain('delete-remote-ref target changed during cleanup');
    expect(executed).toEqual(['remove-worktree']);
  });

  it('stops when the pull request head repository changes during cleanup', () => {
    const initial = safeObservation();
    const afterWorktree = safeObservation({ worktrees: [worktree(0)] });
    const changedRepo = {
      ...afterWorktree,
      pullRequests: [
        { ...pullRequest(), headOwner: 'other-owner', headRepository: 'other-repository' },
      ],
    };
    const observations = [initial, initial, afterWorktree, changedRepo];
    const executed: string[] = [];
    const plan = buildCleanupPlan(initial);

    const result = applyCleanupPlan({
      plan,
      digest: cleanupPlanDigest(plan),
      observe: () => observations.shift() ?? changedRepo,
      execute: operation => {
        executed.push(operation.kind);
      },
    });

    expect(result.applied).toBe(false);
    expect(result.blockers).toContain('pull request identity changed during cleanup');
    expect(executed).toEqual(['remove-worktree']);
  });

  it.each([
    ['dirty', safeObservation({ worktrees: [worktree(0), { ...worktree(1), dirty: true }] })],
    ['removed', safeObservation({ worktrees: [worktree(0)] })],
  ] as const)('refuses a %s worktree observed immediately before removal', (_change, changed) => {
    const initial = safeObservation();
    const observations = [initial, changed];
    const executed: string[] = [];
    const result = applyCleanupPlan({
      plan: buildCleanupPlan(initial),
      digest: cleanupPlanDigest(buildCleanupPlan(initial)),
      observe: () => observations.shift() ?? changed,
      execute: operation => {
        executed.push(operation.kind);
      },
    });

    expect(result.blockers).toContain('remove-worktree target changed during cleanup');
    expect(executed).toEqual([]);
  });

  it.each([
    { target: 'worktree', failedKind: 'remove-worktree', completed: [] },
    { target: 'remote branch', failedKind: 'delete-remote-ref', completed: ['remove-worktree'] },
    {
      target: 'local branch',
      failedKind: 'delete-local-ref',
      completed: ['remove-worktree', 'delete-remote-ref'],
    },
  ] as const)('$target failure reports the exact completed and unfinished suffix', testCase => {
    const initial = safeObservation();
    const afterWorktree = safeObservation({ worktrees: [worktree(0)] });
    const afterRemote = {
      ...afterWorktree,
      remote: undefined,
      remoteResolution: 'absent' as const,
    };
    const observations = [initial, initial, afterWorktree, afterWorktree, afterRemote, afterRemote];
    const plan = buildCleanupPlan(initial);

    const result = applyCleanupPlan({
      plan,
      digest: cleanupPlanDigest(plan),
      observe: () => observations.shift() ?? afterWorktree,
      execute: operation => {
        if (operation.kind === testCase.failedKind) throw new Error('lease rejected');
      },
    });

    expect(result).toMatchObject({
      applied: false,
      completed: testCase.completed,
      remaining: plan.operations.slice(testCase.completed.length).map(operation => operation.kind),
      blockers: [`${testCase.failedKind} failed: lease rejected`],
    });
  });

  it('runs each cleanup process from the operation surviving worktree', () => {
    const operation = buildCleanupPlan(safeObservation()).operations[1];
    if (!operation) throw new Error('fixture operation missing');
    const calls: { command: string; arguments_: string[]; cwd: string }[] = [];

    const result = executeCleanupOperation(operation, (command, arguments_, cwd) => {
      calls.push({ command, arguments_, cwd });
      return { status: 0, stdout: '', stderr: '' };
    });

    expect(result.status).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.cwd).toBe('/repo');
  });

  it('refuses worktree removal when HEAD changes at the execution boundary', () => {
    const operation = buildCleanupPlan(safeObservation()).operations[0];
    if (operation?.kind !== 'remove-worktree')
      throw new Error('fixture worktree operation missing');
    const calls: string[][] = [];

    let currentPath = operation.path;
    const registry = () =>
      [
        `worktree /repo\0HEAD ${'b'.repeat(40)}\0branch refs/heads/main\0`,
        `worktree ${currentPath}\0HEAD ${'a'.repeat(40)}\0branch refs/heads/feature/closeout\0`,
        '',
      ].join('\0');
    const result = executeCleanupOperation(
      operation,
      (_command, arguments_) => {
        calls.push(arguments_);
        if (arguments_.includes('list')) return { status: 0, stdout: registry(), stderr: '' };
        if (arguments_[3] === 'move') {
          currentPath = arguments_[5] ?? currentPath;
          return { status: 0, stdout: '', stderr: '' };
        }
        if (arguments_.includes('--absolute-git-dir')) {
          return { status: 0, stdout: `${operation.gitDirectory}\n`, stderr: '' };
        }
        return { status: 0, stdout: `${'c'.repeat(40)}\n`, stderr: '' };
      },
      path => ({ realPath: path, device: operation.device, inode: operation.inode }),
    );

    expect(result).toEqual({
      status: 1,
      stdout: '',
      stderr: 'worktree HEAD changed before removal',
    });
    expect(calls.some(call => call.slice(-2).join(' ') === 'rev-parse HEAD')).toBe(true);
    expect(currentPath).toBe(operation.path);
  });

  it('reports an explicit recovery failure when a quarantined worktree cannot be restored', () => {
    const operation = buildCleanupPlan(safeObservation()).operations[0];
    if (operation?.kind !== 'remove-worktree') throw new Error('fixture operation missing');
    let currentPath = operation.path;
    let moveCount = 0;
    const registry = () =>
      [
        `worktree /repo\0HEAD ${'b'.repeat(40)}\0branch refs/heads/main\0`,
        `worktree ${currentPath}\0HEAD ${operation.oid}\0branch refs/heads/${operation.branch}\0`,
        '',
      ].join('\0');

    const result = executeCleanupOperation(
      operation,
      (_command, arguments_) => {
        if (arguments_.includes('list')) return { status: 0, stdout: registry(), stderr: '' };
        if (arguments_[3] === 'move') {
          moveCount += 1;
          if (moveCount === 2) {
            return { status: 1, stdout: '', stderr: 'destination occupied' };
          }
          currentPath = arguments_[5] ?? currentPath;
          return { status: 0, stdout: '', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: 'unexpected command' };
      },
      path => ({ realPath: path, device: 99, inode: 99 }),
    );

    expect(result.stderr).toBe(
      'worktree filesystem identity changed before removal; worktree restoration failed: destination occupied',
    );
  });

  it.each([
    ['locked', `branch refs/heads/feature/closeout\0locked maintenance\0`],
    ['prunable', `branch refs/heads/feature/closeout\0prunable missing\0`],
    ['reassigned', `branch refs/heads/other\0`],
  ])('refuses a %s worktree registration at the execution boundary', (_state, changedField) => {
    const operation = buildCleanupPlan(safeObservation()).operations[0];
    if (operation?.kind !== 'remove-worktree') throw new Error('fixture operation missing');
    const registry = [
      `worktree /repo\0HEAD ${'b'.repeat(40)}\0branch refs/heads/main\0`,
      `worktree /repo-closeout\0HEAD ${operation.oid}\0${changedField}`,
      '',
    ].join('\0');

    const result = executeCleanupOperation(operation, () => ({
      status: 0,
      stdout: registry,
      stderr: '',
    }));

    expect(result.stderr).toBe('worktree registration changed before removal');
  });

  it('refuses a replaced or relocated worktree filesystem identity', () => {
    const operation = buildCleanupPlan(safeObservation()).operations[0];
    if (operation?.kind !== 'remove-worktree') throw new Error('fixture operation missing');
    const registry = [
      `worktree /repo\0HEAD ${'b'.repeat(40)}\0branch refs/heads/main\0`,
      `worktree /repo-closeout\0HEAD ${operation.oid}\0branch refs/heads/${operation.branch}\0`,
      '',
    ].join('\0');

    const result = executeCleanupOperation(
      operation,
      () => ({ status: 0, stdout: registry, stderr: '' }),
      () => ({ realPath: '/replacement', device: 9, inode: 9 }),
    );

    expect(result.stderr).toBe('worktree filesystem identity changed before removal');
  });

  it('distinguishes an absent remote ref from an unobservable remote', () => {
    expect(resolveRemoteReference({ status: 0, stdout: '', stderr: '' })).toEqual({
      resolution: 'absent',
    });
    expect(
      resolveRemoteReference({ status: 1, stdout: '', stderr: 'authentication failed' }),
    ).toEqual({
      resolution: 'unknown',
    });
    expect(
      resolveRemoteReference({
        status: 0,
        stdout: `${'a'.repeat(40)}\trefs/heads/topic\n`,
        stderr: '',
      }),
    ).toEqual({ resolution: 'matched', oid: 'a'.repeat(40) });
    expect(
      resolveRemoteReference(
        {
          status: 0,
          stdout: `${'b'.repeat(40)}\trefs/heads/decoy\n${'a'.repeat(40)}\trefs/heads/topic\n`,
          stderr: '',
        },
        'refs/heads/topic',
      ),
    ).toEqual({ resolution: 'unknown' });
  });

  it.each([
    ['option-like leading dash', '-topic'],
    ['whitespace and control characters', 'refs/heads/topic with space\nnext'],
    ['shell metacharacters', 'refs/heads/topic; touch /tmp/closeout-injection'],
  ])('passes untrusted %s text as one shell-disabled argv element', (_case, hostileReference) => {
    const calls: { command: string; arguments_: string[]; cwd: string }[] = [];

    const result = executeCleanupOperation(
      { kind: 'delete-local-ref', cwd: '/repo', ref: hostileReference, oid: 'a'.repeat(40) },
      (command, arguments_, cwd) => {
        calls.push({ command, arguments_, cwd });
        return { status: 0, stdout: '', stderr: '' };
      },
    );

    expect(result.status).toBe(0);
    expect(calls).toEqual([
      {
        command: 'git',
        arguments_: ['-C', '/repo', 'update-ref', '-d', hostileReference, 'a'.repeat(40)],
        cwd: '/repo',
      },
    ]);
  });

  it('executes the exact cleanup commands against a real linked git worktree and remote', () => {
    const sandbox = mkdtempSync(nodePath.join(tmpdir(), 'safeword-closeout-git-'));
    const main = nodePath.join(sandbox, 'main');
    const topic = nodePath.join(sandbox, 'topic');
    const remote = nodePath.join(sandbox, 'remote.git');
    try {
      runGit('init', '--bare', remote);
      runGit('init', '--initial-branch=main', main);
      runGit('-C', main, 'config', 'user.email', 'closeout@example.test');
      runGit('-C', main, 'config', 'user.name', 'Closeout Test');
      writeFileSync(nodePath.join(main, 'README.md'), 'main\n');
      runGit('-C', main, 'add', 'README.md');
      runGit('-C', main, 'commit', '-m', 'main');
      runGit('-C', main, 'remote', 'add', 'origin', remote);
      runGit('-C', main, 'push', '-u', 'origin', 'main');
      runGit('-C', main, 'worktree', 'add', '-b', 'feature/closeout', topic);
      writeFileSync(nodePath.join(topic, 'feature.txt'), 'topic\n');
      runGit('-C', topic, 'add', 'feature.txt');
      runGit('-C', topic, 'commit', '-m', 'topic');
      runGit('-C', topic, 'push', '-u', 'origin', 'feature/closeout');
      const oid = runGit('-C', topic, 'rev-parse', 'HEAD');
      const canonicalMain = realpathSync(main);
      const canonicalTopic = realpathSync(topic);
      const discoveredWorktrees = parseWorktrees(main);
      const mainWorktree = discoveredWorktrees.find(candidate => candidate.path === canonicalMain);
      const topicWorktree = discoveredWorktrees.find(
        candidate => candidate.path === canonicalTopic,
      );
      if (!mainWorktree || !topicWorktree) throw new Error('real worktree identity missing');
      const baseline = safeObservation({
        deliveryWorktreePath: canonicalTopic,
        pullRequests: [{ ...pullRequest(), headRefOid: oid }],
        remote: {
          name: 'origin',
          url: 'git@github.com:acme/widget.git',
          pushUrl: 'git@github.com:acme/widget.git',
          oid,
        },
        localRefOid: oid,
        worktrees: [mainWorktree, topicWorktree],
        verification: { current: true, passed: true, headOid: oid, stateHash: 'real-git' },
      });
      const afterWorktree = { ...baseline, worktrees: [mainWorktree] };
      const afterRemote = {
        ...afterWorktree,
        remote: undefined,
        remoteResolution: 'absent' as const,
      };
      const afterLocal = { ...afterRemote, localRefOid: undefined };
      const observations = [
        baseline,
        baseline,
        afterWorktree,
        afterWorktree,
        afterRemote,
        afterRemote,
        afterLocal,
      ];
      const plan = buildCleanupPlan(baseline);
      const result = applyCleanupPlan({
        plan,
        digest: cleanupPlanDigest(plan),
        observe: () => observations.shift() ?? afterLocal,
        execute: operation => {
          const execution = executeCleanupOperation(operation, (command, arguments_, cwd) => {
            const localArguments =
              operation.kind === 'delete-remote-ref'
                ? arguments_.map(argument =>
                    argument === operation.pushUrl ? operation.remote : argument,
                  )
                : arguments_;
            const processResult = spawnSync(command, localArguments, { cwd, encoding: 'utf8' });
            return {
              status: processResult.status ?? 1,
              stdout: processResult.stdout ?? '',
              stderr: processResult.stderr ?? processResult.error?.message ?? '',
            };
          });
          if (execution.status !== 0) throw new Error(execution.stderr);
        },
      });

      expect(result.applied).toBe(true);
      expect(existsSync(topic)).toBe(false);
      expect(runGit('-C', main, 'ls-remote', '--heads', 'origin', 'feature/closeout')).toBe('');
      expect(
        spawnSync('git', ['-C', main, 'show-ref', '--verify', 'refs/heads/feature/closeout'])
          .status,
      ).not.toBe(0);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('refreshes retro and converges through the public CLI when the Codex transcript grows', () => {
    const sandbox = mkdtempSync(nodePath.join(tmpdir(), 'safeword-closeout-cli-wiring-'));
    const bare = nodePath.join(sandbox, 'remote.git');
    const main = nodePath.join(sandbox, 'main');
    const topic = nodePath.join(sandbox, 'topic');
    const bin = nodePath.join(sandbox, 'bin');
    const transcript = nodePath.join(sandbox, 'codex-thread-42.jsonl');
    const fakeSafeword = nodePath.join(sandbox, 'fake-safeword.ts');
    const retroLog = nodePath.join(sandbox, 'retro.log');
    const verificationLog = nodePath.join(sandbox, 'verification.log');
    const script = nodePath.join(repoRoot, 'packages/cli/templates/scripts/closeout-cleanup.ts');
    try {
      runGit('init', '--bare', bare);
      runGit('init', '--initial-branch=main', main);
      runGit('-C', main, 'config', 'user.email', 'closeout@example.test');
      runGit('-C', main, 'config', 'user.name', 'Closeout Test');
      mkdirSync(nodePath.join(main, '.safeword'), { recursive: true });
      writeFileSync(nodePath.join(main, '.safeword', 'SAFEWORD.md'), '# SafeWord\n');
      writeFileSync(nodePath.join(main, 'README.md'), 'main\n');
      runGit('-C', main, 'add', '.');
      runGit('-C', main, 'commit', '-m', 'main');
      runGit('-C', main, 'remote', 'add', 'origin', 'git@github.com:acme/widget.git');
      runGit('-C', main, 'worktree', 'add', '-b', 'feature/closeout', topic);
      writeFileSync(nodePath.join(topic, 'topic.txt'), 'topic\n');
      runGit('-C', topic, 'add', 'topic.txt');
      runGit('-C', topic, 'commit', '-m', 'topic');
      const oid = runGit('-C', topic, 'rev-parse', 'HEAD');
      runGit('-C', main, 'push', `file://${bare}`, 'main:main');
      runGit('-C', topic, 'push', `file://${bare}`, 'feature/closeout:feature/closeout');

      mkdirSync(bin);
      const gh = nodePath.join(bin, 'gh');
      const ssh = nodePath.join(bin, 'ssh');
      const pullRequestJson = JSON.stringify({
        url: 'https://github.com/acme/widget/pull/42',
        state: 'MERGED',
        headRefName: 'feature/closeout',
        headRefOid: oid,
        headRepositoryOwner: { login: 'acme' },
        headRepository: { name: 'widget' },
        statusCheckRollup: [{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS' }],
      });
      writeFileSync(
        gh,
        `#!/usr/bin/env bun\nconst args = process.argv.slice(2).join(' ');\nif (args.startsWith('pr view ')) console.log(${JSON.stringify(pullRequestJson)});\nelse if (args.startsWith('pr checks ')) console.log('[]');\nelse if (args.startsWith('repo view ')) console.log(JSON.stringify({ defaultBranchRef: { name: 'main' } }));\nelse if (args.startsWith('api ')) console.log(JSON.stringify({ protected: false }));\nelse process.exit(1);\n`,
      );
      chmodSync(gh, 0o755);
      writeFileSync(
        ssh,
        `#!/bin/sh\nfor argument do command="$argument"; done\ncase "$command" in\n  "git-upload-pack 'acme/widget.git'") exec git-upload-pack "$SAFEWORD_TEST_BARE" ;;\n  "git-receive-pack 'acme/widget.git'") exec git-receive-pack "$SAFEWORD_TEST_BARE" ;;\n  *) exit 1 ;;\nesac\n`,
      );
      chmodSync(ssh, 0o755);
      writeFileSync(
        fakeSafeword,
        `import { appendFileSync } from 'node:fs';\nconst args = process.argv.slice(2);\nif (args[0] === 'project' && args[1] === 'test-plan') {\n  appendFileSync(process.env.SAFEWORD_TEST_VERIFICATION_LOG ?? '', args.join(' ') + '\\n');\n  process.stdout.write(JSON.stringify([{ available: true, command: 'true', cwd: process.cwd() }]));\n} else {\n  appendFileSync(process.env.SAFEWORD_TEST_RETRO_LOG ?? '', 'run\\n');\n  process.stdout.write(JSON.stringify({ state: 'healthy', data: { agent_filing_needed: process.env.SAFEWORD_TEST_RETRO_INCOMPLETE === '1' }, errors: [] }));\n}\n`,
      );
      writeFileSync(
        transcript,
        `${JSON.stringify({ type: 'session_meta', payload: { id: 'codex-thread-42' } })}\n`,
      );
      rememberCloseoutBinding({
        projectDirectory: topic,
        runtime: 'codex',
        id: 'codex-thread-42',
        transcriptPath: transcript,
      });

      const environment = {
        ...process.env,
        CODEX_THREAD_ID: 'codex-thread-42',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_SYSTEM: '/dev/null',
        HOME: sandbox,
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        SAFEWORD_CLI: fakeSafeword,
        GIT_SSH_COMMAND: ssh,
        SAFEWORD_TEST_BARE: bare,
        SAFEWORD_TEST_RETRO_LOG: retroLog,
        SAFEWORD_TEST_VERIFICATION_LOG: verificationLog,
      };
      const preview = spawnSync('bun', [script, '--pr', '42'], {
        cwd: topic,
        encoding: 'utf8',
        env: environment,
      });
      expect(preview.status, `${preview.stderr}\n${preview.stdout}`).toBe(0);
      expect(existsSync(verificationLog)).toBe(true);
      const digest = (JSON.parse(preview.stdout) as { digest: string }).digest;
      writeFileSync(
        transcript,
        `${JSON.stringify({ type: 'message', role: 'user', text: 'new unresolved friction' })}\n`,
        {
          flag: 'a',
        },
      );
      rememberCloseoutBinding({
        projectDirectory: topic,
        runtime: 'codex',
        id: 'codex-thread-42',
        transcriptPath: transcript,
      });

      const apply = spawnSync('bun', [script, '--pr', '42', '--yes', '--plan', digest], {
        cwd: topic,
        encoding: 'utf8',
        env: { ...environment, SAFEWORD_TEST_RETRO_INCOMPLETE: '1' },
      });

      expect(apply.status, apply.stderr).toBe(0);
      const applyResult = JSON.parse(apply.stdout) as {
        digest: string;
        plan: { advisories: string[] };
        result: { applied: boolean };
      };
      expect(applyResult.digest).toBe(digest);
      expect(applyResult.result.applied).toBe(true);
      expect(applyResult.plan.advisories).toContain(
        'retrospective filing failed; resolve the filing failure',
      );
      expect(existsSync(topic)).toBe(false);
      expect(readFileSync(retroLog, 'utf8').trim().split('\n')).toHaveLength(2);
      expect(runGit('-C', main, 'ls-remote', '--heads', `file://${bare}`, 'feature/closeout')).toBe(
        '',
      );
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('preserves a live topic worktree whose path contains blank lines', () => {
    const sandbox = mkdtempSync(nodePath.join(tmpdir(), 'safeword-closeout-newline-'));
    const main = nodePath.join(sandbox, 'main');
    const topic = nodePath.join(sandbox, 'topic\n\nwith-blank-line');
    try {
      runGit('init', '--initial-branch=main', main);
      runGit('-C', main, 'config', 'user.email', 'closeout@example.test');
      runGit('-C', main, 'config', 'user.name', 'Closeout Test');
      writeFileSync(nodePath.join(main, 'README.md'), 'main\n');
      runGit('-C', main, 'add', 'README.md');
      runGit('-C', main, 'commit', '-m', 'main');
      runGit('-C', main, 'worktree', 'add', '-b', 'feature/closeout', topic);

      const worktrees = parseWorktrees(main);
      const canonicalTopic = realpathSync(topic);
      expect(worktrees.map(candidate => candidate.path)).toContain(canonicalTopic);
      const oid = runGit('-C', topic, 'rev-parse', 'HEAD');
      const plan = buildCleanupPlan(
        safeObservation({
          deliveryWorktreePath: main,
          pullRequests: [{ ...pullRequest(), headRefOid: oid }],
          localRefOid: oid,
          remote: undefined,
          remoteResolution: 'absent',
          worktrees,
          verification: { current: true, passed: true, headOid: oid, stateHash: 'newline' },
        }),
      );
      expect(plan.blockers).toContain(
        `the topic branch is used by a different worktree: ${canonicalTopic}`,
      );
      expect(plan.operations).toEqual([]);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('discovers a linked default-branch survivor after the primary worktree is detached', () => {
    const sandbox = mkdtempSync(nodePath.join(tmpdir(), 'safeword-closeout-detached-main-'));
    const primary = nodePath.join(sandbox, 'primary');
    const surviving = nodePath.join(sandbox, 'surviving-main');
    const topic = nodePath.join(sandbox, 'topic');
    try {
      runGit('init', '--initial-branch=main', primary);
      runGit('-C', primary, 'config', 'user.email', 'closeout@example.test');
      runGit('-C', primary, 'config', 'user.name', 'Closeout Test');
      writeFileSync(nodePath.join(primary, 'README.md'), 'main\n');
      runGit('-C', primary, 'add', 'README.md');
      runGit('-C', primary, 'commit', '-m', 'main');
      runGit('-C', primary, 'checkout', '--detach');
      runGit('-C', primary, 'worktree', 'add', surviving, 'main');
      runGit('-C', primary, 'worktree', 'add', '-b', 'feature/closeout', topic);

      const worktrees = parseWorktrees(primary);
      const primaryWorktree = {
        path: realpathSync(primary),
        branch: '',
        main: true,
      };
      const survivingWorktree = {
        path: realpathSync(surviving),
        branch: 'main',
        main: false,
      };
      const topicWorktree = {
        path: realpathSync(topic),
        branch: 'feature/closeout',
        main: false,
      };
      expect(worktrees).toEqual(
        expect.arrayContaining([
          expect.objectContaining(primaryWorktree),
          expect.objectContaining(survivingWorktree),
          expect.objectContaining(topicWorktree),
        ]),
      );

      const oid = runGit('-C', topic, 'rev-parse', 'HEAD');
      const plan = buildCleanupPlan(
        safeObservation({
          deliveryWorktreePath: realpathSync(topic),
          pullRequests: [{ ...pullRequest(), headRefOid: oid }],
          localRefOid: oid,
          remote: undefined,
          remoteResolution: 'absent',
          worktrees,
          verification: { current: true, passed: true, headOid: oid, stateHash: 'detached-main' },
        }),
      );

      expect(plan.blockers).toEqual([]);
      expect(plan.operations.every(operation => operation.cwd === realpathSync(surviving))).toBe(
        true,
      );
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('blocks instead of silently abandoning a detached delivery worktree', () => {
    const detached = { ...worktree(1), branch: '' };
    const plan = buildCleanupPlan(
      safeObservation({
        deliveryWorktreePath: detached.path,
        worktrees: [worktree(0), detached],
      }),
    );

    expect(plan.blockers).toContain(`the delivery worktree is detached: ${detached.path}`);
    expect(plan.operations).toEqual([]);
  });

  it('accepts an exact bound session after its original worktree is removed', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-closeout-transcript-'));
    const otherRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-closeout-other-'));
    const originalWorktree = mkdtempSync(nodePath.join(tmpdir(), 'safeword-closeout-original-'));
    const transcript = nodePath.join(root, 'transcript.jsonl');
    mkdirSync(nodePath.join(root, '.project'));
    writeFileSync(
      transcript,
      `${JSON.stringify({ type: 'user', sessionId: 'session-42', cwd: originalWorktree })}\n`,
    );
    rmSync(originalWorktree, { recursive: true, force: true });

    try {
      expect(
        transcriptMatchesBinding(
          transcript,
          { runtime: 'claude', id: 'session-42', projectRoot: root },
          root,
        ),
      ).toBe(true);
      expect(
        transcriptMatchesBinding(
          transcript,
          { runtime: 'claude', id: 'other-session', projectRoot: root },
          root,
        ),
      ).toBe(false);
      expect(
        transcriptMatchesBinding(
          transcript,
          { runtime: 'claude', id: 'session-42', projectRoot: root },
          otherRoot,
        ),
      ).toBe(false);

      const spoofedText = ['session-42', root].join(' ');
      writeFileSync(transcript, `${JSON.stringify({ type: 'message', text: spoofedText })}\n`);
      expect(
        transcriptMatchesBinding(
          transcript,
          { runtime: 'claude', id: 'session-42', projectRoot: root },
          root,
        ),
      ).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(otherRoot, { recursive: true, force: true });
    }
  });

  it('accepts a Codex transcript across linked worktrees but rejects a separate clone', () => {
    const sandbox = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-ownership-'));
    const primary = nodePath.join(sandbox, 'primary');
    const linked = nodePath.join(sandbox, 'linked');
    const clone = nodePath.join(sandbox, 'clone');
    const transcript = nodePath.join(sandbox, 'rollout-thread-42.jsonl');
    try {
      runGit('init', '--quiet', primary);
      runGit('-C', primary, 'config', 'user.email', 'test@example.com');
      runGit('-C', primary, 'config', 'user.name', 'Test');
      writeFileSync(nodePath.join(primary, 'README.md'), 'fixture\n');
      runGit('-C', primary, 'add', 'README.md');
      runGit('-C', primary, 'commit', '--quiet', '-m', 'fixture');
      runGit('-C', primary, 'branch', 'linked-branch');
      runGit('-C', primary, 'worktree', 'add', '--quiet', linked, 'linked-branch');
      runGit('clone', '--quiet', primary, clone);
      writeFileSync(
        transcript,
        `${JSON.stringify({ type: 'session_meta', sessionId: 'thread-42', cwd: linked })}\n`,
      );

      expect(
        transcriptMatchesBinding(
          transcript,
          { runtime: 'codex', id: 'thread-42', projectRoot: primary },
          primary,
        ),
      ).toBe(true);
      expect(
        transcriptMatchesBinding(
          transcript,
          { runtime: 'codex', id: 'thread-42', projectRoot: clone },
          clone,
        ),
      ).toBe(false);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('accepts a real Cursor transcript only when its canonical path matches the bound id', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-cursor-transcript-'));
    const id = 'c2f6d84a-473f-47a3-824d-1107b75f23ce';
    const directory = nodePath.join(root, 'agent-transcripts', id);
    const transcript = nodePath.join(directory, `${id}.jsonl`);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      transcript,
      `${JSON.stringify({ role: 'user', message: { content: [{ type: 'text', text: 'hello' }] } })}\n`,
    );

    expect(
      transcriptMatchesBinding(transcript, { runtime: 'cursor', id, projectRoot: root }, root),
    ).toBe(true);
    expect(
      transcriptMatchesBinding(
        transcript,
        { runtime: 'cursor', id: 'different-id', projectRoot: root },
        root,
      ),
    ).toBe(false);
    expect(
      transcriptMatchesBinding(
        nodePath.join(directory, 'subagents', `${id}.jsonl`),
        { runtime: 'cursor', id, projectRoot: root },
        root,
      ),
    ).toBe(false);
  });
});
