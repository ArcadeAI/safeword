#!/usr/bin/env bun
// Safeword: Pre-work reminders (UserPromptSubmit)
// Injects propose-and-converge principles + phase-aware status reminder

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import {
  deriveTddStep,
  evaluateFeatureTicketReadiness,
  formatFeatureTicketReadiness,
  getTicketInfo,
} from './lib/active-ticket.ts';
import { READINESS_POINTER, shouldSurfaceReadiness } from './lib/readiness-pointer.ts';
import { evaluateReplan } from './lib/replan.ts';
import type { BddPhase } from './lib/quality.ts';
import { REPLY_FORMAT_LEAD, REPLY_FORMAT_REMINDER } from './lib/quality.ts';
import {
  ESCALATION_THRESHOLD,
  type FailureEntry,
  getStateFilePath,
  type QualityState,
  readCounters,
  writeCounters,
} from './lib/quality-state.ts';

interface HookInput {
  session_id?: string;
  prompt?: string;
}

const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const safewordDirectory = `${projectDirectory}/.safeword`;

// Not a safeword project, skip silently
if (!existsSync(safewordDirectory)) {
  process.exit(0);
}

// Read hook input from stdin (same pattern as pre-tool and post-tool hooks)
let input: HookInput;
try {
  input = await Bun.stdin.json();
} catch {
  input = {};
}

// Compact behavioral anchors; SAFEWORD.md carries the full methodology. These
// always lead the block, so they live in their own array — `lines` below is the
// situational tail, and the two are concatenated at output. Keeping them apart
// means no push into `lines` can displace an anchor.
const anchors = ['- Contribute before asking. Embed open questions in your contribution.'];
let replyFormatReminder = REPLY_FORMAT_REMINDER;
const lines: string[] = [];

// Effective Clarify phase: the active in-progress ticket's phase, else undefined
// (no ticket, pre-classify, or a ticket that isn't in_progress — all treated as
// Clarify). Drives the readiness pointer below.
let effectivePhase: string | undefined;

// Phase-aware reminder from quality state (compressed cognitive state — one line)
const stateFile = getStateFilePath(projectDirectory, input.session_id);

if (existsSync(stateFile)) {
  // The state file is shared by quality hooks; its on-disk shape is the
  // QualityState contract. Keep the runtime parse/error boundary below because
  // a stale or malformed file must never block the core prompt guidance.
  let state: QualityState | undefined;
  let stateDirty = false;
  try {
    state = JSON.parse(readFileSync(stateFile, 'utf8')) as QualityState;

    // A real UserPromptSubmit boundary consumes the quiet period after a
    // generic Stop review. Clear it before deriving this prompt's reminders so
    // the following edited-work turn is eligible for normal review again.
    if (state.stopQualityReviewAwaitingUserPrompt === true) {
      state.stopQualityReviewAwaitingUserPrompt = false;
      stateDirty = true;
    }

    if (state.activeTicket) {
      // Derive phase from ticket file (not cache) — freshness check
      const ticketInfo = getTicketInfo(projectDirectory, state.activeTicket);
      const phase = ticketInfo.phase;
      const isActive = ticketInfo.status === 'in_progress';

      if (phase && isActive) {
        effectivePhase = phase;
        // Derive TDD step from test-definitions.md when in implement phase
        const tddStep =
          phase === 'implement' && ticketInfo.folder
            ? deriveTddStep(projectDirectory, ticketInfo.folder)
            : null;

        // Stop reviews deliberately stay quiet inside an active TDD step. Keep
        // only the lead-first cue here so the prompt hook does not reintroduce
        // the decision-brief demand that Stop suppresses.
        if (phase === 'implement' && tddStep !== null) {
          replyFormatReminder = REPLY_FORMAT_LEAD;
        }

        // Phase-specific one-liner
        // satisfies proves every canonical phase has a reminder (a missing key was
        // silent before); Record<string,string> keeps the tolerant off-enum lookup.
        const reminders: Record<string, string> = {
          intake:
            'Phase: understanding. Contribute a perspective, surface open questions. If sizing as feature, run `/bdd`.',
          'define-behavior':
            'Phase: define-behavior. Present scenarios to user for review. Do not save test-definitions.md until accepted.',
          'scenario-gate':
            'Phase: scenario-gate. AODI validation + adversarial pass. If new scenarios found, loop back to define-behavior; else advance to plan-implementation.',
          'plan-implementation':
            'Phase: plan-implementation. Author impl-plan.md (scaffold from .safeword/templates/impl-plan-template.md); map installed language/component skills to the scenarios; independent review before advancing to implement.',
          implement: tddStep
            ? `TDD: ${tddStep.toUpperCase()}. ${tddNextStep(tddStep)}`
            : 'Phase: implement.',
          verify: 'Phase: verify. Cross-scenario refactor if needed, then run /verify and /audit.',
          done: 'Phase: done. Close ticket (verify.md exists).',
        } satisfies Record<BddPhase, string> & Record<string, string>;

        // Name the active ticket slug-first (ZRXM6Q) so the per-turn reminder
        // reads in names, not the opaque ID — recognition over recall. The slug
        // is derived once in getTicketInfo and shared with the compaction hook.
        const ticketSlug = ticketInfo.slug;
        lines.push(
          `- Ticket: ${ticketSlug ? `${ticketSlug} (${state.activeTicket})` : state.activeTicket}`,
        );

        if (phase === 'define-behavior' && ticketInfo.type === 'feature' && ticketInfo.folder) {
          const readiness = evaluateFeatureTicketReadiness(projectDirectory, ticketInfo.folder);
          if (!readiness.ok) {
            lines.push(`- ${formatFeatureTicketReadiness(readiness)}`);
          }
        }

        const reminder = reminders[phase];
        if (reminder) {
          lines.push(`- ${reminder}`);
        }

        // Layer 1: Session-scoped failure injection — parenthetical from recentFailures
        const failures: FailureEntry[] = state.recentFailures ?? [];
        if (failures.length > 0) {
          const injection = getFailureInjection(failures, phase);
          if (injection) {
            lines.push(`- ${injection}`);
          }
        }

        // Replan-on-resume (ticket 153): if commits since the ticket's
        // last_modified touched paths it references, surface an opt-in heads-up.
        // Records the prompted HEAD in session state so it fires at most once
        // per HEAD advance (not last_modified — that is the active-ticket mtime).
        const replan = evaluateReplan(
          projectDirectory,
          ticketInfo.folder ?? '',
          ticketInfo.type,
          state.replanPromptedHead,
        );
        if (replan) {
          lines.push(`- ${replan.line}`);
          state.replanPromptedHead = replan.headSha;
          stateDirty = true;
        }
      } else {
        lines.push(
          '- No active ticket. Classify (patch/task/feature/epic) before starting. For features, run `/bdd`.',
        );
      }
    } else {
      lines.push('- No active ticket. Classify (patch/task/feature/epic) before starting.');
    }

    // One-shot reminder: verify novel research claims before building on them.
    // Atomic move pending → acknowledged so the setter's dedup still works
    // after the nudge has been shown (ticket 4N5Y28).
    const rawPending: unknown[] = Array.isArray(state.learningsNudgesPending)
      ? state.learningsNudgesPending
      : [];
    const pending = rawPending.filter((value): value is string => typeof value === 'string');
    if (pending.length > 0) {
      const files = pending.map(f => f.split('/').pop() ?? f).join(', ');
      lines.push(
        `- Novel claim detected in ${files} — verify with /quality-review before building on it.`,
      );
      state.learningsNudgesAcknowledged ??= [];
      state.learningsNudgesAcknowledged.push(...pending);
      state.learningsNudgesPending = [];
      stateDirty = true;
    }
  } catch {
    // State file corrupted or unreadable — skip reminder, keep core principles
  } finally {
    // A reminder failure after the boundary is observed must not keep the
    // session in its quiet period. Keep the prompt hook best-effort if the
    // final state write itself fails.
    if (stateDirty && state !== undefined) {
      try {
        writeFileSync(stateFile, JSON.stringify(state, null, 2));
      } catch {
        // State write failed — preserve core prompt guidance
      }
    }
  }
}

