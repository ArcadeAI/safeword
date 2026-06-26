#!/usr/bin/env bun
// Safeword: Auto Quality Review Stop Hook
// Triggers quality review when edit tools (Write/Edit/MultiEdit/NotebookEdit) are used
// Phase-aware: reads ticket phase for context-appropriate review questions

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import {
  deriveTddStep,
  getActiveTicket,
  getTicketInfo,
  resolveStopPhase,
} from './lib/active-ticket.ts';
import { formatDependencyRecovery, getDependencyReadiness } from './lib/dependency-readiness.ts';
import { checkVerifyArtifact } from './lib/done-gate.ts';
import { findNextWork, updateTicketStatus } from './lib/hierarchy.ts';
import { hasCitation, parseImplPlan, sectionBody } from './lib/impl-plan.ts';
import { validateLedger, wholeTicketPassApplies } from './lib/ledger-validation.ts';
import {
  AUTHOR_MODEL_ENV,
  hashArtifact,
  isArchitectureReviewGateEnabled,
  isCrossModelReviewRequired,
  modelsMatch,
  parseReviewStamps,
  reviewGateForNextAsset,
  reviewScope,
} from './lib/review-ledger.ts';
import { type BddPhase, getDisqualificationMessage, getQualityMessage } from './lib/quality.ts';
import {
  EXPLAIN_HINT,
  type FailureEntry,
  getStateFilePath,
  readSessionState,
  recordFailure,
} from './lib/quality-state.ts';
import { shouldReviewPhase } from './lib/review-trigger.ts';
import { analyzeScenarioFormat } from './lib/scenario-format.ts';
import { checkSkillInvocations, requiredSkillsForDone } from './lib/skill-invocation-log.ts';
import { runTests } from './lib/test-runner.ts';
import { changedFilesSinceHead, evaluateImplementStopTypecheck } from './lib/typecheck-gate.ts';
import { resolveNamespaceRoot } from './lib/namespace-root.ts';

interface HookInput {
  session_id?: string;
  transcript_path?: string;
  stop_hook_active?: boolean;
  last_assistant_message?: string;
}

interface ContentItem {
  type: string;
  text?: string;
  name?: string; // tool_use: tool name
}

interface TranscriptMessage {
  type: string; // "assistant" | "user" | etc at top level
  message?: {
    role?: string;
    content?: ContentItem[];
  };
}

const EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
/** How many recent assistant messages to scan for edit tool usage. */
const MAX_MESSAGES_FOR_TOOLS = 5;

/** Evidence patterns for done-phase validation (matched against Claude's last message text). */
const TEST_EVIDENCE_PATTERN = /\d+\/\d+\s*tests?\s*pass/i; // "156/156 tests pass" or "✓ 156/156 tests pass"
const USAGE_LIMIT_PATTERN = /\b(usage limit reached|5-hour limit reached)\b/i;

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const safewordDir = `${projectDir}/.safeword`;
const ticketsDir = `${resolveNamespaceRoot(projectDir)}/tickets`;

interface TicketInfo {
  phase: BddPhase | undefined;
  type: string | undefined;
  folder: string | undefined;
}

/**
 * Resolve the active ticket for this session.
 * Uses session state binding first (session-scoped), falls back to global scan
 * (needed for hierarchy navigation after done gate passes).
 */
function getCurrentTicketInfo(sessionId?: string): TicketInfo {
  const empty: TicketInfo = { phase: undefined, type: undefined, folder: undefined };

  // Try session-scoped resolution first
  if (sessionId) {
    const state = readSessionState(projectDir, sessionId);
    if (!state) return fallbackGlobalScan();

    if (!state.activeTicket) return empty;

    const ticket = getTicketInfo(projectDir, state.activeTicket);
    // resolveStopPhase closes the status/phase done-gate sidestep (ticket
    // 2JMQMX): a build ticket or epic flipped to status:done without reaching
    // phase:done is surfaced as phase:'done' so the done-gate still runs.
    const hasTestDefinitions =
      ticket.folder !== undefined &&
      existsSync(`${ticketsDir}/${ticket.folder}/test-definitions.md`);
    const resolved = resolveStopPhase(ticket, hasTestDefinitions);

    return {
      phase: resolved.phase as BddPhase | undefined,
      type: resolved.type,
      folder: resolved.folder,
    };
  }

  return fallbackGlobalScan();
}

