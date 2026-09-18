#!/usr/bin/env bun
// Safeword: Quality Gates - PreToolUse enforcer
// Two-purpose: LOC gate (blast radius control) + artifact prerequisite check
// Fires on Edit|Write|MultiEdit|NotebookEdit

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readlinkSync, realpathSync, statSync } from 'node:fs';
import nodePath from 'node:path';

import {
  evaluateFeatureTicketReadiness,
  formatFeatureTicketReadiness,
  getTicketInfo,
  parseTddStep,
} from './lib/active-ticket.ts';
import { detectInspirationArtifactWrite, detectLedgerWrite } from './lib/bash-ledger-writes.ts';
import { commandInvokesCloseoutCleanup, rememberCloseoutBinding } from './lib/closeout-binding.ts';
import { detectBroadProcessKill } from './lib/process-kill-guard.ts';
import { evaluateBlockedOnGate } from './lib/blocked-on-gate.ts';
import { isGitOperationInProgress } from './lib/git-operation.ts';
import { applyUniqueEdit, collectNewTransitions } from './lib/checkbox-transitions.ts';
import { parseFrontmatter } from './lib/hierarchy.ts';
import { evaluateCriteriaGate, evaluateJtbdGate } from './lib/jtbd.ts';
import { hasInspirationActivationCandidate } from './lib/inspiration.ts';
import { classifyAnnotation, isValidSha, isValidSkipReason } from './lib/parse-annotation.ts';
import {
  AUTHOR_MODEL_ENV,
  detectPhaseAdvance,
  gatePhaseAdvance,
  hashArtifact,
  isCrossModelReviewRequired,
  isSatisfyingCoordinatorReviewStamp,
  isReviewGateEnabled,
  reviewGateAppliesToPhase,
  modelsMatch,
  parseReviewStamps,
  readCrossAgentReviewPolicy,
  type ReviewStamp,
  reviewGateForNextAsset,
  reviewScope,
} from './lib/review-ledger.ts';
import {
  EXPLAIN_HINT,
  isMetaPath,
  LOC_THRESHOLD,
  readSessionState,
  recordFailure,
} from './lib/quality-state.ts';
import {
  isNamespacePath,
  resolveConfiguredPath,
  resolveNamespaceRoot,
} from './lib/namespace-root.ts';
import { reviewKindForPhase } from './lib/review-receipt.ts';
import { verifiedStamps } from './lib/verify-stamp-claims.ts';
import { evaluateTicketWrite } from './lib/phase-provenance.ts';
import { evaluateExecutionPlanningEntry, evaluateImplementEntry } from './lib/plan-gate.ts';
import { evaluateParentContract } from './lib/product-plan-contract.ts';
import { installCrashCapture } from './lib/self-report.ts';

installCrashCapture('pre-tool-quality');

const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'];

interface HookInput {
  session_id?: string;
  transcript_path?: string;
  tool_name?: string;
  tool_input?: {
    file_path?: string;
    notebook_path?: string;
    old_string?: string;
    new_string?: string;
    replace_all?: boolean;
    content?: string;
    edits?: Array<{ old_string?: string; new_string?: string }>;
    command?: string;
  };
}

/**
 * Matches `git commit`, including common global options before the subcommand,
 * but rejects `git commit-tree`, `git commit-graph`, etc.
 */
