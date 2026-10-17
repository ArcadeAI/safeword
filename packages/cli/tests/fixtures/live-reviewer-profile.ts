import process from 'node:process';

import type { ReviewAgent } from '../../src/review/contract.js';

export function liveReviewerEnvironment(
  assigned: ReviewAgent,
  author: string,
  captured: Record<string, string | undefined> = process.env,
): Record<string, string | undefined> {
  const environment: Record<string, string | undefined> = { SAFEWORD_AGENT_RUNTIME: author };
  const profile =
    assigned === 'claude'
      ? captured.SAFEWORD_LIVE_CLAUDE_CONFIG_DIR
      : captured.SAFEWORD_LIVE_CODEX_HOME;
  // Live config captures the operator profile before the base config sandboxes it.
  // An empty capture restores the default profile by clearing that sandbox override.
  if (profile !== undefined) {
    environment[assigned === 'claude' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME'] = profile || undefined;
  }
  return environment;
}
