#!/usr/bin/env bun

import { appendFileSync, mkdirSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { SKILL_INVOCATIONS_LOG } from './lib/skill-invocation-log.ts';
import { resolveNamespaceRoot } from './lib/namespace-root.ts';
import { resolveRunIdentity } from './lib/run-identity.ts';

const SKILL_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

function resolveProofSessionKey(explicitSessionId?: string): string | undefined {
  if (explicitSessionId !== undefined && explicitSessionId.trim().length > 0) {
    return explicitSessionId.trim();
  }
  if (process.env.CLAUDE_SESSION_ID || process.env.CLAUDE_CODE_SESSION_ID) {
    return resolveRunIdentity({}, { runtime: 'claude', env: process.env }).sessionKey ?? undefined;
  }
  if (process.env.CODEX_THREAD_ID) {
    return resolveRunIdentity({}, { runtime: 'codex', env: process.env }).sessionKey ?? undefined;
  }
  return resolveRunIdentity({}, { env: process.env }).sessionKey ?? undefined;
}

export function recordSkillInvocation(
  projectDirectory: string,
  skillName: string,
  sessionId?: string,
): void {
  if (!SKILL_NAME_PATTERN.test(skillName)) {
    throw new Error(`Invalid skill name "${skillName}"`);
  }
  const proofSessionKey = resolveProofSessionKey(sessionId);
  if (proofSessionKey === undefined) {
    // Runtimes without a compatible run identity skip silently.
    return;
  }

  const namespaceRoot = resolveNamespaceRoot(projectDirectory);
  mkdirSync(namespaceRoot, { recursive: true });
  appendFileSync(
    nodePath.join(namespaceRoot, SKILL_INVOCATIONS_LOG),
    `${new Date().toISOString()} ${proofSessionKey} ${skillName}\n`,
    'utf8',
  );
}

if (import.meta.main) {
  const projectDirectory = process.argv[2] ?? process.cwd();
  const skillName = process.argv[3];
  const sessionId = resolveProofSessionKey(process.argv[4]);

  try {
    if (skillName === undefined) {
      throw new Error('Missing skill name');
    }

    if (!sessionId) {
      console.log(`[skill-invocation-log] no run identity — skipped`);
      process.exit(0);
    }

    recordSkillInvocation(projectDirectory, skillName, sessionId);
    console.log(`[skill-invocation-log] ${skillName} ✓`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
