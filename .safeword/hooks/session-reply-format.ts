#!/usr/bin/env bun
// Safeword: inject the phase-neutral reply contract within Claude's per-hook
// additionalContext cap, independently of the larger SAFEWORD.md context.

import { type Agent, parseAgent } from './lib/safeword-context.ts';
import { DECISION_BRIEF_CONTRACT } from './lib/quality.ts';

export function createDecisionBriefContextResponse(agent: Agent): string | undefined {
  if (agent !== 'claude') return undefined;

  return `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: DECISION_BRIEF_CONTRACT,
    },
  })}\n`;
}

export function runSessionReplyFormat(): number {
  const response = createDecisionBriefContextResponse(parseAgent());
  if (response) process.stdout.write(response);
  return 0;
}

if (import.meta.main) {
  process.exit(runSessionReplyFormat());
}
