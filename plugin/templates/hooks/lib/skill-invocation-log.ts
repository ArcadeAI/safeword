// Safeword skill-invocation log + phase-gate config.
//
// Ticket 147: when a feature ticket enters `phase: done`, the agent must have
// invoked the required skills (currently /verify and /audit) in the current
// session. The skills append a session-scoped line to skill-invocations.log via
// Claude Code inline shell execution, or via the documented fallback command in
// clients that treat the inline line as Markdown only. The gate check below
// reads the log and validates entries exist for required skills in the current
// session.
//
// Extending to new gates: add a phase → required-skills entry to PHASE_GATES,
// add a helper invocation line to the target skill's content. No infra changes.

import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { resolveNamespaceRoot } from './namespace-root.js';

export const SKILL_INVOCATIONS_LOG = 'skill-invocations.log';

/**
 * Phase → required skill names. When a feature ticket transitions into one of
 * these phases, the done-gate hook validates the log contains current-session
 * entries for each named skill.
 *
 * v1: only `done` is gated, requiring /verify and /audit.
 * Future gates added by extending this map (single-line change).
 */
export const PHASE_GATES: Record<string, string[]> = {
  done: ['verify', 'audit'],
};

/**
 * Required skills at the done gate (W610WW). Features keep their verify+audit
 * requirement; any ticket the whole-ticket pass applies to also needs
 * /quality-review (the review half of the cross-scenario pass). `wholeTicketPass`
 * is the SAME predicate that gates the cross-scenario row (`wholeTicketPassApplies`
 * in ledger-validation) — so both halves share the legacy exemption: a legacy
 * unannotated multi-scenario ticket triggers neither. A single-loop task requires
 * nothing — nothing to cross, and tasks are deliberately NOT pulled into the
 * verify+audit requirement here.
 */
export function requiredSkillsForDone(isFeature: boolean, wholeTicketPass: boolean): string[] {
  const skills = isFeature ? [...(PHASE_GATES.done ?? [])] : [];
  if (wholeTicketPass) skills.push('quality-review');
  return skills;
}

export interface SkillInvocationCheckInput {
  sessionId: string;
  required: string[];
  rootDirectory: string;
}

export interface SkillInvocationCheckResult {
  ok: boolean;
  missing: string[];
}

/**
 * Reads .safeword/skill-invocations.log under rootDirectory and validates the
 * current session has entries for every required skill.
 *
 * Fails closed: missing log file, unreadable log, malformed entries → block
 * (does not silently pass).
 */
export function checkSkillInvocations(
  input: SkillInvocationCheckInput,
): SkillInvocationCheckResult {
  if (input.required.length === 0) return { ok: true, missing: [] };

  const logPath = nodePath.join(resolveNamespaceRoot(input.rootDirectory), SKILL_INVOCATIONS_LOG);
  if (!existsSync(logPath)) {
    return { ok: false, missing: [...input.required] };
  }

  let content: string;
  try {
    content = readFileSync(logPath, 'utf8');
  } catch {
    // Unreadable — fail closed.
    return { ok: false, missing: [...input.required] };
  }

  const invokedSkills = new Set<string>();
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    // Format: `<timestamp> <session-id> <skill-name>` (whitespace-delimited)
    const tokens = line.split(/\s+/);
    if (tokens.length < 3) continue; // malformed; skip
    const sessionId = tokens[1];
    const skillName = tokens[2];
    if (sessionId === input.sessionId && skillName) {
      invokedSkills.add(skillName);
    }
  }

  const missing = input.required.filter(s => !invokedSkills.has(s));
  return { ok: missing.length === 0, missing };
}
