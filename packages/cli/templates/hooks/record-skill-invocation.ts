#!/usr/bin/env bun

import { appendFileSync, mkdirSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { SKILL_INVOCATIONS_LOG } from './lib/skill-invocation-log.ts';
import { resolveNamespaceRoot } from './lib/namespace-root.ts';

const SKILL_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
// CLAUDE_CODE_SESSION_ID is set (and CLAUDE_SESSION_ID is empty) in remote
// container sessions (web, GitHub Actions). Codex exposes CODEX_THREAD_ID
// instead; the done gate treats session ids as opaque tokens, so the thread id
// is a compatible proof binding.
const ENV_SESSION_ID =
  process.env.CLAUDE_SESSION_ID ||
  process.env.CLAUDE_CODE_SESSION_ID ||
  process.env.CODEX_THREAD_ID;

export function recordSkillInvocation(
  projectDirectory: string,
  skillName: string,
  sessionId = ENV_SESSION_ID,
): void {
  if (!SKILL_NAME_PATTERN.test(skillName)) {
    throw new Error(`Invalid skill name "${skillName}"`);
  }
  if (sessionId === undefined || sessionId.trim().length === 0) {
    // Runtimes without a compatible session id skip silently.
    return;
  }

  const namespaceRoot = resolveNamespaceRoot(projectDirectory);
  mkdirSync(namespaceRoot, { recursive: true });
  appendFileSync(
    nodePath.join(namespaceRoot, SKILL_INVOCATIONS_LOG),
    `${new Date().toISOString()} ${sessionId} ${skillName}\n`,
    'utf8',
  );
}

if (import.meta.main) {
  const projectDirectory = process.argv[2] ?? process.cwd();
  const skillName = process.argv[3];
  const sessionId = process.argv[4] || ENV_SESSION_ID;

  try {
    if (skillName === undefined) {
      throw new Error('Missing skill name');
    }

    if (!sessionId || sessionId.trim().length === 0) {
      console.log(`[skill-invocation-log] no session id — skipped (non-Claude runtime)`);
      process.exit(0);
    }

    recordSkillInvocation(projectDirectory, skillName, sessionId);
    console.log(`[skill-invocation-log] ${skillName} ✓`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
