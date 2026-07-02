#!/usr/bin/env bun
// Safeword: invisible Codex retro auto-trigger (ticket CDX602 / issue #602).
//
// Codex skips async hooks, so this Stop hook runs the retro extraction
// synchronously and emits NOTHING. There is no {decision:"block"} continuation:
// Lane 2 surfacing for unfiled drafts belongs to the separate UserPromptSubmit
// prompt-retro-nudge hook. The child path marks itself with SAFEWORD_RETRO_CHILD
// so a headless `codex exec` process cannot recursively re-fire Stop.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { RETRO_CHILD_ENV, retroChildArgs } from '../lib/retro-extract.ts';
import {
  countToolUsesCodex,
  decideRetroRun,
  type OffsetState,
  resolveCodexSessionId,
  type RetroTriggerInput,
  writeOffsetState,
} from '../lib/retro-trigger.ts';
import { readSelfReportConfig } from '../lib/self-report.ts';

interface CodexStopInput extends RetroTriggerInput {
  cwd?: string;
}

/**
 * The command that runs the extraction CLI. Prefer the dogfood local CLI, else
 * `bunx safeword@latest`; the spawned CLI then launches `codex exec` through the
 * shared auto-extract boundary.
 */
function resolveExtractCommand(
  projectDirectory: string,
  decision: { transcriptPath: string; windowStart: number; sessionId: string },
): [string, string[]] {
  const retroArgs = retroChildArgs(decision);
  const localCli = nodePath.join(projectDirectory, 'packages/cli/src/cli.ts');
  return existsSync(localCli)
    ? ['bun', [localCli, ...retroArgs]]
    : ['bunx', ['safeword@latest', ...retroArgs]];
}

async function main(): Promise<void> {
  let input: CodexStopInput;
  try {
    input = (await Bun.stdin.json()) as CodexStopInput;
  } catch {
    return; // malformed stdin / no stdin -> silent fail-open
  }

  const projectDirectory = input.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  if (!readSelfReportConfig(projectDirectory).surface) return;

  let pendingOffsetState:
    | { sessionId: string; state: OffsetState; baseDirectory: string | undefined }
    | undefined;
  const decision = decideRetroRun(input, {
    env: process.env,
    countToolUses: countToolUsesCodex,
    resolveSessionId: resolveCodexSessionId,
    writeOffsetState: (sessionId, state, baseDirectory) => {
      pendingOffsetState = { sessionId, state, baseDirectory };
    },
  });
  if (!decision) return;

  const [command, args] = resolveExtractCommand(projectDirectory, decision);
  const result = spawnSync(command, args, {
    cwd: projectDirectory,
    env: {
      ...process.env,
      SAFEWORD_RETRO_AGENT: 'codex',
      [RETRO_CHILD_ENV]: '1',
    },
    stdio: 'ignore',
    timeout: 600_000,
  });
  if (result.status !== 0 || result.error || !pendingOffsetState) return;

  try {
    writeOffsetState(
      pendingOffsetState.sessionId,
      pendingOffsetState.state,
      pendingOffsetState.baseDirectory,
    );
  } catch {
    // A state-write failure must not make Stop visible or blocking.
  }
}

try {
  await main();
} catch {
  // Self-observation must never break Stop.
}
process.exit(0);
