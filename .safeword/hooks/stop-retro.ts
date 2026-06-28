#!/usr/bin/env bun
// Safeword: retro auto-trigger (ticket FTCQGD).
//
// At a Stop, if this session is SUBSTANTIAL and hasn't been nudged yet, surface a
// FACTUAL one-liner via hookSpecificOutput.additionalContext telling the agent the
// retro pipeline is available — pointing at the retro guide and carrying the live
// transcript_path. Phrased as a statement of fact, never an imperative, for the
// same reason stop-self-report.ts is: out-of-band/command phrasing trips Claude's
// prompt-injection defenses and gets surfaced verbatim instead of acted on
// (https://code.claude.com/docs/en/hooks).
//
// Stop-anchored (NOT SessionEnd): fires while the session is alive, when
// transcript_path is readable. SessionEnd is killed before async work finishes in
// cloud and its transcript is deleted on container reclaim. The once-per-session
// sentinel keeps it to one nudge per session; the occurrence ledger (RV9JT4)
// dedupes across sessions. Best-effort: never blocks Stop.

import { readSelfReportConfig } from './lib/self-report.ts';
import { decideRetroNudge } from './lib/retro-trigger.ts';

interface HookInput {
  session_id?: string;
  transcript_path?: string;
}

async function main(): Promise<void> {
  let input: HookInput;
  try {
    input = await Bun.stdin.json();
  } catch {
    return; // no stdin / not JSON — nothing to do
  }

  const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  // Reuse the self-report surfacing toggle: this nudge is the same kind of
  // "surface a safeword signal at Stop" action stop-self-report performs.
  if (!readSelfReportConfig(projectDirectory).surface) return;

  const additionalContext = decideRetroNudge(input, { env: process.env });
  if (!additionalContext) return;

  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: { hookEventName: 'Stop', additionalContext },
    })}\n`,
  );
}

try {
  await main();
} catch {
  // Self-observation must never break Stop.
}
process.exit(0);