const GIT_COMMIT_COMMAND =
  /\bgit(?:\s+(?:-C\s+(?:"[^"]*"|'[^']*'|\S+)|--no-pager))*\s+commit\b(?!-)/;
const FEATURE_SOURCE_PATTERN = /^\s*(?:\*\*)?Feature source:(?:\*\*)?\s*`(?<path>[^`]+)`/im;

/**
 * Heuristic: a path is a test file if it matches *.test.* or *.spec.*, or lives
 * inside a tests/ or __tests__/ directory. Covers safeword's convention plus the
 * broader JS/TS ecosystem; intentionally permissive — false negatives just mean
 * the gate doesn't fire, false positives would block legitimate refactors.
 */
function isTestFile(path: string): boolean {
  return (
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) ||
    path.includes('/tests/') ||
    path.startsWith('tests/') ||
    path.includes('/__tests__/')
  );
}

/**
 * During Implementation Planning, the configured durable architecture record
 * is the one non-meta planning output that may be edited. The resolved target
 * must remain inside the project. A configured file matches exactly; an
 * existing configured directory permits its descendant ADR files, but never a
 * sibling that merely shares its name.
 */
function physicalPath(path: string): string | undefined {
  const missingSegments: string[] = [];
  let existing = path;
  while (!existsSync(existing)) {
    const parent = nodePath.dirname(existing);
    if (parent === existing) return undefined;
    missingSegments.unshift(nodePath.basename(existing));
    existing = parent;
  }
  try {
    return nodePath.resolve(realpathSync(existing), ...missingSegments);
  } catch {
    return undefined;
  }
}

function isInside(root: string, candidate: string): boolean {
  const relative = nodePath.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !nodePath.isAbsolute(relative));
}

function isConfiguredArchitectureRecordEdit(filePath: string, projectRoot: string): boolean {
  if (filePath.length === 0) return false;
  const target = nodePath.resolve(resolveConfiguredPath(projectRoot, 'architecture'));
  const targetFromProject = nodePath.relative(projectRoot, target);
  if (targetFromProject.startsWith('..') || nodePath.isAbsolute(targetFromProject)) return false;

  const edited = nodePath.resolve(projectRoot, filePath);
  const physicalProject = physicalPath(projectRoot);
  const physicalTarget = physicalPath(target);
  const physicalEdit = physicalPath(edited);
  if (
    physicalProject === undefined ||
    physicalTarget === undefined ||
    physicalEdit === undefined ||
    !isInside(physicalProject, physicalTarget)
  ) {
    return false;
  }
  if (physicalEdit === physicalTarget) return true;
  try {
    if (!statSync(target).isDirectory()) return false;
  } catch {
    return false;
  }
  return (
    nodePath.dirname(physicalEdit) === physicalTarget &&
    /^\d{8}-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.md$/u.test(nodePath.basename(edited)) &&
    isInside(physicalTarget, physicalEdit)
  );
}

/**
 * Read personas.md for the JTBD gate, honoring a configured `paths.personas`
 * (ticket K7N2QM). Degrades to '' when the file or config is absent/unreadable
 * — knownPersonaRefs('') yields an empty set, so unresolved refs are denied.
 */
function readPersonasForGate(): string {
  const projectRoot = projectDirectory;
  const personasPath = resolvePersonasPath(projectRoot);
  return existsSync(personasPath) ? readFileSync(personasPath, 'utf8') : '';
}

function resolvePersonasPath(projectRoot: string): string {
  const defaultPath = nodePath.join(resolveNamespaceRoot(projectRoot), 'personas.md');
  const configFile = nodePath.join(projectRoot, '.safeword', 'config.json');
  if (!existsSync(configFile)) return defaultPath;
  const configured = readConfiguredPersonasPath(readFileSync(configFile, 'utf8'));
  if (configured === undefined) return defaultPath;
  return nodePath.isAbsolute(configured) ? configured : nodePath.join(projectRoot, configured);
}

function readConfiguredPersonasPath(rawConfig: string): string | undefined {
  try {
    const parsed = JSON.parse(rawConfig) as { paths?: { personas?: unknown } };
    const configured = parsed.paths?.personas;
    return typeof configured === 'string' && configured.trim() !== '' ? configured : undefined;
  } catch {
    // Malformed config.json is pre-tool-config-guard's concern; the JTBD gate
    // degrades to the default personas path rather than blocking the edit.
    return undefined;
  }
}

/**
 * These gates read the PRE-edit filesystem, so a single `apply_patch` that adds a
 * prerequisite (ticket frontmatter, a phase change) AND the dependent artifact in
 * one shot is rejected even when its net result is valid — the prerequisite isn't
 * on disk yet when the gate runs (#385). Surface the ordered-patch workaround so
 * the block doesn't read as "you forgot these fields".
 */
const APPLY_PATCH_ORDERING_NOTE =
  'If editing via apply_patch: this gate evaluates the pre-edit filesystem, so a single patch adding the prerequisite and the dependent file together is rejected even if its net result is valid. Split into ordered patches — frontmatter first, phase second, scenario/test-definition files last.';

function withOrderingNote(context: string): string {
  return `${context} ${APPLY_PATCH_ORDERING_NOTE}`;
}

function deny(reason: string, additionalContext?: string): never {
  const output: Record<string, unknown> = {
    // systemMessage is the top-level field Claude Code surfaces to the USER
    // (permissionDecisionReason goes to the model and can be swallowed before the
    // user sees it — issue #17356). The hint rides both: the reason for the model
    // + Codex adapter, systemMessage for the human. Augment, never replace.
    systemMessage: EXPLAIN_HINT,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `${reason}\n\n${EXPLAIN_HINT}`,
      ...(additionalContext ? { additionalContext } : {}),
    },
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

/**
 * A required frontmatter field counts as missing when it is absent, the literal
 * string `'null'`, or empty — including an empty block sequence (which parses to
 * `[]`) or a list of only blank items.
 */
function isMissingFrontmatterField(value: string | string[] | undefined): boolean {
  if (value === undefined || value === 'null') return true;
  return Array.isArray(value) ? value.every(item => item.trim() === '') : value.trim() === '';
}

// Keep the host-provided spelling as the session identity: state files are keyed
// by that exact string. Use the canonical form only for filesystem containment
// and relative-path comparisons (`/var` and `/private/var` alias on macOS).
const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const canonicalProjectDirectory = realpathSync(projectDirectory);

// Tier 1 (per-asset) is off unless `.safeword/config.json` sets `reviewGate: true`
// — it is per-asset, so it has no phase to select on and stays all-or-nothing.
// Tier 2 asks reviewGateAppliesTo() instead, which also honors a phase list.
function isReviewGateOn(): boolean {
  const configFile = nodePath.join(projectDirectory, '.safeword', 'config.json');
  return isReviewGateEnabled(existsSync(configFile) ? readFileSync(configFile, 'utf8') : undefined);
}

// Whether the Tier 2 phase-exit gate enforces at THIS exit. `reviewGate: true`
// (or an absent key) enforces everywhere; a phase list enforces only where it is
// named (2VCSZY's selective posture).
function reviewGateAppliesTo(phase: string): boolean {
  const configFile = nodePath.join(projectDirectory, '.safeword', 'config.json');
  return reviewGateAppliesToPhase(
    existsSync(configFile) ? readFileSync(configFile, 'utf8') : undefined,
    phase,
  );
}

// Whether phase-exit reviews must run on a different model than the author
// (ticket 7A0B2K, reusing MR5M3A's `crossModelReview` knob). Off by default.
function isCrossModelOn(): boolean {
  const configFile = nodePath.join(projectDirectory, '.safeword', 'config.json');
  return isCrossModelReviewRequired(
    existsSync(configFile) ? readFileSync(configFile, 'utf8') : undefined,
  );
}

function crossAgentReviewPolicy() {
  const configFile = nodePath.join(projectDirectory, '.safeword', 'config.json');
  return readCrossAgentReviewPolicy(
    existsSync(configFile) ? readFileSync(configFile, 'utf8') : undefined,
  );
}

function safewordCliCommand(): [string, ...string[]] | 'project-writable' | undefined {
  const explicitCli = process.env.SAFEWORD_PLUGIN_CLI?.trim();
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT?.trim();
  const pluginCli =
    explicitCli !== undefined && explicitCli !== ''
      ? explicitCli
      : pluginRoot !== undefined && pluginRoot !== ''
        ? nodePath.join(pluginRoot, 'runtime', 'cli.js')
        : undefined;
  if (pluginCli === undefined) return undefined;
  try {
    const candidate = realpathSync(pluginCli);
    const project = realpathSync(projectDirectory);
    const relative = nodePath.relative(project, candidate);
    const insideProject =
      relative === '' ||
      (relative !== '..' &&
        !relative.startsWith(`..${nodePath.sep}`) &&
        !nodePath.isAbsolute(relative));
    if (insideProject) {
      return 'project-writable';
    }
    return ['bun', candidate];
  } catch {
    return undefined;
  }
}

function executableRedGateDenial(scenario: string, ledger: string): string | undefined {
  const commandParts = safewordCliCommand();
  if (commandParts === undefined) {
    return 'Safeword could not find its local CLI. Reinstall the Safeword plugin or set SAFEWORD_PLUGIN_CLI to the bundled runtime path.';
  }
  if (commandParts === 'project-writable') {
    return 'Safeword refused the configured CLI because its resolved path is inside the project and can be changed by project code. Point SAFEWORD_PLUGIN_CLI or CLAUDE_PLUGIN_ROOT at the installed plugin runtime.';
  }
  const [executable, ...prefix] = commandParts;
  const command = [executable, ...prefix].join(' ');
  const checked = spawnSync(
    executable,
    [
      ...prefix,
      '--json',
      '--no-input',
      '--cwd',
      projectDirectory,
      'review',
      'gate',
      'executable-red',
      '--scenario',
      scenario,
      '--ledger',
      ledger,
    ],
    { cwd: projectDirectory, encoding: 'utf8', timeout: 5000 },
  );
  try {
    const parsed = JSON.parse(checked.stdout) as {
      state?: unknown;
      findings?: Array<{ message?: unknown }>;
      data?: { status?: unknown; scenario?: unknown; ledger?: unknown };
    };
    if (
      checked.status === 0 &&
      parsed.state === 'healthy' &&
      parsed.data?.status === 'approved' &&
      parsed.data.scenario === scenario &&
      parsed.data.ledger === ledger
    )
      return undefined;
    const message = parsed.findings?.find(finding => typeof finding.message === 'string')?.message;
    return typeof message === 'string'
      ? message
      : 'The executable RED receipt check did not approve this scenario.';
  } catch {
    return `The executable RED receipt check could not produce a valid result from ${command}.`;
  }
}

function separateEvidenceMode(
  ledgerContent: string,
  scenario: string,
): 'manual' | 'live' | undefined {
  let activeScenario: string | undefined;
  for (const line of ledgerContent.split(/\r?\n/)) {
    const heading = line.match(/^#{2,6}\s+(?<scenario>.+)$/)?.groups?.scenario?.trim();
    if (heading !== undefined) activeScenario = heading;
    if (activeScenario !== scenario) continue;
    const mode = line.match(/^- \[x\]\s+RED\s+skip:\s*(?<mode>manual|live)\b/i)?.groups?.mode;
    if (mode === 'manual' || mode === 'live') return mode;
  }
  return undefined;
}

function featureScenarioHasTag(featureContent: string, scenario: string, tag: string): boolean {
  const title = scenario.replace(/^Scenario(?: Outline)?:\s*/i, '');
  let pendingTags: string[] = [];
  for (const line of featureContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('@')) {
      pendingTags = trimmed.split(/\s+/);
      continue;
    }
    const match = trimmed.match(/^Scenario(?: Outline)?:\s*(?<title>.+)$/i);
    if (match !== null) {
      if (match.groups?.title?.trim() === title) return pendingTags.includes(tag);
      pendingTags = [];
      continue;
    }
    if (trimmed !== '' && !trimmed.startsWith('#')) pendingTags = [];
  }
  return false;
}

function usesSeparateEvidencePath(ledgerContent: string, scenario: string): boolean {
  const mode = separateEvidenceMode(ledgerContent, scenario);
  const source = FEATURE_SOURCE_PATTERN.exec(ledgerContent)?.groups?.path;
  if (mode === undefined || source === undefined || nodePath.isAbsolute(source)) return false;

  const featurePath = nodePath.resolve(projectDirectory, source);
  const relativePath = nodePath.relative(projectDirectory, featurePath);
  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${nodePath.sep}`) ||
    nodePath.extname(featurePath) !== '.feature' ||
    !existsSync(featurePath)
  ) {
    return false;
  }
  try {
    return featureScenarioHasTag(readFileSync(featurePath, 'utf8'), scenario, `@${mode}`);
  } catch {
    return false;
  }
}

