#!/usr/bin/env bun
// Safeword: inject standing SAFEWORD.md instructions at session start.

import {
  type Agent,
  createSafewordContextResponse,
  parseAgent,
  readHookInput,
  readSafewordContext,
  resolveProjectDir,
} from './lib/safeword-context.ts';
import { DECISION_BRIEF_CONTRACT } from './lib/quality.ts';

export function appendDecisionBriefContract(agent: Agent, context: string): string {
  if (agent !== 'claude' || context.includes(DECISION_BRIEF_CONTRACT)) return context;
  return `${context}\n\n${DECISION_BRIEF_CONTRACT}`;
}

export async function runSessionSafewordContext(): Promise<number> {
  const agent = parseAgent();
  const hookInput = await readHookInput();
  const standingContext = readSafewordContext(resolveProjectDir(hookInput));
  const context = standingContext ? appendDecisionBriefContract(agent, standingContext) : null;
  const response = createSafewordContextResponse(agent, context);

  if (response) {
    process.stdout.write(response);
  }

  return 0;
}

if (import.meta.main) {
  process.exit(await runSessionSafewordContext());
}
