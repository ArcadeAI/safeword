#!/usr/bin/env bun
// Safeword: stamp the dependency fingerprint after a successful install (#380).
//
// A manual recovery install (e.g. `pnpm install --frozen-lockfile`) can be a
// no-op that doesn't bump `node_modules` mtime, so the content-fingerprint marker
// never refreshes and the readiness block persists — leaving `touch node_modules`
// as the only escape. PostToolUse fires only on success, so when a dependency
// install command completes, stamp the current fingerprint: the recommended
// recovery command now actually clears the block, regardless of mtime.

import { existsSync } from 'node:fs';
import nodePath from 'node:path';

import {
  type DependencyReadiness,
  getDependencyReadiness,
  isDependencyInstallCommand,
  toDependencyReadinessState,
  writeDependencyReadinessState,
  writeInstallMarker,
} from './lib/dependency-readiness.ts';

interface BashResult {
  exit_code?: number;
  success?: boolean;
  interrupted?: boolean;
  is_error?: boolean;
}

interface HookInput {
  tool_name?: string;
  tool_input?: { command?: string };
  // Build-dependent: the Bash result may arrive under `tool_response` or a
  // sibling `Bash` key. We only read it to REFUSE stamping on explicit failure.
  tool_response?: BashResult;
  Bash?: BashResult;
}

const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
if (!existsSync(`${projectDirectory}/.safeword`)) process.exit(0);

let input: HookInput;
try {
  input = (await Bun.stdin.json()) as HookInput;
} catch {
  process.exit(0);
}

if (input.tool_name !== 'Bash') process.exit(0);

const command = input.tool_input?.command;
if (command === undefined || !isDependencyInstallCommand(command)) process.exit(0);

// PostToolUse fires only after success, but never stamp on an explicit failure
// signal (an interrupted run, or a build that fires PostToolUse on failure).
if (commandFailed(input)) process.exit(0);

const readiness = getDependencyReadiness(projectDirectory);
if (readiness.plan === undefined || readiness.fingerprint === undefined) process.exit(0);

// Only claim readiness if the artifact the install produces now exists.
if (!existsSync(nodePath.join(projectDirectory, readiness.plan.installArtifact))) process.exit(0);

// The install succeeded, so node_modules reflects the current inputs even when it
// was a no-op that left mtime untouched. Override the unreliable mtime signal and
// stamp the current fingerprint.
const ready: DependencyReadiness = {
  ...readiness,
  status: 'ready',
  reason: 'install_artifact_current',
};
writeInstallMarker(projectDirectory, ready);
writeDependencyReadinessState(projectDirectory, toDependencyReadinessState(ready));
process.exit(0);

function commandFailed(hook: HookInput): boolean {
  for (const result of [hook.tool_response, hook.Bash]) {
    if (result === undefined) continue;
    if (result.success === false) return true;
    if (typeof result.exit_code === 'number' && result.exit_code !== 0) return true;
    if (result.interrupted === true || result.is_error === true) return true;
  }
  return false;
}