// The review stamps both gates read from the shared skill-invocation-log
// (write-review-stamp.ts appends to the same file).
// Verified at the point of reading: the ledger is a plain text file, so a stamp
// claiming a coordinator verdict is held to that claim here rather than trusted
// because it is written down (ticket PB1GMZ).
function recordedReviewStamps(): ReviewStamp[] {
  const logFile = nodePath.join(resolveNamespaceRoot(projectDirectory), 'skill-invocations.log');
  if (!existsSync(logFile)) return [];
  return parseReviewStamps(readFileSync(logFile, 'utf8'));
}

function readReviewStamps(scope: string, requirePinnedReviewerModel = false): ReviewStamp[] {
  return verifiedStamps(
    recordedReviewStamps(),
    projectDirectory,
    scope,
    requirePinnedReviewerModel,
  );
}

/**
 * REFACTOR commit gate: if the active ticket is in `phase: implement` and the
 * current TDD step (parsed from test-definitions.md) is REFACTOR, inspect
 * `git diff --cached --name-only` and deny if any staged file is a test file.
 * Permissive on every other path — missing state, missing ticket, wrong phase,
 * wrong step, or unreachable git all silently allow.
 */
function enforceRefactorCommitGate(sessionId?: string): void {
  const state = readSessionState(projectDirectory, sessionId);
  if (!state?.activeTicket) return;

  const ticket = getTicketInfo(projectDirectory, state.activeTicket);
  if (ticket.phase !== 'implement' || !ticket.folder) return;

  const testDefinitionsPath = nodePath.join(
    resolveNamespaceRoot(projectDirectory),
    'tickets',
    ticket.folder,
    'test-definitions.md',
  );
  if (!existsSync(testDefinitionsPath)) return;

  // parseTddStep returns the LAST CHECKED step. The agent is doing REFACTOR
  // work when RED + GREEN are checked and REFACTOR is still pending — i.e.,
  // when parseTddStep returns 'green'. ('refactor' means scenario complete.)
  const step = parseTddStep(readFileSync(testDefinitionsPath, 'utf8'));
  if (step !== 'green') return;

  let staged: string;
  try {
    staged = execSync('git diff --cached --name-only', {
      cwd: projectDirectory,
      encoding: 'utf8',
    });
  } catch {
    return; // Can't inspect staged files — be permissive rather than wrong.
  }

  const stagedFiles = staged.split('\n').filter(line => line.trim() !== '');
  const offendingTestFile = stagedFiles.find(isTestFile);
  if (offendingTestFile) {
    deny(
      `REFACTOR commit may not touch test file: ${offendingTestFile}. Refactor preserves behavior — changing tests during REFACTOR is a behavior change in disguise.`,
      'If the refactor genuinely needs a test edit (e.g., function rename across imports), commit the test change as part of GREEN, or mark REFACTOR as skip: <reason explaining why test edits were required>.',
    );
  }
}

// Read hook input from stdin
let input: HookInput;
try {
  input = await Bun.stdin.json();
} catch {
  process.exit(0);
}

const tool = input.tool_name ?? '';
const requestedEditedFile = input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? '';
function canonicalPathForGate(path: string, seen = new Set<string>()): string {
  if (seen.has(path)) return path;
  seen.add(path);
  try {
    return realpathSync(path);
  } catch {
    try {
      if (lstatSync(path).isSymbolicLink()) {
        const target = readlinkSync(path);
        return canonicalPathForGate(nodePath.resolve(nodePath.dirname(path), target), seen);
      }
    } catch {
      // The requested path itself may not exist yet.
    }
    const parent = nodePath.dirname(path);
    if (parent === path) return path;
    return nodePath.join(canonicalPathForGate(parent, seen), nodePath.basename(path));
  }
}
const editedFile =
  requestedEditedFile === '' ? requestedEditedFile : canonicalPathForGate(requestedEditedFile);

// ---------------------------------------------------------------------------
// Bash gates:
// 1. Ledger write gate (ticket W42G34, #644 G3): shell commands may not write
//    to an R/G/R ledger — the annotation gate below can only validate Edit
//    payloads, so mutations are forced onto that channel. Detection limits are
//    documented in lib/bash-ledger-writes.ts; the done-gate is the backstop.
// 2. Broad process-kill guard (ticket K4STDR, #773): killall/pkill targeting
//    a bare shared-runtime name kills every project's processes on the
//    machine, not just this one's. Denied with the project-scoped
//    alternatives from zombie-process-cleanup.md.
// 3. Inspiration activation artifacts must be mutated through an edit payload
//    whose proposed content can be reconstructed; shell writes are denied.
// 4. REFACTOR commits must not touch test files (ticket J7VBGJ, Rule 2). The
//    only file-path commit rule that survived scope reduction — see
//    <namespace-root>/learnings/procedural-gates-generalize-beyond-tdd.md for
//    why the RED/GREEN file-path rules were dropped.
// ---------------------------------------------------------------------------

