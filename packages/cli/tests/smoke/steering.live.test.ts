/**
 * Live real-model smoke (ticket 0WQA9V). Drives a REAL Claude Code agent into
 * safeword's intake-phase gate and asserts the agent was actually steered —
 * i.e. the gate denied its Write tool call. This is the one tier that proves
 * the shipping hooks steer a live agent, not just that the hook code returns
 * "deny" when fed fake JSON (that's the deterministic tiers' job).
 *
 * Excluded from the default suite (`*.live.test.ts`, see vitest.config.ts) and
 * skipped unless a claude >= 2.x binary AND ANTHROPIC_API_KEY are present, so it
 * never breaks a normal `bun run test`. Run it with `bun run test:smoke:live`.
 * Costs ~1.5¢/run (pinned Haiku); `--max-budget-usd` is the hard ceiling.
 *
 * Why these choices (all verified against claude 2.1.161 this session):
 * - intake-phase gate, NOT the 9EA27P spec.md gate — intake is a stable, long-
 *   standing invariant; 9EA27P isn't on main yet and would silently allow.
 * - point the project's hook at the real source hook (no `safeword setup`) —
 *   same shipping code, no 180s install (golden-path already covers install).
 * - `--allowedTools Write` lets the permission layer ALLOW the write, so the
 *   only thing that can deny it is the hook — that's what makes a denial proof
 *   of steering rather than a permission artifact.
 * - assert on `permission_denials`, not "file absent": a model that simply
 *   declines to act also leaves no file (false pass).
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Pinned so a model update can't silently change the test's behavior. Dated
 * snapshot — when Anthropic retires it the run fails model-not-found, which is
 * the signal to bump the pin (not a safeword regression).
 */
const MODEL = 'claude-haiku-4-5-20251001';
/** The flags below (`--setting-sources`, `--max-budget-usd`) need claude 2.x. */
const MIN_MAJOR = 2;
/** The real shipping hook, run in place — no copy, no build. */
const HOOK_PATH = nodePath.resolve(__dirname, '../../templates/hooks/pre-tool-quality.ts');

/**
 * Resolve a runnable claude: `SMOKE_CLAUDE_BIN` override first, then PATH —
 * but validate each with `--version` (PATH may hold a broken launcher stub) and
 * require >= 2.x (older claude lacks the flags this test uses). Undefined => skip.
 */
function resolveClaude(): string | undefined {
  for (const bin of [process.env.SMOKE_CLAUDE_BIN, 'claude'].filter(Boolean) as string[]) {
    const probe = spawnSync(bin, ['--version'], { encoding: 'utf8' });
    const major = /(\d+)\.\d+\.\d+/.exec(probe.stdout ?? '');
    if (probe.status === 0 && major && Number(major[1]) >= MIN_MAJOR) return bin;
  }
  return undefined;
}

const CLAUDE = resolveClaude();
const CAN_RUN = Boolean(CLAUDE && process.env.ANTHROPIC_API_KEY);

describe.skipIf(!CAN_RUN)('live smoke: safeword steers a real Claude agent', () => {
  let projectDirectory: string;
  const ticketRelative = '.safeword-project/tickets/SMOKE01-intake';

  beforeAll(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-live-'));
    // Minimal fixture: an intake-phase ticket. Creating test-definitions.md
    // while still in intake is denied by a core, long-standing gate.
    const ticketDirectory = nodePath.join(projectDirectory, ticketRelative);
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(ticketDirectory, 'ticket.md'),
      [
        '---',
        'id: SMOKE01',
        'type: task',
        'phase: intake',
        'scope: prove a live agent is steered',
        'out_of_scope: nothing',
        'done_when: the gate denies the write',
        '---',
        '# Live smoke fixture',
        '',
      ].join('\n'),
    );
    // Wire the REAL source hook into the throwaway project.
    mkdirSync(nodePath.join(projectDirectory, '.claude'), { recursive: true });
    writeFileSync(
      nodePath.join(projectDirectory, '.claude', 'settings.json'),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            { matcher: 'Write', hooks: [{ type: 'command', command: `bun "${HOOK_PATH}"` }] },
          ],
        },
      }),
    );
  });

  afterAll(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  it('denies the agent writing test-definitions.md while the ticket is in intake', () => {
    // The suite's CAN_RUN guard already ensures a resolved binary; narrow for the type system.
    if (!CLAUDE) throw new Error('unreachable: CAN_RUN already guards binary presence');
    const result = spawnSync(
      CLAUDE,
      [
        '-p',
        `Create the file ${ticketRelative}/test-definitions.md with exactly this content: "# Test Definitions". You must use the Write tool.`,
        '--setting-sources',
        'project',
        '--allowedTools',
        'Write',
        '--model',
        MODEL,
        '--max-budget-usd',
        '0.10',
        '--output-format',
        'json',
      ],
      { cwd: projectDirectory, encoding: 'utf8', env: process.env, timeout: 120_000 },
    );

    expect(result.status, `claude exited non-zero:\n${result.stderr}`).toBe(0);

    const output = JSON.parse(result.stdout) as {
      permission_denials?: { tool_name?: string }[];
    };
    const deniedWrite = (output.permission_denials ?? []).some(d => d.tool_name === 'Write');

    expect(
      deniedWrite,
      `Expected safeword's hook to deny the agent's Write. permission_denials=${JSON.stringify(
        output.permission_denials,
      )}`,
    ).toBe(true);
  });
});
