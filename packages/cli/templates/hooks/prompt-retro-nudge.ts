#!/usr/bin/env bun
// Safeword: cloud-retro filing nudge (UserPromptSubmit) — BNGK9W, issue #568.
//
// The async Stop hook extracts + spools the retro's post-egress drafts but, being
// backgrounded (ZFGWS1), surfaces nothing. In a cloud container the REST transport
// 401s, so those drafts stay spooled. This boundary hook checks for unfiled drafts
// and, once per unfiled batch, surfaces ONE factual line so the live agent files
// them via its inherited GitHub MCP. The line is a system-reminder statement (never
// an imperative) — invisible to the user in chat, read by the model as context.
// Best-effort: never blocks the prompt.

import { existsSync } from 'node:fs';

import { decideRetroNudge } from './lib/retro-nudge.ts';

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

  const sessionId = input.session_id;
  if (sessionId) {
    try {
      const additionalContext = decideRetroNudge(projectDirectory, sessionId);
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
