#!/usr/bin/env bun

import { appendFileSync, mkdirSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { SKILL_INVOCATIONS_LOG } from './lib/skill-invocation-log.ts';
import { resolveNamespaceRoot } from './lib/namespace-root.ts';

const SKILL_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

export function recordSkillInvocation(
  projectDirectory: string,
  skillName: string,
  sessionId = process.env.CLAUDE_SESSION_ID,
): void {
  if (!SKILL_NAME_PATTERN.test(skillName)) {
    throw new Error(`Invalid skill name "${skillName}"`);
  }
  if (sessionId === undefined || sessionId.trim().length === 0) {
    throw new Error('Missing CLAUDE_SESSION_ID');
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

  try {
    if (skillName === undefined) {
      throw new Error('Missing skill name');
    }

    recordSkillInvocation(projectDirectory, skillName);
    console.log(`[skill-invocation-log] ${skillName} ✓`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