if (tool === 'Bash') {
  const command = input.tool_input?.command ?? '';
  const ledgerWrite = detectLedgerWrite(command);
  if (ledgerWrite) {
    deny(
      `Bash writes to the R/G/R ledger are blocked (${ledgerWrite.shape} targeting ${ledgerWrite.path}). Shell commands bypass the annotation validation that runs on Edit payloads, so ledger checkboxes must be changed through the Edit tool.`,
      `Make the change with the Edit tool on ${ledgerWrite.path} — each [ ] → [x] transition needs a commit SHA or "skip: <reason>", validated at write time. One checkbox per edit.`,
    );
  }
  const inspirationWrite = detectInspirationArtifactWrite(command);
  if (inspirationWrite) {
    deny(
      `Bash writes to inspiration activation artifacts are blocked (${inspirationWrite.shape} targeting ${inspirationWrite.path}). Shell commands bypass the prior/proposed-content validation that prevents activation downgrade.`,
      `Make the change with the Edit or Write tool on ${inspirationWrite.path}, so Safeword can preserve at least one v1 activation signal until durable Git provenance exists.`,
    );
  }
  const processKill = detectBroadProcessKill(command);
  if (processKill) {
    deny(
      `Broad process kill blocked: \`${processKill.command} ${processKill.target}\` matches by name across the whole machine, killing every project's ${processKill.target} processes (dev servers, test runners, other sessions), not just this project's. Use the project-scoped \`"\${CLAUDE_PLUGIN_ROOT}"/resources/scripts/cleanup-zombies.sh\` instead.`,
      `Project-scoped alternatives: \`"\${CLAUDE_PLUGIN_ROOT}"/resources/scripts/cleanup-zombies.sh\` (auto-detects this project's processes; previews by default, --yes to kill), \`lsof -ti:<port> | xargs kill -9\` (port-scoped), or \`pkill -f "<pattern>.*$(pwd)"\` (path-scoped). See "\${CLAUDE_PLUGIN_ROOT}"/resources/guides/zombie-process-cleanup.md.`,
    );
  }
  if (GIT_COMMIT_COMMAND.test(command)) {
    enforceRefactorCommitGate(input.session_id);
  }
  if (
    commandInvokesCloseoutCleanup(command, process.env.CLAUDE_PLUGIN_ROOT, projectDirectory) &&
    (process.env.SAFEWORD_AGENT_RUNTIME === undefined ||
      process.env.SAFEWORD_AGENT_RUNTIME === 'claude')
  ) {
    rememberCloseoutBinding({
      projectDirectory,
      runtime: 'claude',
      id: input.session_id,
      transcriptPath: input.transcript_path,
    });
  }
  process.exit(0);
}

