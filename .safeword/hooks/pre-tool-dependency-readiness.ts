#!/usr/bin/env bun
// Safeword: Dependency readiness guard (PreToolUse)
// Blocks dependency-backed Bash commands in unbootstrapped worktrees.

import { existsSync } from 'node:fs';

import {
  formatDependencyRecovery,
  getDependencyReadiness,
  isDependencyBackedCommand,
  toDependencyReadinessState,
  writeDependencyReadinessState,
} from './lib/dependency-readiness.ts';

interface HookInput {
  tool_name?: string;
  tool_input?: {
    command?: string;
  };
}

interface HookOutput {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse';
    permissionDecision: 'deny';
    permissionDecisionReason: string;
    additionalContext: string;
  };
}

const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

if (!existsSync(`${projectDirectory}/.safeword`)) {
  process.exit(0);
}

let input: HookInput;
try {
  input = await Bun.stdin.json();
} catch {
  process.exit(0);
}

if (input.tool_name !== 'Bash') {
  process.exit(0);
}

const command = input.tool_input?.command;
if (command === undefined || !isDependencyBackedCommand(command)) {
  process.exit(0);
}

const readiness = getDependencyReadiness(projectDirectory);
if (readiness.status === 'ready' || readiness.status === 'unsupported') {
  writeDependencyReadinessState(projectDirectory, toDependencyReadinessState(readiness));
  process.exit(0);
}

writeDependencyReadinessState(projectDirectory, toDependencyReadinessState(readiness));

const recovery = formatDependencyRecovery(readiness);
const output: HookOutput = {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: recovery,
    additionalContext: `Blocked command:\n${command}`,
  },
};

console.log(JSON.stringify(output));
process.exit(0);