/**
 * Record which phase boundary the Stop backstop just reviewed, so a later Stop
 * or PostToolUse review won't re-review it. Mirrors the marker PostToolUse sets
 * for phase changes (ticket SXSCJQ).
 */
function recordReviewMarker(
  sessionId: string | undefined,
  patch: { lastReviewedPhase?: string },
): void {
  if (!sessionId) return;
  const stateFile = getStateFilePath(projectDir, sessionId);
  if (!existsSync(stateFile)) return;
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    Object.assign(state, patch);
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch {
    // Best effort — don't crash stop hook on state write failure
  }
}

/** Global scan fallback — used when no session state exists */
function fallbackGlobalScan(): TicketInfo {
  const info = getActiveTicket(projectDir);
  return {
    phase: info.phase as BddPhase | undefined,
    type: info.type,
    folder: info.folder,
  };
}

/**
 * Check if all scenarios in test-definitions.md are complete.
 * Counts GFM task list checkboxes (- [x] / - [ ]). Headings (## Rule:)
 * are organizational only — the hook counts checkboxes, not headers.
 * Returns true if all checkboxes are checked, false otherwise.
 */
function checkScenariosComplete(ticketInfo: TicketInfo): boolean {
  if (!ticketInfo.folder) return false;
  const testDefsPath = `${ticketsDir}/${ticketInfo.folder}/test-definitions.md`;
  if (!existsSync(testDefsPath)) return false;

  const content = readFileSync(testDefsPath, 'utf8');
  const { checked, unchecked, isUnrecognized } = analyzeScenarioFormat(content);

  if (isUnrecognized) {
    hardBlockDone(
      'test-definitions.md has content but no GFM checkboxes (- [ ] / - [x]). Unrecognized scenario format — convert to GFM task list items.',
    );
  }

  const total = checked + unchecked;
  return total > 0 && unchecked === 0;
}

/**
 * Check cumulative artifact requirements for features.
 * Features at scenario-gate+ phases require test-definitions.md with at least one scenario.
 * Uses hardBlockDone — no stop_hook_active bypass. A feature with no scenarios is broken.
 */
function checkCumulativeArtifacts(ticketInfo: TicketInfo): void {
  // Only enforce for features
  if (ticketInfo.type !== 'feature') return;
  if (!ticketInfo.folder || !ticketInfo.phase) return;

  // Phases that require test-definitions.md
  const phasesRequiringTestDefs = ['scenario-gate', 'implement', 'done'];
  if (!phasesRequiringTestDefs.includes(ticketInfo.phase)) return;

  const testDefsPath = `${ticketsDir}/${ticketInfo.folder}/test-definitions.md`;

  if (!existsSync(testDefsPath)) {
    hardBlockDone(
      `Feature at ${ticketInfo.phase} phase requires test-definitions.md. Create it with at least one scenario before stopping.`,
    );
  }

  // File exists — verify it has at least one scenario (not empty/stub).
  // Counts GFM task list checkboxes (- [ ] / - [x]). Threshold: > 0.
  const content = readFileSync(testDefsPath, 'utf8');
  const scenarioCount = (content.match(/^\s*- \[.\]/gm) ?? []).length;
  if (scenarioCount === 0) {
    hardBlockDone(
      `Feature at ${ticketInfo.phase} phase: test-definitions.md has no scenarios defined. Add at least one before stopping.`,
    );
  }
}

/**
 * Check the impl-plan artifact for new-flow features (tickets XDNSZA + ERVA6V).
 * Features with spec.md (post-DZ2NM5 flow) at implement+ require an
 * impl-plan.md whose five sections are content-or-skip valid; from verify
 * onward its status must be `implemented` — the plan-vs-actual reconciliation
 * at implement exit flips it. Authored at scenario-gate exit; grandfathered
 * tickets (no spec.md) and tasks are exempt.
 */
