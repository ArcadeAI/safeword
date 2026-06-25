/**
 * Cursor preToolUse edit-gate parity (F2TKR3 / T3DV1K).
 *
 * After F2TKR3 we removed the prompt-send (`beforeSubmitPrompt`) block — it could
 * see only prompt text, so it deadlocked the very prompt that asks the agent to
 * create test-definitions.md. The implement-phase rule now lives ONLY at the edit
 * layer (`preToolUse`), spawning the same Claude gate as the source of truth.
 *
 * These tests pin the behaviour that made that move safe:
 *  - the rule is still enforced on an application-code write (block preserved);
 *  - meta/project writes are exempt, so there is no catch-22 (you can still work
 *    on scenarios/tickets while at implement without test-definitions);
 *  - the gate is session-bound — with no ticket bound in session state it allows,
 *    exactly matching Claude (it does NOT fall back to a global mtime scan, which
 *    was the cross-ticket bug in the removed prompt-send hook);
 *  - non-edit tools short-circuit to allow.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ADAPTER = nodePath.resolve(__dirname, '../../templates/hooks/cursor/pre-tool-quality.ts');

const TICKET_ID = 'CUR123';
const TICKET_FOLDER = `${TICKET_ID}-cursor-gate`;
const SESSION_ID = 'conv-1';

interface CursorDecision {
  permission?: string;
  user_message?: string;
}

/**
 * Spawn the Cursor preToolUse adapter with a Cursor-shaped payload and return its
 * decision. SAFEWORD_AGENT_RUNTIME is cleared so the spawned gate resolves session
 * state at the raw conversation_id path — the same path this test seeds, and the
 * same one the production Cursor adapters use (neither sets that env var).
 */
function runAdapter(
  projectRoot: string,
  options: { toolName?: string; filePath?: string; content?: string } = {},
): CursorDecision {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_PROJECT_DIR: projectRoot,
    // Pin the CLI to repo source so the done-gate's test-runner resolves locally
    // (no `bunx safeword` network fetch); an empty temp project yields no test
    // command, so the suite is skipped and verify.md/scenarios carry the verdict.
    SAFEWORD_CLI: nodePath.resolve(__dirname, '../../src/cli.ts'),
  };
  delete env.SAFEWORD_AGENT_RUNTIME;

  const toolInput: Record<string, unknown> = {};
  if (options.filePath) toolInput.file_path = options.filePath;
  if (options.content !== undefined) toolInput.content = options.content;

  const result = spawnSync('bun', [ADAPTER], {
    cwd: projectRoot,
    input: JSON.stringify({
      conversation_id: SESSION_ID,
      tool_name: options.toolName ?? 'Write',
      tool_input: toolInput,
      workspace_roots: [projectRoot],
    }),
    encoding: 'utf8',
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  try {
    return JSON.parse(result.stdout ?? '{}') as CursorDecision;
  } catch {
    return {};
  }
}

function writeFeatureAtImplement(ticketDirectory: string): void {
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    [
      '---',
      `id: ${TICKET_ID}`,
      'slug: cursor-gate',
      'type: feature',
      'phase: implement',
      'status: in_progress',
      '---',
      '',
    ].join('\n'),
  );
}

/** Bind the ticket in session state, the way a prior ticket.md edit would have. */
function seedActiveTicket(projectRoot: string): void {
  writeFileSync(
    nodePath.join(projectRoot, '.project', `quality-state-${SESSION_ID}.json`),
    // `gate` is deliberately omitted (absent reads as falsy, like the real null);
    // the eslint config forbids literal null in test sources.
    JSON.stringify({
      locSinceCommit: 0,
      lastCommitHash: '',
      activeTicket: TICKET_ID,
      recentFailures: [],
      incrementedPatterns: [],
    }),
  );
}

describe('Cursor preToolUse edit-gate parity (F2TKR3)', () => {
  let projectRoot: string;
  let ticketDirectory: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'cursor-pretooluse-'));
    mkdirSync(nodePath.join(projectRoot, '.safeword'), { recursive: true });
    ticketDirectory = nodePath.join(projectRoot, '.project', 'tickets', TICKET_FOLDER);
    mkdirSync(ticketDirectory, { recursive: true });
    writeFeatureAtImplement(ticketDirectory);
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('denies an application-code write when the bound feature has no test-definitions.md', () => {
    seedActiveTicket(projectRoot);

    const decision = runAdapter(projectRoot, { filePath: 'src/app.ts' });

    expect(decision.permission).toBe('deny');
    expect(decision.user_message).toContain('test-definitions.md');
  });

  it('allows meta/project writes so scenario work is never deadlocked', () => {
    seedActiveTicket(projectRoot);

    // A write under .project/ (where test-definitions.md also lives) is exempt
    // from the implement gate — the catch-22 the removed prompt-send hook caused.
    const decision = runAdapter(projectRoot, {
      filePath: `.project/tickets/${TICKET_FOLDER}/notes.md`,
    });

    expect(decision.permission).toBe('allow');
  });

  it('allows when no ticket is bound in session state (session-bound, Claude parity)', () => {
    // No seedActiveTicket: the gate reads no state, so it does NOT block — it must
    // not fall back to the global most-recent-ticket scan the old hook used.
    const decision = runAdapter(projectRoot, { filePath: 'src/app.ts' });

    expect(decision.permission).toBe('allow');
  });

  it('short-circuits to allow for non-edit tools', () => {
    seedActiveTicket(projectRoot);

    const decision = runAdapter(projectRoot, { toolName: 'Read', filePath: 'src/app.ts' });

    expect(decision.permission).toBe('allow');
  });
});