// Resolved only after the state block above, which decides whether an active
// TDD step reduces this to the lead-only cue.
anchors.push(`- ${replyFormatReminder}`);

// Readiness pointer (TPP6Y2): compressed five-dimension self-test, surfaced
// during Clarify (no resolvable phase or intake) and suppressed once a build
// phase is under way. Fires whether or not a state file exists, so the
// motivating first-turn / pre-classify case is covered.
if (shouldSurfaceReadiness(effectivePhase)) {
  lines.push(`- ${READINESS_POINTER}`);
}

// Layer 3: Cross-session escalation suggestion from counter file
try {
  const counters = readCounters(projectDirectory);
  let countersUpdated = false;

  for (const [pattern, counter] of Object.entries(counters)) {
    const sinceLastSuggestion = counter.count - (counter.countAtLastSuggestion ?? 0);
    if (counter.count >= ESCALATION_THRESHOLD && sinceLastSuggestion >= ESCALATION_THRESHOLD) {
      const suggestion = getEscalationSuggestion(pattern, counter.count);
      if (suggestion) {
        lines.push(`- ${suggestion}`);
        counter.countAtLastSuggestion = counter.count;
        countersUpdated = true;
      }
    }
  }

  if (countersUpdated) {
    writeCounters(projectDirectory, counters);
  }
} catch {
  // Counter file missing or corrupted — skip escalation
}

lines.push('- Avoid bloat.');
console.log([...anchors, ...lines].join('\n'));

function tddNextStep(step: string): string {
  const next: Record<string, string> = {
    red: 'Write a minimal failing test for the next scenario.',
    green: 'Next: refactor while keeping tests green.',
    refactor: 'Next: pick next unchecked scenario.',
  };
  return next[step] ?? '';
}

/** Get failure injection text based on most relevant failure for current phase. */
function getFailureInjection(failures: FailureEntry[], phase: string): string | null {
  // Phase-relevant failure mapping
  const relevanceMap: Record<string, string> = {
    implement: 'loc-exceeded',
    done: 'done-gate-tests-failed',
  };

  const relevantPattern = relevanceMap[phase];
  const match = relevantPattern ? failures.find(f => f.pattern === relevantPattern) : null;

  // Use phase-relevant match, or fall back to most recent failure
  const failure = match ?? failures[failures.length - 1];
  if (!failure) return null;

  const messages: Record<string, string> = {
    'loc-exceeded': '(You hit the LOC gate earlier — commit before this grows.)',
    'done-gate-tests-failed': '(Tests failed at done last time — run /verify before stopping.)',
  };

  return messages[failure.pattern] ?? `(Previous failure: ${failure.pattern})`;
}

/** Get escalation suggestion for a repeated failure pattern. */
function getEscalationSuggestion(pattern: string, count: number): string | null {
  const suggestions: Record<string, string> = {
    'loc-exceeded': 'Commit frequently during implement phase — the LOC gate fires at 400 lines.',
    'done-gate-tests-failed': 'Run /verify before attempting to mark a ticket done.',
  };

  const suggestion = suggestions[pattern];
  if (!suggestion) return null;

  return `Pattern "${pattern}" has fired ${count} times across sessions. Consider adding to CLAUDE.md: "${suggestion}"`;
}