// Only gate edit tools (Bash already handled above)
if (!EDIT_TOOLS.includes(tool)) {
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Artifact prerequisite check: test-definitions.md requires a complete ticket spec
// Runs BEFORE META_PATHS exemption because test-definitions.md lives in .safeword-project/
// This is the one structural gate at the highest-leverage transition point.
// Understanding determines the quality of everything downstream.
// ---------------------------------------------------------------------------

if (
  nodePath.basename(editedFile) === 'test-definitions.md' &&
  isNamespacePath(editedFile, 'tickets/') &&
  !existsSync(editedFile) // Only gate creation, not edits to existing files
) {
  const ticketDirectory = nodePath.dirname(editedFile);
  const ticketFile = nodePath.join(ticketDirectory, 'ticket.md');

  if (!existsSync(ticketFile)) {
    deny(
      'Cannot create test definitions without a ticket spec. Create ticket.md with Scope, Out of Scope, and Done When sections first.',
      withOrderingNote('Complete understanding (propose-and-converge) before writing scenarios.'),
    );
  }

  const ticketContent = readFileSync(ticketFile, 'utf8');
  const frontmatterMatch = ticketContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (!frontmatterMatch) {
    deny(
      'Ticket spec has no YAML frontmatter. Add scope, out_of_scope, and done_when fields.',
      withOrderingNote('Complete understanding (propose-and-converge) before writing scenarios.'),
    );
  }

  const meta = parseFrontmatter(frontmatterMatch![1] ?? '');
  const required = ['scope', 'out_of_scope', 'done_when'] as const;
  const missing = required.filter(field => isMissingFrontmatterField(meta[field]));

  if (missing.length > 0) {
    deny(
      `Ticket frontmatter is missing: ${missing.join(', ')}. Complete understanding before writing scenarios.`,
      withOrderingNote(
        'Add the missing fields to ticket.md frontmatter, then create test-definitions.md.',
      ),
    );
  }

  // Phase gate: must have advanced past intake before writing scenarios.
  if (meta.phase === 'intake') {
    deny(
      'Ticket is still in intake phase. Update phase to define-behavior before writing scenarios.',
      withOrderingNote(
        'Complete understanding, then set phase: define-behavior in ticket frontmatter.',
      ),
    );
  }

  // Dimension artifact gate: features require dimensions.md before test-definitions.md.
  // Natural gate — next step's input doesn't exist if prior step was skipped.
  // The artifact may be a real dimension table OR a single `skip: <non-empty reason>`
  // line (ticket MKVNFB) — the escape valve for tiny features with one obvious dimension.
  if (meta.type === 'feature') {
    const dimensionsFile = nodePath.join(ticketDirectory, 'dimensions.md');
    if (!existsSync(dimensionsFile)) {
      deny(
        'Features require dimensions.md before test-definitions.md. Document behavioral dimensions and partitions first.',
        'Create dimensions.md with a dimension table, or write `skip: <non-empty reason>` as the entire content to deliberately omit.',
      );
    }
    // If the file is a pure `skip: <reason>` declaration, validate the reason.
    // Multi-line content-bearing files don't match this regex and pass through.
    const dimensionsContent = readFileSync(dimensionsFile, 'utf8').trim();
    const skipMatch = /^skip:(.*)$/i.exec(dimensionsContent);
    if (skipMatch && !isValidSkipReason(skipMatch[1] ?? '')) {
      deny(
        'dimensions.md `skip:` declaration requires a non-empty reason after the colon.',
        'Either write a real dimension table, or use `skip: <reason>` where the reason explains why no dimensions need enumerating (e.g., `skip: single behavioral dimension, no partitioning to enumerate`).',
      );
    }
  }

  // spec.md gate (ticket 9EA27P): features fail closed. A `type: feature`
  // ticket with no spec.md is denied here, rather than silently skipping the
  // JTBD/criteria gates below — without a spec.md those gates have nothing to check,
  // so a feature could otherwise reach done with no jobs or criteria. Tasks and
  // patches don't require a spec.md. The CLI scaffolds spec.md for new features,
  // so this only bites pre-product-layer (epic DZ2NM5) tickets, which pay a lazy
  // two-line `## Jobs To Be Done` + `skip: <reason>` the next time they advance.
  const specFile = nodePath.join(ticketDirectory, 'spec.md');
  const specExists = existsSync(specFile);
  if (meta.type === 'feature' && !specExists) {
    deny(
      'Features require a spec.md before test-definitions.md. Without one the JTBD and criteria gates have nothing to check.',
      'Author a Job To Be Done in spec.md under `## Jobs To Be Done` (persona from personas.md, in the "When I…, I want…, so I can…" form), or write `skip: <reason>` there to deliberately omit.',
    );
  }

  // JTBD gate (ticket Y2HCNJ): require ≥1 JTBD whose persona resolves against
  // personas.md, or a `skip: <reason>` in the Jobs To Be Done section. The
  // guard below now only spares tasks and patches — a feature with no spec.md
  // was already denied above.
  if (specExists) {
    const specContent = readFileSync(specFile, 'utf8');
    const ticketId = frontmatterScalar(meta, 'id');
    const isContractedChild =
      frontmatterScalar(meta, 'product_plan_contract') === 'v1' &&
      ['parent', 'parent_job', 'milestone'].every(
        key => frontmatterScalar(meta, key) !== undefined,
      );

    // Contracted children inherit the parent JTBD and own only Contribution +
    // Rules. Applying the standalone JTBD/criteria gates would force copied
    // prose or a fake skip marker into the deliberately delta-only child spec.
    if (isContractedChild) {
      if (ticketId === undefined) {
        deny(
          'spec.md criteria gate: contracted children require one scalar ticket id.',
          'Add a scalar `id` field to ticket.md before defining child-owned lineage Rules.',
        );
      }
      const parentJob = frontmatterScalar(meta, 'parent_job')!;
      const escapePattern = (value: string): string =>
        value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const lineageRule = new RegExp(
        `^####\\s+${escapePattern(parentJob)}\\.${escapePattern(ticketId)}\\.R\\d+\\b`,
        'm',
      );
      if (!lineageRule.test(specContent)) {
        deny(
          'spec.md criteria gate: contracted children require at least one child-owned lineage Rule.',
          `Add a Rule under \`## Rules\` as \`#### ${parentJob}.${ticketId}.R1 — <business invariant>\`.`,
        );
      }
    } else {
      const jtbdVerdict = evaluateJtbdGate(specContent, readPersonasForGate());
      if (!jtbdVerdict.ok) {
        deny(
          `spec.md JTBD gate: ${jtbdVerdict.reason}.`,
          'Author a Job To Be Done in spec.md under `## Jobs To Be Done` (persona from personas.md, in the "When I…, I want…, so I can…" form), or write `skip: <reason>` there to deliberately omit.',
        );
      }

      // Criteria gate (ticket 31W8M3): each JTBD needs ≥1 numbered Rule
      // (`#### <jtbd-id>.R<n>`) or legacy Acceptance Criterion
      // (`#### <jtbd-id>.AC<n>`), or a per-JTBD `skip: <reason>`.
      const criteriaVerdict = evaluateCriteriaGate(specContent);
      if (!criteriaVerdict.ok) {
        deny(
          `spec.md criteria gate: ${criteriaVerdict.reason}.`,
          'Add a numbered Rule under each JTBD as `#### <jtbd-id>.R<n> — <invariant>` (a product-level invariant, not implementation) — or a legacy `#### <jtbd-id>.AC<n> — <capability>` — or `skip: <reason>` under that JTBD to omit it deliberately.',
        );
      }
    }

    // Review gate (NMSD94, Tier 1) — DEFAULT-OFF: only fires when
    // `.safeword/config.json` sets `reviewGate: true`. Scenarios require a review
    // stamp bound to THIS ticket's spec.md at its CURRENT content (so a stale or
    // cross-ticket review doesn't satisfy it). Inert until enabled, so it can't
    // brick a workflow before the stamp-earning step ships.
    if (isReviewGateOn()) {
      const priorScope = reviewScope(
        nodePath.basename(ticketDirectory),
        'spec',
        hashArtifact(specContent),
      );
      const stamps = readReviewStamps(priorScope);
      if (!reviewGateForNextAsset(priorScope, stamps, crossAgentReviewPolicy()).ok) {
        deny(
          'spec.md has not been reviewed at its current content. Review it (or log a skip with a reason) before writing scenarios.',
          'Run `/self-review` (or log a skip), then create test-definitions.md.',
        );
      }
    }
  }
}

function nextContentAfterEdit(
  toolInput: HookInput['tool_input'],
  priorContent: string,
): string | undefined {
  if (toolInput?.content !== undefined) return toolInput.content;
  if (toolInput?.edits) {
    let current = priorContent;
    for (const edit of toolInput.edits) {
      const next = applyUniqueEdit(current, edit.old_string ?? '', edit.new_string ?? '');
      if (next === undefined) return undefined;
      current = next;
    }
    return current;
  }
  if (toolInput?.old_string !== undefined) {
    if (toolInput.replace_all === true && toolInput.old_string !== '') {
      return priorContent.includes(toolInput.old_string)
        ? priorContent.replaceAll(toolInput.old_string, toolInput.new_string ?? '')
        : undefined;
    }
    return applyUniqueEdit(priorContent, toolInput.old_string, toolInput.new_string ?? '');
  }
  return undefined;
}

function requiredNextContent(toolInput: HookInput['tool_input'], priorContent: string): string {
  const proposed = nextContentAfterEdit(toolInput, priorContent);
  if (proposed === undefined) {
    deny(
      'Safeword could not reconstruct this canonical ticket edit safely.',
      'Use one exact, non-empty old_string match, or Write the complete file content.',
    );
  }
  return proposed;
}

function hasReconstructableEdit(toolInput: HookInput['tool_input']): boolean {
  return (
    toolInput?.content !== undefined ||
    toolInput?.edits !== undefined ||
    toolInput?.old_string !== undefined
  );
}

function frontmatterScalar(
  meta: Record<string, string | string[]>,
  key: string,
): string | undefined {
  const value = meta[key];
  return Array.isArray(value) ? undefined : value;
}

function frontmatterFromContent(content: string): Record<string, string | string[]> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? parseFrontmatter(match[1] ?? '') : {};
}

// Shared predicate for the four ticket.md gates below. Exact-basename match
// (#673): a suffix check would let decoys like `sub-ticket.md` take the
// canonical-ticket branches and be judged on their own frontmatter.
const isCanonicalTicketEdit =
  nodePath.basename(editedFile) === 'ticket.md' && isNamespacePath(editedFile, 'tickets/');
const isCanonicalSpecEdit =
  nodePath.basename(editedFile) === 'spec.md' && isNamespacePath(editedFile, 'tickets/');

// Some hosts report a ticket/spec save without exposing either complete content
// or an applicable edit delta. There is no proposed state to validate in that
// case, and these files are otherwise meta paths, so preserve the established
// permissive behavior instead of manufacturing a transition from missing data.
if ((isCanonicalTicketEdit || isCanonicalSpecEdit) && !hasReconstructableEdit(input.tool_input)) {
  process.exit(0);
}

interface CanonicalTicketEditContext {
  priorContent: string;
  proposedContent: string;
  priorMeta: Record<string, string | string[]>;
  proposedMeta: Record<string, string | string[]>;
}

let cachedCanonicalTicketEditContext: CanonicalTicketEditContext | undefined;

function canonicalTicketEditContext(): CanonicalTicketEditContext {
  if (cachedCanonicalTicketEditContext !== undefined) return cachedCanonicalTicketEditContext;
  const priorContent = existsSync(editedFile) ? readFileSync(editedFile, 'utf8') : '';
  const proposedContent = requiredNextContent(input.tool_input, priorContent);
  cachedCanonicalTicketEditContext = {
    priorContent,
    proposedContent,
    priorMeta: frontmatterFromContent(priorContent),
    proposedMeta: frontmatterFromContent(proposedContent),
  };
  return cachedCanonicalTicketEditContext;
}