/**
 * Cursor done-edit gate (AKNWZK). Cursor's `stop` cannot block, so closing a
 * ticket is gated at the edit that flips ticket.md to `status: done`. The temp
 * project has no package.json, so the test suite is skipped (no command found) and
 * the verify.md / scenario checks carry the verdict — exactly what we want to pin.
 */
describe('Cursor done-edit gate (AKNWZK)', () => {
  let projectRoot: string;
  let ticketDirectory: string;
  const ticketRelativePath = `.project/tickets/${TICKET_FOLDER}/ticket.md`;

  const doneFrontmatter = (type: string): string =>
    [
      '---',
      `id: ${TICKET_ID}`,
      'slug: cursor-gate',
      `type: ${type}`,
      'phase: done',
      'status: done',
      '---',
      '',
    ].join('\n');

  const validVerify = '# Verify\n\n**PR Scope:** ✅ Diff matches ticket scope\n';

  beforeEach(() => {
    projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'cursor-done-'));
    mkdirSync(nodePath.join(projectRoot, '.safeword'), { recursive: true });
    ticketDirectory = nodePath.join(projectRoot, '.project', 'tickets', TICKET_FOLDER);
    mkdirSync(ticketDirectory, { recursive: true });
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('denies the close edit when verified file_path/content fields show missing verify.md', () => {
    const decision = runAdapter(projectRoot, {
      filePath: ticketRelativePath,
      content: doneFrontmatter('task'),
    });

    expect(decision.permission).toBe('deny');
    expect(decision.user_message).toContain('verify.md');
  });

  it('denies a ticket status edit safeword can read but cannot classify', () => {
    const decision = runAdapter(projectRoot, {
      filePath: ticketRelativePath,
      content: [
        '---',
        `id: ${TICKET_ID}`,
        'slug: cursor-gate',
        'type: task',
        'phase: done',
        'status:',
        '---',
        '',
      ].join('\n'),
    });

    expect(decision.permission).toBe('deny');
    expect(decision.user_message).toContain('could not parse');
  });

  it('allows an unreadable ticket.md edit instead of blocking ordinary work-log saves', () => {
    const decision = runAdapter(projectRoot, {
      filePath: ticketRelativePath,
    });

    expect(decision.permission).toBe('allow');
  });

  it('allows the close edit for a task with a valid verify.md', () => {
    writeFileSync(nodePath.join(ticketDirectory, 'verify.md'), validVerify);

    const decision = runAdapter(projectRoot, {
      filePath: ticketRelativePath,
      content: doneFrontmatter('task'),
    });

    expect(decision.permission).toBe('allow');
  });

  it('denies a feature close when scenarios are incomplete', () => {
    writeFileSync(nodePath.join(ticketDirectory, 'verify.md'), validVerify);
    writeFileSync(
      nodePath.join(ticketDirectory, 'test-definitions.md'),
      '## Rule: x\n- [x] done one\n- [ ] not yet\n',
    );

    const decision = runAdapter(projectRoot, {
      filePath: ticketRelativePath,
      content: doneFrontmatter('feature'),
    });

    expect(decision.permission).toBe('deny');
    expect(decision.user_message).toContain('scenarios');
  });

  it('allows a feature close when verify.md and all scenarios are complete', () => {
    writeFileSync(nodePath.join(ticketDirectory, 'verify.md'), validVerify);
    writeFileSync(
      nodePath.join(ticketDirectory, 'test-definitions.md'),
      '## Rule: x\n- [x] done one\n- [x] done two\n',
    );

    const decision = runAdapter(projectRoot, {
      filePath: ticketRelativePath,
      content: doneFrontmatter('feature'),
    });

    expect(decision.permission).toBe('allow');
  });

  it('does not gate a ticket.md edit that only sets phase: done (not closing)', () => {
    // Entering the done phase to run /verify is not a close — it must be allowed,
    // otherwise the agent can never produce the evidence the close later needs.
    const enteringDone = [
      '---',
      `id: ${TICKET_ID}`,
      'slug: cursor-gate',
      'type: task',
      'phase: done',
      'status: in_progress',
      '---',
      '',
    ].join('\n');

    const decision = runAdapter(projectRoot, {
      filePath: ticketRelativePath,
      content: enteringDone,
    });

    expect(decision.permission).toBe('allow');
  });
});
