/**
 * `safeword connect <provider>` (2TK5AD) — the standalone entry point. Thin
 * wrapper over the shared `runConnect` composition root (which builds the real
 * boundary ports and runs the orchestration); this layer only maps CLI options
 * to a target, prints via console, and reflects the exit code.
 */

import process from 'node:process';

import { runConnect } from '../tracker-connect/run.js';
import type { ConnectTarget } from '../tracker-connect/types.js';

export interface ConnectCommandOptions {
  repo?: string;
  team?: string;
  workspace?: string;
}

function log(message: string): void {
  console.log(message);
}

export async function connectCommand(
  provider: string,
  options: ConnectCommandOptions = {},
): Promise<void> {
  const target: ConnectTarget = {
    repo: options.repo,
    team: options.team,
    workspace: options.workspace,
  };

  const result = await runConnect(provider, target, log);

  if (result.exitCode !== 0) process.exitCode = result.exitCode;
}
