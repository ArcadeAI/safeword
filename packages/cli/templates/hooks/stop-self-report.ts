#!/usr/bin/env bun
// Safeword: self-observation surfacing (ticket QYYC5Y, issue #345).
//
// At the end of a turn, if safeword captured any of its OWN internal signals
// this session (see lib/self-report.ts), surface a factual one-liner to Claude
// via hookSpecificOutput.additionalContext on exit 0. Phrased as a statement of
// fact — never an imperative — because out-of-band/command phrasing trips
// Claude's prompt-injection defenses and gets surfaced verbatim instead of acted
// on (https://code.claude.com/docs/en/hooks). Best-effort: never blocks Stop.

import {
  formatSelfReportSurfacing,
  readSelfReportConfig,
  readSessionReports,
} from './lib/self-report.ts';

interface HookInput {
  session_id?: string;
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

  const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const config = readSelfReportConfig(projectDirectory);
  if (!config.surface) return; // selfReport.surface = false → stay silent

  const additionalContext = formatSelfReportSurfacing(
    readSessionReports(projectDirectory, sessionId),
    { file: config.file },
  );
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
