#!/usr/bin/env bun
// Safeword: cloud-retro filing nudge (UserPromptSubmit) — BNGK9W, issue #568.
//
// The async Stop hook extracts + spools the retro's post-egress drafts but, being
// backgrounded (ZFGWS1), surfaces nothing. In a cloud container the REST transport
// 401s, so those drafts stay spooled. The PRIMARY filing path is the Stop-time
// filing gate (stop-retro-filing.ts, GH628F), which dispatches the
// safeword-retro-filer subagent; this boundary hook is the BACKSTOP — once per
// unfiled batch, it surfaces ONE factual line naming the spool. The line is a
// system-reminder statement (never an imperative) — invisible to the user in chat,
// read by the model as context. Best-effort: never blocks the prompt.

import { existsSync } from 'node:fs';

import { decideRetroFilingNudge } from './lib/retro-nudge.ts';
import { resolveSessionId } from './lib/retro-trigger.ts';

interface HookInput {
  session_id?: string;
}

const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

// Not a safeword project — nothing to do.
if (existsSync(`${projectDirectory}/.safeword`)) {
  let input: HookInput = {};
  try {
    input = await Bun.stdin.json();
  } catch {
    input = {};
  }

  // Resolver parity with the spool writer — see stop-retro-filing.ts.
  const sessionId = resolveSessionId(input, process.env);
  if (sessionId) {
    try {
      const additionalContext = decideRetroFilingNudge(projectDirectory, sessionId);
      if (additionalContext) {
        process.stdout.write(
          `${JSON.stringify({
            hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext },
          })}\n`,
        );
      }
    } catch {
      // A surfacing failure must never break the prompt.
    }
  }
}

process.exit(0);
