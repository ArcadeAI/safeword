#!/usr/bin/env bun
// Safeword: self-observation surfacing (ticket QYYC5Y, issue #345).
//
// At the end of a turn, if safeword captured any of its OWN internal signals
// this session (see lib/self-report.ts), surface a factual one-liner to Claude
// via hookSpecificOutput.additionalContext on exit 0. Phrased as a statement of
// fact — never an imperative — because out-of-band/command phrasing trips
// Claude's prompt-injection defenses and gets surfaced verbatim instead of acted
// on (https://code.claude.com/docs/en/hooks). Best-effort: never blocks Stop.
//
// EMIT ONLY ON CHANGE (issue #1163). Stop additionalContext wakes the agent as a
// fresh turn with no user message; the agent must say something to end that turn,
// which fires Stop again. So an unconditional emit from a Stop hook is an
// infinite wake-loop generator, and the session spool never drains — every Stop
// would re-surface a byte-identical line. Each signature is therefore surfaced at
// most once per session, tracked in the `surfaced/` marker; a Stop with nothing
// new emits nothing at all.

import {
  formatSelfReportSurfacing,
  markSignaturesSurfaced,
  readSelfReportConfig,
  readSessionReports,
  readSurfacedSignatures,
  signatureOf,
} from './lib/self-report.ts';

interface HookInput {
  session_id?: string;
  stop_hook_active?: boolean;
}

async function main(): Promise<void> {
  let input: HookInput;
  try {
    input = await Bun.stdin.json();
  } catch {
    return; // no stdin / not JSON — nothing to do
  }

  const sessionId = input.session_id;
  if (!sessionId) return;

  // Belt to the marker's braces: never speak into a continuation a Stop hook
  // already caused. The docs don't say whether this is set for an
  // additionalContext-induced continuation (only for `decision:"block"`), so it
  // is not load-bearing — but when it IS set it caps any residual loop, and the
  // cost of a false positive is only DELAY: nothing is marked on this path, so
  // the signal still surfaces at the next ordinary stop. The sibling
  // stop-retro-filing.ts guards the same way.
  if (input.stop_hook_active === true) return;

  const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const config = readSelfReportConfig(projectDirectory);
  if (!config.surface) return; // selfReport.surface = false → stay silent

  const surfaced = readSurfacedSignatures(projectDirectory, sessionId);
  const fresh = readSessionReports(projectDirectory, sessionId).filter(
    record => !surfaced.has(signatureOf(record)),
  );

  const additionalContext = formatSelfReportSurfacing(fresh, { file: config.file });
  if (!additionalContext) return;

  // Persist BEFORE emitting, and emit only if the marker durably took ALL of
  // these signatures. With no durable marker the next Stop re-surfaces this same
  // line, and Stop additionalContext re-wakes the agent — that is the infinite
  // loop, not a cosmetic repeat, so silence is the safe failure here. (Cost of
  // that failure: the signal stays in the spool and `safeword self-report` still
  // shows it; only the end-of-turn mention is skipped.)
  const signatures = [...new Set(fresh.map(record => signatureOf(record)))];
  if (!markSignaturesSurfaced(projectDirectory, sessionId, signatures)) return;

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