// A new feature's activation signals may be uncommitted, so Git history cannot
// preserve provenance yet. Keep at least one current signal alive across edits:
// the normal transition gates then require the complete three-signal contract.
// This closes the two-edit downgrade where markers were removed first and the
// phase was advanced in a later tool call.
if (isCanonicalTicketEdit || isCanonicalSpecEdit) {
  const toolInput = input.tool_input;
  if (hasReconstructableEdit(toolInput)) {
    const ticketDirectory = nodePath.dirname(editedFile);
    const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
    const specPath = nodePath.join(ticketDirectory, 'spec.md');
    const currentTicket = existsSync(ticketPath) ? readFileSync(ticketPath, 'utf8') : '';
    const currentSpec = existsSync(specPath) ? readFileSync(specPath, 'utf8') : '';
    const proposed = requiredNextContent(
      toolInput,
      isCanonicalTicketEdit ? currentTicket : currentSpec,
    );
    const priorActivated = hasInspirationActivationCandidate({
      ticketContent: currentTicket,
      specContent: currentSpec,
    });
    const proposedActivated = hasInspirationActivationCandidate({
      ticketContent: isCanonicalTicketEdit ? proposed : currentTicket,
      specContent: isCanonicalSpecEdit ? proposed : currentSpec,
    });
    if (priorActivated && !proposedActivated) {
      deny(
        'The last inspiration-contract activation signal cannot be removed before durable provenance exists.',
        'Restore at least one exact v1 activation signal. The phase-transition gate will require the complete ticket marker, scaffold sentinel, and spec marker before work advances.',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Phase-provenance gate (0KYEBN, #644 G2) — ALWAYS-ON. A feature ticket's
// phase is earned, not declared: born at intake, one canonical step at a time,
// deviations only via per-phase phase_skips justifications. Ordered BEFORE the
// #404 readiness gate so "wrong step" is reported before "step not earned".
// ---------------------------------------------------------------------------

// Implementation Planning decision gate (G1C9PP, #4200). Run before phase
// provenance so a request to enter the newly introduced phase reports the
// actual open decision instead of the transitional "unknown phase" fallback.
if (isCanonicalTicketEdit) {
  const { priorPhase, proposedPhase, proposedType } = phaseTransitionContext();
  if (
    proposedType === 'feature' &&
    priorPhase === 'plan-implementation' &&
    proposedPhase === 'plan-execution'
  ) {
    const ticketDirectory = nodePath.dirname(editedFile);
    const verdict = evaluateExecutionPlanningEntry(ticketDirectory, { projectDirectory });
    if (!verdict.ok) deny(verdict.reason, verdict.remediation);

    if (isReviewGateOn()) {
      const planPath = nodePath.join(ticketDirectory, 'impl-plan.md');
      const planContent = existsSync(planPath) ? readFileSync(planPath, 'utf8') : '';
      const ticketScope = nodePath.basename(ticketDirectory);
      const planScope = reviewScope(ticketScope, 'impl-plan', hashArtifact(planContent));
      const reviewVerdict = reviewGateForNextAsset(
        planScope,
        readReviewStamps(planScope),
        crossAgentReviewPolicy(),
      );
      if (!reviewVerdict.ok) {
        const planScopePrefix = `${ticketScope}:impl-plan@`;
        const hasSupersededReview = recordedReviewStamps().some(
          stamp => stamp.scope.startsWith(planScopePrefix) && stamp.scope !== planScope,
        );
        deny(
          hasSupersededReview
            ? 'The Implementation Plan changed after its recorded review, so that review is superseded and requires plan revalidation before it can authorize Execution Planning.'
            : 'The current Implementation Plan has not passed its required review, so Execution Planning cannot begin.',
          hasSupersededReview
            ? 'Run Implementation Plan revalidation against the current impl-plan.md, record the new content-bound review stamp, then retry the transition.'
            : 'Run the Implementation Plan review against the current impl-plan.md, record its content-bound review stamp, then retry the transition.',
        );
      }
    }
  }
}

if (isCanonicalTicketEdit) {
  // Only run phase provenance when the proposed content is reconstructable.
  // Later lineage gates deliberately fail closed for canonical ticket edits
  // whose payload cannot be reconstructed.
  const toolInput = input.tool_input;
  if (hasReconstructableEdit(toolInput)) {
    const context = canonicalTicketEditContext();
    const verdict = evaluateTicketWrite(
      existsSync(editedFile) ? context.priorContent : undefined,
      context.proposedContent,
    );
    if (!verdict.ok) {
      deny(verdict.reason, withOrderingNote(verdict.remediation));
    }
  }
}

/** Prior/proposed phase + proposed type for a canonical ticket.md edit. */
function phaseTransitionContext(): {
  priorPhase: string | undefined;
  proposedPhase: string | undefined;
  proposedType: string | undefined;
  priorHadParentReferences: boolean;
  proposedHasParentReferences: boolean;
  proposedHasCompleteParentReferences: boolean;
  priorParentContractActivated: boolean;
  priorContent: string;
  proposedContent: string;
} {
  const context = canonicalTicketEditContext();
  return {
    priorPhase: frontmatterScalar(context.priorMeta, 'phase'),
    proposedPhase: frontmatterScalar(context.proposedMeta, 'phase'),
    proposedType: frontmatterScalar(context.proposedMeta, 'type'),
    priorHadParentReferences: ['parent', 'parent_job', 'milestone'].some(
      key => frontmatterScalar(context.priorMeta, key) !== undefined,
    ),
    proposedHasParentReferences: ['parent', 'parent_job', 'milestone'].some(
      key => frontmatterScalar(context.proposedMeta, key) !== undefined,
    ),
    proposedHasCompleteParentReferences: ['parent', 'parent_job', 'milestone'].every(
      key => frontmatterScalar(context.proposedMeta, key) !== undefined,
    ),
    priorParentContractActivated:
      frontmatterScalar(context.priorMeta, 'product_plan_contract') === 'v1' ||
      frontmatterScalar(context.priorMeta, 'parent_job') !== undefined ||
      frontmatterScalar(context.priorMeta, 'parent_contract_digest') !== undefined,
    priorContent: context.priorContent,
    proposedContent: context.proposedContent,
  };
}

// A child may not shed its lineage in one edit and advance in a later edit.
// Parent resolution remains a phase-boundary cost; activation loss is checked
// on every existing canonical ticket edit because it is cheap and state-local.
if (isCanonicalTicketEdit) {
  const {
    priorPhase,
    proposedPhase,
    priorHadParentReferences,
    proposedHasParentReferences,
    proposedHasCompleteParentReferences,
    priorParentContractActivated,
    priorContent,
    proposedContent,
  } = phaseTransitionContext();
  if (
    existsSync(editedFile) &&
    priorParentContractActivated &&
    priorHadParentReferences &&
    !proposedHasCompleteParentReferences
  ) {
    if (proposedHasParentReferences) {
      deny(
        'Parent Product Plan reconciliation required: parent, parent_job, and milestone must be declared together.',
        'Restore the complete child lineage before making any other ticket change.',
      );
    }
    deny(
      'Parent Product Plan reconciliation required: parent references cannot be removed from a contracted child.',
      'Preserve the child references; converting a child to standalone work requires an explicit preservation-first migration.',
    );
  }
  if (existsSync(editedFile) && proposedPhase !== priorPhase) {
    const verdict = evaluateParentContract(projectDirectory, proposedContent, priorContent);
    if (!verdict.ok) {
      deny(
        `Parent Product Plan reconciliation required: ${verdict.reason}.`,
        'Review the parent changes, then run `safeword ticket reconcile-parent <ticket-id>` in intake or add `--accept` after intake.',
      );
    }
  }
}

// Feature readiness gate (#404): block new entries into define-behavior before
// scenario work starts. The existing test-definitions.md gate still guards the
// first scenario-file write; this catches the earlier phase edit.
if (isCanonicalTicketEdit) {
  const { priorPhase, proposedPhase, proposedType, proposedContent } = phaseTransitionContext();

  if (
    proposedType === 'feature' &&
    proposedPhase === 'define-behavior' &&
    priorPhase !== proposedPhase
  ) {
    const ticketFolder = nodePath.basename(nodePath.dirname(editedFile));
    const readiness = evaluateFeatureTicketReadiness(projectDirectory, ticketFolder, {
      ticketContent: proposedContent,
    });
    if (!readiness.ok) {
      deny(
        formatFeatureTicketReadiness(readiness),
        'Complete the listed intake artifacts, then retry the phase change into define-behavior.',
      );
    }
  }
}

// Implement-entry plan gate (TXRHMD, #480) — ALWAYS-ON. A new-flow feature
// enters implement only with a valid impl-plan.md (status planned), authored
// during the plan-implementation phase. Ordered after provenance/readiness so
// "wrong step" is reported before "plan not ready".
if (isCanonicalTicketEdit) {
  const { priorPhase, proposedPhase, proposedType } = phaseTransitionContext();

  if (proposedType === 'feature' && proposedPhase === 'implement' && priorPhase !== proposedPhase) {
    const verdict = evaluateImplementEntry(nodePath.dirname(editedFile), { projectDirectory });
    if (!verdict.ok) {
      deny(verdict.reason, verdict.remediation);
    }
  }
}

// Review gate (NMSD94, Tier 2). On a ticket.md edit that changes `phase:`, block
// leaving the phase until an independent phase-exit review stamp exists for it.
// The stamp is produced from the shared coordinator's validated result and logged
// via `write-review-stamp.ts --phase`. Enforced unless `reviewGate` excludes this
// exit: absent or `true` covers every phase, a list covers only what it names.
if (isCanonicalTicketEdit) {
  const context = canonicalTicketEditContext();
  const exitedPhase = detectPhaseAdvance(context.priorContent, context.proposedContent);
  // Phase first, then the flag: selective enforcement needs to know WHICH exit this
  // is before it can decide whether the gate applies to it.
  if (exitedPhase !== undefined && reviewGateAppliesTo(exitedPhase)) {
    const ticketDirectory = nodePath.dirname(editedFile);
    const phaseScope = reviewScope(nodePath.basename(ticketDirectory), 'phase', exitedPhase);
    const stamps = readReviewStamps(phaseScope);
    if (!gatePhaseAdvance(phaseScope, stamps, crossAgentReviewPolicy()).ok) {
      deny(
        `Phase "${exitedPhase}" has no independent review stamp — advancing is blocked until a fork review of the phase is logged.`,
        `Run \`safeword review run ${reviewKindForPhase(exitedPhase)} <ticket.md and the work this phase produced>\`, then record its author_agent, actual_reviewer, independence, review id, and reviewer_model with \`bun "\${CLAUDE_PLUGIN_ROOT}"/runtime/hooks/write-review-stamp.ts --phase ${exitedPhase}\`. To stop gating this exit, narrow \`reviewGate\` in .safeword/config.json to the phases you want (or set it to false).`,
      );
    }
    // Ceiling-raiser (7A0B2K): under cross-model, a real-review stamp must record a
    // model different from the author. Evaluate over ALL real-review stamps at this
    // scope (the log is append-only, so a corrected re-review can follow a same-model
    // attempt) — pass if any is cross-model. A logged skip records no real-review
    // stamp, so it deliberately bypasses this, matching the arch-gate's escape valve.
    else if (
      isCrossModelOn() &&
      !stamps.some(
        stamp =>
          stamp.scope === phaseScope &&
          stamp.skipReason !== undefined &&
          isValidSkipReason(stamp.skipReason),
      )
    ) {
      const modelVerifiedStamps = readReviewStamps(phaseScope, true);
      const realReviews = modelVerifiedStamps.filter(stamp =>
        isSatisfyingCoordinatorReviewStamp(phaseScope, stamp, crossAgentReviewPolicy()),
      );
      const hasCrossModelReview = realReviews.some(
        s => !modelsMatch(s.model, process.env[AUTHOR_MODEL_ENV]),
      );
      if (!hasCrossModelReview) {
        deny(
          `Phase "${exitedPhase}" review (cross-model): the phase review must be performed by a different model than the author.`,
          `Re-run the phase's \`safeword review run\` command with a different configured reviewer model, then record the returned provenance and reviewer_model via \`bun "\${CLAUDE_PLUGIN_ROOT}"/runtime/hooks/write-review-stamp.ts --phase ${exitedPhase}\`.`,
        );
      }
    }
  }
}
// ---------------------------------------------------------------------------
// blocked_on hard gate (ticket MBGQ89) — ALWAYS-ON. On a ticket.md edit that
// advances phase out of intake, deny while any same-repo blocked_on target is
// not done (override with a substantive reason). Joins the phase-gate family.
// ---------------------------------------------------------------------------

if (isCanonicalTicketEdit) {
  const context = canonicalTicketEditContext();
  const denial = evaluateBlockedOnGate(context.priorContent, context.proposedContent, id => {
    const info = getTicketInfo(projectDirectory, id);
    return { found: info.folder !== undefined, status: info.status };
  });
  if (denial !== undefined) {
    deny(denial.reason, denial.additionalContext);
  }
}

// ---------------------------------------------------------------------------
// SHA-or-skip annotation gate (ticket J7VBGJ, Rule 1)
// On Edit/Write/MultiEdit of test-definitions.md, any [ ] → [x] transition
// must carry either a SHA (`- [x] RED abc1234`) or `skip: <non-empty reason>`.
// Pre-existing [x] without annotation is silently allowed (forward-looking).
// ---------------------------------------------------------------------------

if (
  nodePath.basename(editedFile) === 'test-definitions.md' &&
  isNamespacePath(editedFile, 'tickets/')
) {
  if (input.tool_name === 'NotebookEdit') {
    deny(
      'Cannot update the markdown R/G/R ledger through NotebookEdit.',
      'Use Edit, Write, or MultiEdit so Safeword can reconstruct and validate the exact checkbox transition.',
    );
  }
  const transitions = collectNewTransitions(input, editedFile);
  const priorLedgerContent = existsSync(editedFile) ? readFileSync(editedFile, 'utf8') : '';
  const proposedLedgerContent = nextContentAfterEdit(input.tool_input, priorLedgerContent);
  const relabeledEvidence = transitions.find(transition => transition.evidenceModeChanged === true);
  if (relabeledEvidence !== undefined) {
    deny(
      'Cannot retroactively relabel an already-checked RED as manual or live evidence.',
      'Leave the historical RED annotation unchanged. Reopen the scenario with a new unchecked RED row and record the manual/live evidence there.',
    );
  }
  const independentlyGatedGreens = transitions.filter(
    transition =>
      transition.step === 'GREEN' &&
      transition.evidenceMode === undefined &&
      transition.historicalEvidenceRemoved !== true,
  );
  if (independentlyGatedGreens.length > 1) {
    deny(
      'Cannot mark more than one independently reviewed GREEN row in one tool call.',
      'Split the edit so each GREEN transition receives one bounded executable-RED receipt check. This prevents a multi-replacement edit from outliving the host hook timeout.',
    );
  }
  for (const transition of transitions) {
    if (transition.historicalEvidenceRemoved === true) {
      deny(
        `Cannot move, rewrite, uncheck, or remove a ${transition.step} row that already carries historical evidence.`,
        `Keep the checked ${transition.step} row and its scenario binding intact. If you are renaming a scenario while checking another row, split those changes into separate edits.`,
      );
    }
    if (transition.annotation === '') {
      deny(
        `Cannot mark "[x] ${transition.step}" without an annotation. Use "${transition.step} <sha>" or "${transition.step} skip: <non-empty reason>".`,
        'Every checkbox transition needs a commit SHA (proof of the work) or a deliberate skip with reason (auditable omission).',
      );
    }
    const kind = classifyAnnotation(transition.annotation);
    if (kind.kind === 'skip' && !isValidSkipReason(kind.reason)) {
      deny(
        `Cannot mark "[x] ${transition.step}" with empty skip reason. Use "skip: <non-empty reason>".`,
        'The text after "skip:" must not be empty or whitespace-only. A real reason is the audit trail.',
      );
    }
    if (kind.kind === 'sha' && !isValidSha(kind.value)) {
      deny(
        `Cannot mark "[x] ${transition.step}" with malformed SHA: ${JSON.stringify(kind.value)}.`,
        `Use "${transition.step} <7-40 hexadecimal commit SHA>" or "${transition.step} skip: <non-empty reason>".`,
      );
    }
    if (transition.step === 'GREEN') {
      const scenario = transition.scenario;
      if (scenario === undefined) {
        deny(
          'Cannot mark GREEN because Safeword could not identify the active scenario for executable RED review.',
          'Leave GREEN unchecked. If a heading was renamed or duplicated, revert that edit; then restore one standard level-2 through level-6 Scenario heading with RED/GREEN/REFACTOR rows and retry.',
        );
        continue;
      }
      // Manual/live is the intentional escape path for behavior that cannot be
      // executable. Both the durable ledger reference and the matching feature
      // tag must be present in the proposed state before GREEN can bypass the
      // executable review route.
      if (
        transition.evidenceMode !== undefined &&
        proposedLedgerContent !== undefined &&
        usesSeparateEvidencePath(proposedLedgerContent, scenario)
      ) {
        continue;
      }
      const ledger = nodePath.relative(canonicalProjectDirectory, editedFile);
      const gateDenial = executableRedGateDenial(scenario, ledger);
      if (gateDenial !== undefined) {
        deny(
          `Cannot mark GREEN without either prior manual/live evidence or a fresh independent executable RED approval. ${gateDenial}`,
          `Run the exact \`safeword review run executable-red --scenario ${JSON.stringify(scenario)} --ledger ${JSON.stringify(ledger)} ...\` request for the current proof, wait for independent approval, then retry this GREEN edit.`,
        );
      }
    }
  }
}

// Never block edits to tooling/meta files — these are not application code.
// (After artifact prerequisite check, which targets files in .safeword-project/)
// Project-relative match, NOT a substring of the absolute path — see isMetaPath.
if (isMetaPath(editedFile, canonicalProjectDirectory)) {
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Shared state read — used by both implement phase gate and LOC gate below.
// ---------------------------------------------------------------------------

const state = readSessionState(projectDirectory, input.session_id);

if (!state) {
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Implement phase gate: features need test-definitions.md before app code (#128)
// Tasks are exempt (per #126 retro — sizing boundary makes tasks lighter).
// Reads ticket state directly from disk (per #124 — no cached phase).
// ---------------------------------------------------------------------------

if (state.activeTicket) {
  const ticketInfo = getTicketInfo(projectDirectory, state.activeTicket);

  // Planning code freeze (TXRHMD, #480): while a feature plans, application
  // code stays untouched — the plan is the phase's only deliverable. Meta
  // paths (ticket artifacts, impl-plan.md) already exited above. A significant
  // decision may also need to land in the configured durable architecture
  // record before plan review, so that exact project-owned target is allowed.
  if (ticketInfo.type === 'feature' && ticketInfo.phase === 'plan-implementation') {
    if (isConfiguredArchitectureRecordEdit(editedFile, projectDirectory)) {
      process.exit(0);
    }
    recordFailure(projectDirectory, input.session_id, 'plan-implementation-code-freeze');
    deny(
      'Feature at plan-implementation phase: application code stays untouched while planning. Finish impl-plan.md, advance the ticket to implement, then write code.',
      'Author impl-plan.md next to ticket.md (scaffold from "\${CLAUDE_PLUGIN_ROOT}"/resources/templates/impl-plan-template.md), then set phase: implement to unlock code edits.',
    );
  }

  if (ticketInfo.type === 'feature' && ticketInfo.phase === 'implement' && ticketInfo.folder) {
    const testDefinitionsPath = nodePath.join(
      resolveNamespaceRoot(projectDirectory),
      'tickets',
      ticketInfo.folder,
      'test-definitions.md',
    );

    if (!existsSync(testDefinitionsPath)) {
      recordFailure(projectDirectory, input.session_id, 'implement-without-test-definitions');
      deny(
        'Feature at implement phase requires test-definitions.md before writing application code. Create test-definitions.md with scenarios first.',
        'Write scenarios (RED/GREEN/REFACTOR checkboxes) before implementation. Tasks are exempt from this gate.',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// LOC gate: blast radius control — commit every ~400 LOC
// ---------------------------------------------------------------------------

// Check if commit happened → gate clears
const currentHead = (() => {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: projectDirectory,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
})();

if (state.lastCommitHash !== currentHead) {
  process.exit(0);
}

if (!state.gate) {
  process.exit(0);
}

// LOC gate stands down during a git merge/rebase/cherry-pick/revert so it can't
// block the edits that resolve the operation (ticket MT27QG).
if (
  state.gate === 'loc' &&
  state.locSinceCommit >= LOC_THRESHOLD &&
  !isGitOperationInProgress(projectDirectory)
) {
  recordFailure(projectDirectory, input.session_id, 'loc-exceeded');
  deny(`${state.locSinceCommit} LOC since last commit (threshold: ${LOC_THRESHOLD}).

Commit your progress before continuing.`);
}

// Remaining gates (tdd:*, phase:*) are reminders via prompt hook, not hard blocks.
// Exception: implement-without-test-definitions gate above (#128). See #109 / #114.
process.exit(0);
