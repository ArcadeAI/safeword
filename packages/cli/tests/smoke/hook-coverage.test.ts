/**
 * Drift guard for the smoke test suite (ticket 0WQA9V, slice 3).
 *
 * Reads `SAFEWORD_SCHEMA.ownedFiles` to get the canonical list of shipped
 * `.ts` hooks, then checks that every hook is either:
 *   (a) referenced by name in a smoke test file under tests/smoke/, OR
 *   (b) listed in EXEMPT_HOOKS below with a justification.
 *
 * Fails immediately when a new hook is added to the schema without smoke
 * coverage — so the blind-spot is caught at commit time, not in production.
 * Adding to EXEMPT_HOOKS is the deliberate escape valve.
 *
 * Why here rather than an inline assertion in steering.live.test.ts:
 * this is a structural integrity check, not a behavioral test — it should
 * run in the normal fast suite (no tokens, no claude binary needed).
 */

import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { SAFEWORD_SCHEMA } from '../../src/schema.js';

const SMOKE_DIR = nodePath.resolve(__dirname);

/** Repeated justifications, named so a reword changes one place, not ten. */
const SESSION_STARTUP = 'session hook, fires at startup — not assertable in a tool-based live run';
const PROMPT_TURN = 'prompt hook, fires on user turn — not assertable in a tool-based live run';

/**
 * Hooks that are deliberately not covered by the smoke suite, with justification.
 * Add here instead of silently letting a hook fall off the radar.
 */
const EXEMPT_HOOKS: Record<string, string> = {
  // Session/startup hooks fire at session start, not on tool calls.
  'session-safeword-context.ts': SESSION_STARTUP,
  'session-codex-start.ts': SESSION_STARTUP,
  'session-cursor-auto-upgrade.ts': SESSION_STARTUP,
  'session-version.ts': SESSION_STARTUP,
  'session-lint-check.ts': SESSION_STARTUP,
  'session-compact-context.ts': SESSION_STARTUP,
  'session-auto-upgrade.ts': SESSION_STARTUP,
  'session-cleanup-quality.ts': SESSION_STARTUP,
  'session-start-reentry.ts': SESSION_STARTUP,
  'session-author-model.ts': SESSION_STARTUP,
  'session-architecture-heal.ts':
    'session hook; shells to `safeword architecture` whose selfHeal is covered by tests/utils/architecture-document.test.ts and tests/commands/architecture.test.ts',
  'session-dependency-readiness.ts':
    'session hook; deterministic temp-project coverage in tests/hooks/dependency-readiness.test.ts',
  // Prompt hooks fire at prompt-submit, not on tool calls.
  'prompt-timestamp.ts': PROMPT_TURN,
  'prompt-questions.ts': PROMPT_TURN,
  // Auxiliary / narrow scope
  'post-tool-sync-learnings.ts':
    'PostToolUse learning-sync hook — no agent-blocking deny path to assert in a live run',
  'post-tool-bypass-warn.ts': 'warn-only hook, no deny path — output is informational, not a gate',
  'write-review-stamp.ts':
    'fires on PostToolUse Write of skill-invocations.log specifically; covered by tests/integration/review-stamp.test.ts',
  'resolve-namespace-root.ts':
    'manual helper for skill/command snippets; covered by tests/hooks/record-skill-invocation.test.ts',
  'record-skill-invocation.ts':
    'manual helper for skill/command invocation proof; covered by tests/hooks/record-skill-invocation.test.ts',
  'stop-reentry.ts': 'stop hook, fires at session end — not assertable in a tool-based live run',
  // Core hooks covered deterministically elsewhere (not re-run live, to save cost)
  'post-tool-lint.ts':
    'PostToolUse lint hook; exercised end-to-end by tests/integration/golden-path.test.ts',
  'post-tool-quality.ts':
    'PostToolUse quality-annotation hook — no agent-blocking deny path to assert in a live run',
  'pre-tool-config-guard.ts':
    'PreToolUse config.json guard; deterministic, covered by tests/hooks/config-guard-patterns.test.ts',
  'pre-tool-dependency-readiness.ts':
    'PreToolUse dependency guard; deterministic temp-project coverage in tests/hooks/dependency-readiness.test.ts',
  'post-tool-dependency-readiness.ts':
    'PostToolUse install-stamp hook, no deny path; deterministic temp-project coverage in tests/hooks/dependency-readiness.test.ts',
  'pre-tool-architecture-stage.ts':
    'PreToolUse git-commit hook; shells to `safeword architecture --stage` whose regenerate-and-stage behavior is covered by tests/commands/architecture-stage.test.ts',
  'pre-tool-stale-main.ts':
    'warn-only PreToolUse checkout/switch hook, no deny path; deterministic coverage in tests/hooks/branch-staleness.test.ts',
  'stop-quality.ts':
    'stop hook (done gate); fires at session end, not on a tool call — not live-assertable in one turn',
  // Infra shell hooks — not agent-steering gates
  'session-bun-check.sh':
    'infra shell hook — checks bun availability at session start, not a tool-call gate',
  'pre-tool-git-bare-fix.sh':
    'infra shell hook — repairs bare-repo git state, not an agent-steering gate',
};

/**
 * Extract the base filename of every top-level hook (`.ts` or `.sh`) in
 * SAFEWORD_SCHEMA.ownedFiles. (Hooks live in ownedFiles, not managedFiles — the
 * schema uses ownedFiles for files it fully owns and overwrites on upgrade.)
 * lib/ helpers are excluded; only the top-level hook scripts that wire into
 * Claude Code's hooks config are checked.
 */
function shippedHooks(): string[] {
  return Object.keys(SAFEWORD_SCHEMA.ownedFiles)
    .filter(path => /^\.safeword\/hooks\/[^/]+\.(?:ts|sh)$/.test(path))
    .map(path => nodePath.basename(path));
}

describe('smoke hook coverage (drift guard)', () => {
  it('every shipped hook is covered by a smoke test or listed in EXEMPT_HOOKS', () => {
    // Collect text of all *.test.ts files directly in tests/smoke/ (no subdirs).
    const smokeText = readdirSync(SMOKE_DIR)
      .filter(f => f.endsWith('.test.ts'))
      .map(f => readFileSync(nodePath.join(SMOKE_DIR, f), 'utf8'))
      .join('\n');

    const hooks = shippedHooks();
    const uncovered: string[] = [];

    for (const hook of hooks) {
      const isExempt = Object.prototype.hasOwnProperty.call(EXEMPT_HOOKS, hook);
      const isCovered = smokeText.includes(hook);
      if (!isExempt && !isCovered) uncovered.push(hook);
    }

    const list = uncovered.map(h => `  - ${h}`).join('\n');
    expect(
      uncovered,
      `These hooks are shipped in SAFEWORD_SCHEMA but have no smoke coverage and no EXEMPT_HOOKS entry:\n${list}\n\nAdd smoke coverage in tests/smoke/, or add to EXEMPT_HOOKS with a justification.`,
    ).toHaveLength(0);
  });

  it('EXEMPT_HOOKS contains no entries for hooks that no longer exist in the schema', () => {
    const hooks = new Set(shippedHooks());
    const staleExemptions = Object.keys(EXEMPT_HOOKS).filter(hook => !hooks.has(hook));
    const staleList = staleExemptions.map(h => `  - ${h}`).join('\n');
    expect(
      staleExemptions,
      `These EXEMPT_HOOKS entries refer to hooks not in SAFEWORD_SCHEMA — clean them up:\n${staleList}`,
    ).toHaveLength(0);
  });
});