function checkImplPlanArtifact(ticketInfo: TicketInfo): void {
  if (ticketInfo.type !== 'feature') return;
  if (!ticketInfo.folder || !ticketInfo.phase) return;

  const phasesRequiringImplPlan = ['implement', 'verify', 'done'];
  if (!phasesRequiringImplPlan.includes(ticketInfo.phase)) return;

  // Grandfathering: spec.md presence routes new-flow vs pre-spec tickets (DZ2NM5 D5).
  if (!existsSync(`${ticketsDir}/${ticketInfo.folder}/spec.md`)) return;

  const implPlanPath = `${ticketsDir}/${ticketInfo.folder}/impl-plan.md`;
  if (!existsSync(implPlanPath)) {
    hardBlockDone(
      `Feature at ${ticketInfo.phase} phase requires impl-plan.md (authored at scenario-gate exit). Create it from the impl-plan template with all five sections (or skip: <reason> per section) before stopping.`,
    );
  }

  const { status, errors } = parseImplPlan(readFileSync(implPlanPath, 'utf8'));
  if (errors.length > 0) {
    hardBlockDone(`impl-plan.md validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
  }

  // Reconciliation gate (ERVA6V): the plan must reflect shipped reality
  // before the ticket advances past implement.
  const phasesRequiringImplemented = ['verify', 'done'];
  if (phasesRequiringImplemented.includes(ticketInfo.phase) && status !== 'implemented') {
    hardBlockDone(
      `Impl plan reconciliation incomplete: impl-plan.md status is "${status ?? 'unknown'}". Walk Decisions, Arch alignment, and Known deviations against what shipped, then set **Status:** implemented (see TDD.md "Implement exit: reconcile the plan").`,
    );
  }
}

/**
 * Architecture review gate (ticket MR5M3A). DEFAULT-OFF: fires only when
 * `.safeword/config.json` sets `architectureReviewGate: true`. For a new-flow
 * feature leaving implement (verify/done), require (a) the impl-plan Decisions
 * section to carry cited evidence — the /figure-it-out trace — and (b) a
 * design-review stamp bound to this ticket's impl-plan at its current content.
 * When `crossModelReview` is set, the satisfying real-review stamp must record a
 * model different from the author's (env `SAFEWORD_AUTHOR_MODEL`); an absent tag
 * fails closed. Runs AFTER checkImplPlanArtifact, so absent/malformed plans were
 * already blocked there (precedence). Skips and exemptions are auditable.
 */
function checkArchitectureReviewGate(ticketInfo: TicketInfo): void {
  if (ticketInfo.type !== 'feature' || !ticketInfo.folder || !ticketInfo.phase) return;
  if (!['verify', 'done'].includes(ticketInfo.phase)) return;

  const configPath = `${projectDir}/.safeword/config.json`;
  const rawConfig = existsSync(configPath) ? readFileSync(configPath, 'utf8') : undefined;
  if (!isArchitectureReviewGateEnabled(rawConfig)) return;

  // Grandfathered (no spec.md) features are exempt, mirroring checkImplPlanArtifact.
  if (!existsSync(`${ticketsDir}/${ticketInfo.folder}/spec.md`)) return;

  const implPlanPath = `${ticketsDir}/${ticketInfo.folder}/impl-plan.md`;
  if (!existsSync(implPlanPath)) return; // existence is checkImplPlanArtifact's block (precedence)
  const planContent = readFileSync(implPlanPath, 'utf8');
  const parsed = parseImplPlan(planContent);
  if (parsed.errors.length > 0) return; // parse errors are checkImplPlanArtifact's block (precedence)

  // Generation half: Decisions carries a citation, or an auditable skip.
  const decisionsSkip = parsed.sections.Decisions?.skip;
  const decisionsSkipped = typeof decisionsSkip === 'string' && decisionsSkip.trim() !== '';
  if (!decisionsSkipped && !hasCitation(sectionBody(planContent, 'Decisions'))) {
    hardBlockDone(
      'Architecture review gate: the impl-plan Decisions section needs cited evidence (a URL or a [n] source-reference marker) — the trace that real evidence was weighed. Add a citation, or mark the section `skip: <reason>`.',
    );
  }

  // Selection half: a satisfying design-review stamp for this ticket's plan at its current content.
  const logPath = `${resolveNamespaceRoot(projectDir)}/skill-invocations.log`;
  const stamps = existsSync(logPath) ? parseReviewStamps(readFileSync(logPath, 'utf8')) : [];
  const scope = reviewScope(ticketInfo.folder, 'impl-plan', hashArtifact(planContent));
  if (!reviewGateForNextAsset(scope, stamps).ok) {
    hardBlockDone(
      'Architecture review gate: the impl-plan design has no independent design review at its current content. Spawn a fresh-context reviewer, then run `bun .safeword/hooks/write-review-stamp.ts impl-plan` on pass (or log a skip with a reason).',
    );
  }

  // Ceiling-raiser: under cross-model, a real-review stamp must record a model different from
  // the author. Evaluate over ALL real-review stamps at this scope (the log is append-only, so a
  // corrected re-review can sit after a same-model attempt) — pass if any is cross-model. A logged
  // skip records no real-review stamp, so it deliberately bypasses cross-model: that is the same
  // auditable escape valve every safeword gate carries, not an oversight.
  if (isCrossModelReviewRequired(rawConfig)) {
    const realReviews = stamps.filter(s => s.scope === scope && s.skipReason === undefined);
    const hasCrossModelReview = realReviews.some(
      s => !modelsMatch(s.model, process.env[AUTHOR_MODEL_ENV]),
    );
    if (realReviews.length > 0 && !hasCrossModelReview) {
      hardBlockDone(
        'Architecture review gate (cross-model): the design review must be performed by a different model than the author. Re-run with an explicit different-model subagent (not a context:fork, which inherits the author model), recording it via `write-review-stamp.ts --model <id> impl-plan`.',
      );
    }
  }
}

// Not a safeword project, skip silently
if (!existsSync(safewordDir)) {
  process.exit(0);
}

// Read hook input from stdin
let input: HookInput;
try {
  input = await Bun.stdin.json();
} catch {
  process.exit(0);
}

// Loop guard: if stop hook already triggered a continuation and no new edits,
// allow Claude to stop. Prevents infinite quality review loops.
const stopHookActive = input.stop_hook_active ?? false;

const transcriptPath = input.transcript_path;
if (!transcriptPath) {
  process.exit(0);
}

const transcriptFile = Bun.file(transcriptPath);
if (!(await transcriptFile.exists())) {
  process.exit(0);
}

// Read transcript (JSONL format)
const transcriptText = await transcriptFile.text();
const lines = transcriptText.trim().split('\n');

checkUsageLimit(lines);

// Claude's last response text — provided directly by the hook runtime.
const combinedText = input.last_assistant_message ?? '';

// Get ticket info for phase-aware decision logic. Resolved BEFORE the edit-tools
// gate so the done-phase branch runs on any stop at phase: done — closing and its
// evidence enforcement depend on ticket state, not recent edit activity (ticket
// AP3FGJ). The edit-tools gate below then guards only the review/backstop path.
const ticketInfo = getCurrentTicketInfo(input.session_id);
const currentPhase = ticketInfo.phase;

// Artifact gates are phase/state-driven, not edit-activity-driven, so they run BEFORE the
// edit-tools early-exit below — a missing impl-plan or an unreviewed design must block a stop
// whether or not the recent transcript window contained an edit (ticket MR5M3A). The edit-tools
// gate then guards only the review/backstop path.
checkCumulativeArtifacts(ticketInfo);
checkImplPlanArtifact(ticketInfo);
checkArchitectureReviewGate(ticketInfo);

// No edit tools used → skip the review path (a conversational response has
// nothing to review). The done phase is the exception: fall through to its gate.
if (!detectEditToolsUsed(lines) && currentPhase !== 'done') {
  process.exit(0);
}

/**
 * Check last transcript line for usage limit phrases.
 * Exits with code 1 if found — avoids false positives from conversation content
 * by checking only the final message and capping text length at 200 chars.
 */
function checkUsageLimit(transcriptLines: string[]): void {
  try {
    const lastLine = transcriptLines[transcriptLines.length - 1] ?? '';
    const lastMessage: TranscriptMessage = JSON.parse(lastLine);
    const textContent =
      lastMessage.message?.content
        ?.filter(
          (item): item is ContentItem & { text: string } => item.type === 'text' && !!item.text,
        )
        .map(item => item.text)
        .join('') ?? '';
    if (
      textContent.length > 0 &&
      textContent.length < 200 &&
      USAGE_LIMIT_PATTERN.test(textContent)
    ) {
      console.error('Claude usage limit reached. Try again after reset.');
      process.exit(1);
    }
  } catch {
    // Not valid JSON or missing structure - continue with normal processing
  }
}

/**
 * Scan the last MAX_MESSAGES_FOR_TOOLS assistant messages for edit tool usage.
 * Returns true if Write/Edit/MultiEdit/NotebookEdit appears in any recent message.
 */
function detectEditToolsUsed(transcriptLines: string[]): boolean {
  let checked = 0;
  for (let i = transcriptLines.length - 1; i >= 0 && checked < MAX_MESSAGES_FOR_TOOLS; i--) {
    try {
      const message: TranscriptMessage = JSON.parse(transcriptLines[i]);
      if (message.type === 'assistant' && message.message?.content) {
        checked++;
        for (const item of message.message.content) {
          if (item.type === 'tool_use' && item.name && EDIT_TOOLS.has(item.name)) return true;
        }
      }
    } catch {
      // Skip invalid JSON lines
    }
  }
  return false;
}

/**
 * Get done gate message based on ticket type.
 */
function getDoneHardBlockMessage(ticketType: string | undefined, missingAudit: boolean): string {
  if (missingAudit) {
    return `Done phase requires audit evidence. Run /audit and show results.

Expected evidence format:
- "Audit passed" or "Audit passed with warnings"

Run /audit, show output, then try again.`;
  }

  const auditLine =
    ticketType === 'feature' ? '\n- "Audit passed" (required for features — run /audit)' : '';

  return `Done phase requires evidence. Run /verify and show results.

Expected evidence formats:
- "✓ X/X tests pass" or "X/X tests pass" (required for tasks with no test command)
- "**Gherkin:** ✅ Acceptance lane passes" or "Skipped — no test:bdd script" (acceptance lane evidence)${auditLine}
- "**PR Scope:** ✅ Diff matches ticket scope" or a skipped status with a reason

Run /verify, show output, then try again.`;
}

/**
 * Hard block for done phase — requires specific evidence before Claude can stop.
 * No bypass: stop_hook_active does not skip this check.
 */
function hardBlockDone(reason: string): never {
  // systemMessage surfaces the hint to the USER (the `reason` field reaches the
  // model, not reliably the human — issue #17356). Additive: reason unchanged.
  console.log(
    JSON.stringify({
      decision: 'block',
      reason: `${reason}\n\n${EXPLAIN_HINT}`,
      systemMessage: EXPLAIN_HINT,
    }),
  );
  process.exit(0);
}

/**
 * Bypassable block — delivers a reason or instruction to Claude via JSON decision:block.
 * The stop_hook_active guard (below) allows one bypass per review cycle to prevent loops.
 * Used for: quality review prompts, navigation instructions.
 */
function softBlock(reason: string): never {
  console.log(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

// Decision logic:
// 1. Cumulative artifact missing/empty → hardBlockDone (no bypass; a feature with no scenarios is broken)
// 2. Done phase with missing evidence → hardBlockDone (no bypass; loops until evidence present)
// 3. Done phase with evidence → allow (exit 0)
// 4. Other phases → softBlock with quality review prompt (one-shot judgment; not enforcement)

// Cumulative-artifact, impl-plan, and architecture-review gates ran earlier (hoisted above the
// edit-tools early-exit) so they enforce on phase/state, not on recent edit activity.

if (currentPhase === 'done') {
  // Done phase: require evidence before allowing stop.
  // Features need test + Gherkin acceptance + scenario + audit evidence; tasks need test only.
  const isFeature = ticketInfo.type === 'feature';

  // Dependencies must be installed before the test gate can run. Otherwise a
  // missing toolchain surfaces as a false "tests failed" (the runner's command
  // exits 127). Fail closed with the install recovery instead — a verification
  // gate that cannot run its check must not pass. The recovery (`bun ci`) is
  // idempotent and re-stamps the freshness marker, so even a false `stale`
  // self-heals on the next install. (Issue #325.)
  const readiness = getDependencyReadiness(projectDir);
  if (readiness.status === 'missing' || readiness.status === 'stale') {
    recordFailure(projectDir, input.session_id, 'done-gate-deps-missing');
    hardBlockDone(formatDependencyRecovery(readiness));
  }

  // Run tests directly — authoritative external gate, cannot be gamed by prose.
  // skipped=true means no test command found (package.json missing or no scripts.test).
  const testResult = runTests(projectDir);
  if (!testResult.skipped && !testResult.passed) {
    // toolchainMissing covers the readiness check's blind spot: an `unsupported`
    // project (no recognized lockfile) whose test binary is still absent. Surface
    // the missing-toolchain cause, not a misleading red-test verdict.
    if (testResult.toolchainMissing) {
      recordFailure(projectDir, input.session_id, 'done-gate-toolchain-missing');
      hardBlockDone(
        `Test toolchain not found — dependencies are likely not installed. Install them, then retry.\n\n${testResult.output}`,
      );
    }
    recordFailure(projectDir, input.session_id, 'done-gate-tests-failed');
    hardBlockDone(`Tests failed. Fix failures before marking done.\n\n${testResult.output}`);
  }

  const hasScenarios = checkScenariosComplete(ticketInfo);

  // Read the ledger once: the whole-ticket quality-review + refactor pass
  // (W610WW) gates on whether it applies to this ledger, and ledger validation
  // reuses the same content. A ticket with no test-definitions.md → pass N/A.
  let ledgerContent: string | undefined;
  let wholeTicketPass = false;
  if (ticketInfo.folder) {
    const testDefsPath = `${ticketsDir}/${ticketInfo.folder}/test-definitions.md`;
    if (existsSync(testDefsPath)) {
      ledgerContent = readFileSync(testDefsPath, 'utf8');
      wholeTicketPass = wholeTicketPassApplies(ledgerContent);
    }
  }

  // Verify.md artifact gate — replaces text-pattern matching for audit evidence.
  // verify.md is written by /verify skill when all checks pass, including the
  // PR-scope evidence that keeps unrelated work out of the closing change.
  if (ticketInfo.folder) {
    const verifyPath = `${ticketsDir}/${ticketInfo.folder}/verify.md`;
    const verifyExists = existsSync(verifyPath);
    const verifyContent = verifyExists ? readFileSync(verifyPath, 'utf8') : '';
    const verifyValid = verifyContent.trim().length > 0;

    if (!verifyValid) {
      recordFailure(projectDir, input.session_id, 'done-gate-tests-failed');
      hardBlockDone(
        `No valid verify.md found in ticket folder. Run /verify to generate evidence before marking done.`,
      );
    }

    const verifyArtifactStatus = checkVerifyArtifact(verifyContent);
    if (!verifyArtifactStatus.ok) {
      recordFailure(projectDir, input.session_id, 'done-gate-tests-failed');
      hardBlockDone(verifyArtifactStatus.reason ?? 'verify.md PR scope evidence is invalid.');
    }
  }

  // Skill-invocation gate (ticket 147 + W610WW) — required skills follow the
  // whole-ticket pass: features keep /verify + /audit; any ticket the pass
  // applies to (≥2 annotated loops — see wholeTicketPassApplies) also needs
  // /quality-review (the review half of the cross-scenario pass). Single-loop and
  // pure-legacy tickets require nothing, so the gate is silent for them. Helper
  // invocation in those skills writes the log; hand-written verify.md cannot
  // produce the entries. Honors stop_hook_active.
  const requiredSkills = requiredSkillsForDone(isFeature, wholeTicketPass);
  if (requiredSkills.length > 0 && !stopHookActive && input.session_id) {
    const skillCheck = checkSkillInvocations({
      sessionId: input.session_id,
      required: requiredSkills,
      rootDirectory: projectDir,
    });
    if (!skillCheck.ok) {
      recordFailure(projectDir, input.session_id, 'done-gate-tests-failed');
      const missingList = skillCheck.missing.map(s => `/${s}`).join(' and ');
      hardBlockDone(
        `Required skill invocation(s) missing in this session: ${missingList}. Run ${missingList} before marking this ticket done. The helper-written log (skill-invocations.log under the project namespace root) proves current-session invocation; hand-written verify.md does not satisfy this gate. If you ran ${missingList} but no session-scoped proof was logged, inline shell execution may have been denied, the fallback helper may not have been run, the client may not have provided a compatible session id, or Bun could not run the installed helper. Check the invocation-log block at the top of the skill and .safeword/hooks/record-skill-invocation.ts.`,
      );
    }
  }

  if (isFeature) {
    // Features: require all scenarios complete (tests already verified above, verify.md checked above)
    if (!hasScenarios) {
      recordFailure(projectDir, input.session_id, 'done-gate-tests-failed');
      hardBlockDone(
        `Not all scenarios are complete in test-definitions.md. Mark all scenario checkboxes [x] before marking done.`,
      );
    }
  } else if (testResult.skipped) {
    // Tasks with no test command: fall back to text evidence
    if (!TEST_EVIDENCE_PATTERN.test(combinedText)) {
      recordFailure(projectDir, input.session_id, 'done-gate-tests-failed');
      hardBlockDone(getDoneHardBlockMessage(ticketInfo.type, false));
    }
  }

  // Annotation ledger validation (ticket J7VBGJ, Rules 3 + 4 + W610WW): runs for
  // ANY build ticket with a test-definitions.md — task or feature, not fenced to
  // features. Every [x] R/G/R checkbox must carry a SHA or skip:<reason>; SHAs
  // distinct and reachable; at least one real SHA per scenario; the cross-scenario
  // refactor row present and valid when the whole-ticket pass applies (≥2 annotated
  // loops). Pure-legacy and single-loop tickets are exempt inside validateLedger.
  if (ledgerContent !== undefined) {
    const isReachable = (sha: string): boolean => {
      try {
        // execFileSync (no shell) — sha is a file-derived annotation value;
        // passing it as an arg, not interpolated into a shell string, closes
        // the command-injection sink (ledger-validation also rejects non-hex).
        execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], {
          cwd: projectDir,
          stdio: 'pipe',
        });
        return true;
      } catch {
        return false;
      }
    };
    const validation = validateLedger(ledgerContent, isReachable);
    if (!validation.ok) {
      recordFailure(projectDir, input.session_id, 'done-gate-ledger-invalid');
      hardBlockDone(
        `TDD annotation ledger validation failed in test-definitions.md:\n${validation.errors.map(e => `  - ${e}`).join('\n')}`,
      );
    }
  }

  // Evidence passed — mark current ticket done and navigate hierarchy
  if (ticketInfo.folder) {
    const currentTicketDirectory = `${ticketsDir}/${ticketInfo.folder}`;
    updateTicketStatus(currentTicketDirectory, 'done', 'done');

    // Walk hierarchy: cascade done status up and navigate to next sibling
    let directory = currentTicketDirectory;
    const MAX_CASCADE = 10;
    for (let depth = 0; depth < MAX_CASCADE; depth++) {
      const next = findNextWork(directory, ticketsDir);
      if (next.type === 'navigate') {
        const nextInfo = getTicketInfo(projectDir, next.ticketId);
        const nextLabel = nextInfo.slug ? `${nextInfo.slug} (${next.ticketId})` : next.ticketId;
        softBlock(
          `Ticket complete! Next up: read ${next.ticketDirectory}/ticket.md and begin work on ${nextLabel}.`,
        );
      } else if (next.type === 'cascade-done') {
        // Mark parent done and continue walking up
        updateTicketStatus(next.ticketDirectory, 'done', 'done');
        directory = next.ticketDirectory;
      } else {
        // all-done — no more work in hierarchy
        break;
      }
    }
  }

  process.exit(0);
}

// Heavyweight tier: quality review prompt (judgment-based, not enforcement).
// Loop prevention: if stop_hook_active, the previous review cycle already ran — allow stop.
if (stopHookActive) {
  process.exit(0);
}

// SW1SE5: implement-phase incremental typecheck. Runs BEFORE the LOC review
// throttle — a small change can break types — and surfaces tsc errors as advice
// via the soft (non-blocking) path. Silent when clean (the gate skips non-TS
// projects, no-TS-change stops, and the done phase). The done gate stays the
// hard backstop; this never hard-blocks.
const typecheckAdvice = evaluateImplementStopTypecheck({
  projectDirectory: projectDir,
  changedFiles: changedFilesSinceHead(projectDir),
  phase: currentPhase,
});
if (typecheckAdvice.advice !== null) {
  softBlock(
    `TypeScript errors in your changed files — advisory, not a block (fix now, or stop and address later). The done gate still requires a clean typecheck.\n\n${typecheckAdvice.advice}`,
  );
}

// Boundary backstop: phase reviews are no longer LOC-throttled. Implement-step
// TDD reviews are quiet by default; the real work still happens internally and
// hard/anomaly gates above still surface when action is needed.
const sessionState = readSessionState(projectDir, input.session_id);

// Derive TDD step from test-definitions.md (not cache)
const tddStep =
  currentPhase === 'implement' && ticketInfo.folder
    ? deriveTddStep(projectDir, ticketInfo.folder)
    : null;

// No ticket/phase context (no active ticket, or a done-status ticket): fire the
// generic review on every edit-stop, as before — there's no boundary to dedup.
// With a phase: review per phase, deduped against PostToolUse so each boundary
// is reviewed once. Implement-step reviews stay quiet.
const isImplementStep = currentPhase === 'implement' && tddStep !== null;
let fireReview: boolean;
if (currentPhase === undefined) {
  fireReview = true;
} else if (isImplementStep) {
  fireReview = false;
} else {
  fireReview = shouldReviewPhase(currentPhase, sessionState?.lastReviewedPhase);
}

if (!fireReview) {
  process.exit(0);
}

if (currentPhase) {
  recordReviewMarker(input.session_id, { lastReviewedPhase: currentPhase });
}

// Disqualification: when novelResearchReminder is unconsumed or a phase-relevant
// recent failure exists, append an explicit "CONFIDENT requires X first" line so
// the agent doesn't rubber-stamp confidence (143).
const phaseFailurePatterns: Record<string, string> = {
  implement: 'loc-exceeded',
  done: 'done-gate-tests-failed',
};
const relevantPattern = phaseFailurePatterns[currentPhase];
const recentRelevant = relevantPattern
  ? (sessionState?.recentFailures ?? []).find((f: FailureEntry) => f.pattern === relevantPattern)
      ?.pattern
  : undefined;
const baseMessage = getQualityMessage(currentPhase, tddStep);
const disqual = getDisqualificationMessage({
  pendingLearningsNudges: sessionState?.learningsNudgesPending ?? [],
  recentRelevantFailure: recentRelevant,
});
softBlock(disqual ? `${baseMessage}\n\n${disqual}` : baseMessage);
