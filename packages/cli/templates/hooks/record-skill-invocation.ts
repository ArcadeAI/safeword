#!/usr/bin/env bun

import { appendFileSync, mkdirSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import {
  readFreshCodexRunIdentity,
  readFreshCursorRunIdentity,
} from './lib/cursor-run-identity.ts';
import { resolveNamespaceRoot } from './lib/namespace-root.ts';
import { resolveRunIdentity } from './lib/run-identity.ts';
import { SKILL_INVOCATIONS_LOG } from './lib/skill-invocation-log.ts';

const SKILL_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

function resolveProofSessionKey(input: {
  projectDirectory: string;
  skillName: string;
  explicitSessionId?: string;
}): string | undefined {
  const { projectDirectory, skillName, explicitSessionId } = input;
  if (explicitSessionId !== undefined && explicitSessionId.trim().length > 0) {
    return explicitSessionId.trim();
  }
  if (process.env.CLAUDE_SESSION_ID || process.env.CLAUDE_CODE_SESSION_ID) {
    return resolveRunIdentity({}, { runtime: 'claude', env: process.env }).sessionKey ?? undefined;
  }
  // Codex and Cursor expose the session id only to their pre-shell hooks, not to
  // the helper process. Each runtime's hook stashes the id in a short-lived,
  // per-skill cache right before this command runs; read it back here.
  const codexSessionKey = readFreshCodexRunIdentity({ projectDirectory, skillName });
  if (codexSessionKey !== undefined) {
    return codexSessionKey;
  }
  const cursorSessionKey = readFreshCursorRunIdentity({ projectDirectory, skillName });
  if (cursorSessionKey !== undefined) {
    return cursorSessionKey;
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
  const proofSessionKey = resolveProofSessionKey({
    projectDirectory,
    skillName,
    explicitSessionId: sessionId,
  });
  if (proofSessionKey === undefined) {
    // Runtimes without a compatible run identity cannot produce gate proof.
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

  try {
    if (skillName === undefined) {
      throw new Error('Missing skill name');
    }

    if (!SKILL_NAME_PATTERN.test(skillName)) {
      throw new Error(`Invalid skill name "${skillName}"`);
    }

    const sessionId = resolveProofSessionKey({
      projectDirectory,
      skillName,
      explicitSessionId: process.argv[4],
    });

    if (!sessionId) {
      console.log(
        '[skill-invocation-log] no run identity — no proof logged. ' +
          'Run this from an agent session with a current run identity; Cursor users should retry after safeword hooks are active so beforeShellExecution can bind conversation_id.',
      );
      process.exit(0);
    }

    recordSkillInvocation(projectDirectory, skillName, sessionId);
    console.log(`[skill-invocation-log] ${skillName} ✓`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
