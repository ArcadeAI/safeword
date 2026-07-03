#!/usr/bin/env bun
// Safeword: retro filing gate (Stop) — issue #628, ticket GH628F.
//
// The async stop-retro extraction spools post-egress drafts that the REST
// transport cannot file in cloud (401). The muted UserPromptSubmit nudge proved
// unreliable (#628), so this SYNC Stop hook uses Claude's sanctioned continuation
// channel — `{decision:"block", reason}` — to request ONE action: dispatch the
// shipped safeword-retro-filer subagent with the spool path. The subagent files
// and DRAINS the spool (the ack); an undrained batch re-fires here, capped by the
// gate's per-batch attempt budget (lib/retro-filing-gate.ts).
//
// Guards: stop_hook_active (never blocks a continuation's own stop),
// selfReport.file (the filing off-switch), missing session id, and the gate's
// own silence conditions. Best-effort: any failure allows the stop.
//
// Claude runs all Stop hooks in parallel, and the docs define no merge rule for
// two simultaneous decision:"block" outputs — stop-quality.ts can block the same
// stop. A collision costs one filing attempt without a dispatch; the gate's
// per-batch attempt budget (FILING_ATTEMPT_CAP) absorbs it, and the muted nudge
// remains the backstop after the cap.

import { existsSync } from 'node:fs';

import { decideRetroFilingGate } from './lib/retro-filing-gate.ts';
import { resolveSessionId } from './lib/retro-trigger.ts';
import { readSelfReportConfig } from './lib/self-report.ts';

interface HookInput {
  session_id?: string;
  stop_hook_active?: boolean;
}

const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

if (existsSync(`${projectDirectory}/.safeword`)) {
  let input: HookInput = {};
  try {
    input = await Bun.stdin.json();
  } catch {
    input = {};
  }

  // Resolver parity with the spool writer (retro-trigger resolveSessionId): a
  // payload without session_id must still key the SAME spool the extraction
  // wrote (cloud/local env fallbacks), else drafts spool under the env id and
  // this gate silently never fires.
  const sessionId = resolveSessionId(input, process.env);
  if (sessionId && input.stop_hook_active !== true && readSelfReportConfig(projectDirectory).file) {
    try {
      const reason = decideRetroFilingGate(projectDirectory, sessionId);
      if (reason) {
        process.stdout.write(`${JSON.stringify({ decision: 'block', reason })}\n`);
      }
    } catch {
      // Self-observation must never hold a stop hostage.
    }
  }
}

process.exit(0);
