/**
 * Acceptance steps for the plan-implementation phase (TXRHMD, #480).
 *
 * A gated BDD phase between scenario-gate and implement: the transition gate
 * keeps TDD RED from starting before a valid impl-plan.md, a code freeze keeps
 * application code untouched mid-planning, and every phase-keyed surface
 * (resume tables, prompt reminders, stop/boundary gates, splitting guidance,
 * schema manifest) carries a plan-implementation entry. Following this lane's
 * subprocess-based design, the steps shell out to the real hooks (template
 * copies — the source of truth; parity-check keeps the dogfood mirrors
 * identical) and the real CLI, or read the shipped documents — never importing
 * project value modules. Mirrors the unit coverage in
 * packages/cli/tests/hooks/plan-implementation-document.test.ts,
 * tests/integration/plan-transition-gate.test.ts, and the stop-hook scenarios
 * in tests/integration/hooks.test.ts.
 */

import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { missingPhases } from './support/provenance-denial.js';
import { REVIEWER_CAPABILITIES } from '../packages/cli/tests/review-fixtures.ts';
import {
  COMPLETE_DATA_PLAN,
  ownershipPlan,
  reviewDataApplicability,
  reviewDataOwnershipConsistency,
  withoutDataFields,
} from '../packages/cli/tests/fixtures/plan-data-applicability.ts';
import {
  extractPackagedPlanReviewRubric,
  type PlanReviewFixture,
  reviewFocusedDecisionPath,
} from '../packages/cli/tests/fixtures/plan-focused-reviewability.ts';
import {
  type PersonaConsequenceFixture,
  type PersonaInventoryFixture,
  reviewPersonaConsequences,
  reviewPersonaInventory,
} from '../packages/cli/tests/fixtures/plan-persona-consequences.ts';
import {
  type PlanStateFixture,
  reviewPlanState,
} from '../packages/cli/tests/fixtures/plan-state-truthfulness.ts';
import {
  decisionDepthFixture,
  type DecisionDepthFixture,
  reviewDecisionDepth,
} from '../packages/cli/tests/fixtures/plan-decision-depth.ts';
import {
  type MeasurementApplicabilityFixture,
  type MeasurementDesignFixture,
  reviewMeasurementApplicability,
  reviewMeasurementDesign,
} from '../packages/cli/tests/fixtures/plan-measurement-design.ts';
import type { ReviewerOutput } from '../packages/cli/src/review/contract.ts';
import { reviewPlanOfRecord } from '../packages/cli/tests/fixtures/plan-single-record.ts';
import { git } from './support/repo-fixtures.ts';
import type { SafewordWorld } from './world.js';

const PROJECT_ROOT = nodePath.resolve(import.meta.dirname, '..');
const PRE_TOOL_HOOK = nodePath.join(
  PROJECT_ROOT,
  'packages/cli/templates/hooks/pre-tool-quality.ts',
);
const REVIEW_STAMP_HOOK = nodePath.join(
  PROJECT_ROOT,
  'packages/cli/templates/hooks/write-review-stamp.ts',
);
const STOP_HOOK = nodePath.join(PROJECT_ROOT, 'packages/cli/templates/hooks/stop-quality.ts');
const PROMPT_HOOK = nodePath.join(PROJECT_ROOT, 'packages/cli/templates/hooks/prompt-questions.ts');
const CLI = nodePath.join(PROJECT_ROOT, 'packages/cli/src/cli.ts');
const PACKAGED_CLI = nodePath.join(PROJECT_ROOT, 'packages/cli/dist/cli.js');
const CODEX_PLUGIN_ROOT = nodePath.join(PROJECT_ROOT, 'packages/cli/codex-plugin');
const PLAN_CONTRACT_REVIEW_HELPER = nodePath.join(
  PROJECT_ROOT,
  'packages/cli/tests/fixtures/plan-contract-review.ts',
);

/** Both shipped copies of every bdd skill document (template + dogfood). */
const BDD_SKILL_ROOTS = [
  nodePath.join(PROJECT_ROOT, 'packages/cli/templates/skills/bdd'),
  nodePath.join(PROJECT_ROOT, '.claude/skills/bdd'),
];

/** Shipped Codex plugin reference for the BDD planning phase. */
const CODEX_BDD_PLAN_REFERENCE = nodePath.join(
  PROJECT_ROOT,
  'packages/cli/codex-plugin/skills/bdd/references/PLAN_IMPLEMENTATION.md',
);

/** Both shipped copies of the impl-plan scaffold template. */
const IMPL_PLAN_TEMPLATE_COPIES = [
  nodePath.join(PROJECT_ROOT, 'packages/cli/templates/doc-templates/impl-plan-template.md'),
  nodePath.join(PROJECT_ROOT, '.safeword/templates/impl-plan-template.md'),
];

/** Shipped roots the "authored at scenario-gate exit" sweep covers. */
const GREP_ROOTS = [
  'packages/cli/templates',
  '.claude/skills',
  '.safeword/hooks',
  '.safeword/templates',
  'packages/cli/src',
];

const TICKET_ID = 'PLAN01';
const TICKET_FOLDER = `${TICKET_ID}-fixture`;
const SESSION_ID = 'plan-phase-lane';
const SUBPROCESS = { timeout: 60_000 };

interface DocCopy {
  path: string;
  text: string;
}

interface HookVerdict {
  decision: 'allow' | 'deny';
  /** Denial text the agent and user see (reason + context + system message). */
  text: string;
}

interface RepairReviewResult {
  state: string;
  findings: Array<{ message: string; severity: string }>;
  data?: { review_id?: string; status?: string };
}

interface PlanWorld extends SafewordWorld {
  projectDirectory?: string;
  ticketDirectory?: string;
  ticketPhase?: string;
  verdict?: HookVerdict;
  docs?: DocCopy[];
  planDocs?: DocCopy[];
  tddDocs?: DocCopy[];
  templateDocs?: DocCopy[];
  grepHits?: string[];
  websiteReference?: string;
  phaseList?: string[];
  schemaSource?: string;
  cursorWrapperSource?: string;
  architectureRecord?: string;
  architectureEditTarget?: string;
  stop?: { decision?: string; reason: string; exitCode: number };
  promptOutput?: string;
  cli?: { exitCode: number; output: string };
  installedCliPath?: string;
  controlInstalledCliPath?: string;
  reviewerBinDirectory?: string;
  reviewerLaunchLog?: string;
  planContractState?: string;
  planContractReview?: {
    verdict: string;
    findings: Array<{ message: string; severity: string }>;
    authorObligations: string[];
    reviewerObligations: string[];
  };
  focusedPlan?: PlanReviewFixture;
  focusedPlanReview?: ReviewerOutput;
  focusedExpectedFinding?: string;
  dataPlan?: string;
  dataPlanReview?: ReviewerOutput;
  dataOwnershipPlan?: string;
  dataOwnershipReview?: ReviewerOutput;
  planOfRecord?: string;
  planOfRecordSupporting?: Set<string>;
  planOfRecordReview?: ReviewerOutput;
  scopeExpansionInput?: {
    ticketId: string;
    sessionId: string;
    proposedScopeDigest: string;
    authorityEvidence?: unknown;
    untrustedClaims?: string[];
  };
  scopeExpansionDecision?: {
    accepted: boolean;
    reason: string;
  };
  personaConsequence?: PersonaConsequenceFixture;
  personaConsequenceReview?: ReviewerOutput;
  personaInventory?: PersonaInventoryFixture[];
  personaInventoryReview?: ReviewerOutput;
  planState?: PlanStateFixture;
  planStateReview?: ReviewerOutput;
  decisionDepth?: DecisionDepthFixture;
  decisionDepthReview?: ReviewerOutput;
  measurementDesign?: MeasurementDesignFixture;
  measurementDesignReview?: ReviewerOutput;
  measurementApplicability?: MeasurementApplicabilityFixture;
  measurementApplicabilityReview?: ReviewerOutput;
  repairReviews?: {
    first: RepairReviewResult;
    firstAfterCorrection?: RepairReviewResult;
    current?: RepairReviewResult;
  };
}

const EVIDENCE_REFERENCE = 'https://spec.commonmark.org/0.31.2/';
const EVIDENCE_DATE = '2026-09-10';
const EVIDENCE_PRESENTATIONS = [
  'the decision, alternative, losing reason, evidence reference, retrieval date, and applicable version in the packaged table',
  'the same complete information in concise prose and bullets',
  'prose that omits the evidence reference',
  'prose that omits the applicable version',
  'prose that omits the retrieval date',
] as const;

function evidencePresentationPlan(presentation: string): string {
  assert.ok(
    EVIDENCE_PRESENTATIONS.includes(presentation as (typeof EVIDENCE_PRESENTATIONS)[number]),
    `unknown evidence presentation: ${presentation}`,
  );
  const table = [
    '### Implementation Inspiration',
    '',
    '| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    `| ${EVIDENCE_REFERENCE} | ${EVIDENCE_DATE} | 0.31.2 | 0.31.2 | Exact grammar | Keep exact records | Strict subset only |`,
    '',
    '**Decision impact:** retained: exact records fit the design',
    '**Decision informed:** parser boundary',
    '',
    '### Recorded Decisions',
    '',
    '| Decision | Choice | Alternatives considered | Rejected because |',
    '| --- | --- | --- | --- |',
    `| parser boundary | ${EVIDENCE_REFERENCE} | full Markdown | the strict subset is easier to audit |`,
  ].join('\n');
  const prose = [
    '### Recorded Decisions',
    '',
    '- **Decision:** parser boundary',
    '- **Choice:** keep an exact record grammar',
    '- **Alternative considered:** full Markdown',
    '- **Rejected because:** the strict subset is easier to audit',
    `- **Evidence reference:** ${EVIDENCE_REFERENCE}`,
    `- **Retrieval date:** ${EVIDENCE_DATE}`,
    '- **Applicable version:** 0.31.2',
  ];
  const decisions =
    presentation ===
    'the decision, alternative, losing reason, evidence reference, retrieval date, and applicable version in the packaged table'
      ? table
      : prose
          .filter(line => {
            if (presentation === 'prose that omits the evidence reference') {
              return !line.includes('Evidence reference:');
            }
            if (presentation === 'prose that omits the applicable version') {
              return !line.includes('Applicable version:');
            }
            if (presentation === 'prose that omits the retrieval date') {
              return !line.includes('Retrieval date:');
            }
            return true;
          })
          .join('\n');
  return [
    '# Impl Plan: Evidence presentation',
    '',
    '**Status:** planned',
    `**Planned on:** ${EVIDENCE_DATE}`,
    '',
    '## Approach',
    '',
    'Riskiest assumption: the installed gate reads either supported presentation.',
    '',
    '## Decisions',
    '',
    decisions,
    '',
    '## Design alignment',
    '',
    'Architecture applicability: skip: no shared contract consequence',
    '',
    '## Known deviations',
    '',
    'skip: no deviations planned',
    '',
    '## Doc impact',
    '',
    'skip: fixture-only behavior',
    '',
    '## Assessment triggers',
    '',
    'Revisit when evidence grammar changes.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * A shape-valid impl-plan (mirrors plan-transition-gate.test.ts VALID_PLAN).
 * The authored heading remains "Arch alignment"; the workflow calls the broader
 * design concern "Design alignment" when it describes the five required sections.
 */
const VALID_PLAN = [
  '# Impl Plan: gate the implement entry',
  '',
  '**Status:** planned',
  '',
  '## Approach',
  '',
  'Riskiest assumption: the gate fires → scenario 1.',
  '',
  '## Decisions',
  '',
  '### Recorded Decisions',
  '',
  '| Decision | Choice | Alternatives considered | Rejected because |',
  '| - | - | - | - |',
  '| gate | pre-tool | stop-only | too late |',
  '',
  '## Arch alignment',
  '',
  'skip: no ADRs in this project yet',
  '',
  '## Known deviations',
  '',
  'skip: no deviations planned',
  '',
  '## Assessment triggers',
  '',
  'Revisit when a second gate consumer appears.',
  '',
].join('\n');

const FOCUSED_ARCHITECTURE = `# Implementation Plan

## Architecture at a glance

Gateway requests pass through one authorization boundary before resource access.
`;

const FOCUSED_DECISIONS = `
## Decision-bearing contracts

Failure posture: deny resource access when current authorization cannot be established.
Consequence: authorization outages deny resource access instead of risking exposure.

## Operational risks

Stale authorization could expose a resource after tool access is revoked.

## Unresolved authority

Product must decide whether denied reads are visible in the activity log.
`;

function ticketContent(options: { phase: string; type?: string; skips?: string[] }): string {
  const lines = [
    '---',
    `id: ${TICKET_ID}`,
    `type: ${options.type ?? 'feature'}`,
    `phase: ${options.phase}`,
    'status: in_progress',
    'last_modified: 2026-01-06T10:00:00Z',
    'scope:',
    '  - exercise the planning gates',
    'out_of_scope:',
    '  - unrelated',
    'done_when:',
    '  - gated',
  ];
  if (options.skips !== undefined) {
    lines.push('phase_skips:');
    for (const entry of options.skips) lines.push(`  - ${entry}`);
  }
  lines.push('---', '', '# Fixture', '');
  return lines.join('\n');
}

function createProject(world: PlanWorld): string {
  const project = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-plan-phase-'));
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  // Isolate from the phase-exit review gate (on by default since KHL52X): these
  // scenarios prove the PLAN gate's verdicts, and a missing-stamp denial would
  // mask them. Terminal reply formatting is a separate contract; the stop
  // fixture deliberately carries only the planning state under test.
  writeFileSync(
    nodePath.join(project, '.safeword', 'config.json'),
    `${JSON.stringify({ reviewGate: false, terminalHandoffCorrection: false }, undefined, 2)}\n`,
  );
  world.projectDirectory = project;
  world.ticketDirectory = nodePath.join(project, '.project', 'tickets', TICKET_FOLDER);
  mkdirSync(world.ticketDirectory, { recursive: true });
  return project;
}

function seedTicket(
  world: PlanWorld,
  options: { phase: string; type?: string; skips?: string[]; spec?: boolean },
): void {
  if (world.projectDirectory === undefined) createProject(world);
  const directory = world.ticketDirectory!;
  writeFileSync(nodePath.join(directory, 'ticket.md'), ticketContent(options));
  if (options.spec === true) writeFileSync(nodePath.join(directory, 'spec.md'), '# Spec\n');
  world.ticketPhase = options.phase;
}

function ticketArtifact(world: PlanWorld, name: string): string {
  return nodePath.join(world.ticketDirectory!, name);
}

/** Bind the fixture ticket as the session's active ticket (pre-tool state read). */
function bindActiveTicket(world: PlanWorld, sessionId: string): void {
  writeFileSync(
    nodePath.join(world.projectDirectory!, '.project', `quality-state-${sessionId}.json`),
    JSON.stringify({ activeTicket: TICKET_ID }),
  );
}

// ---------------------------------------------------------------------------
// Hook invocation
// ---------------------------------------------------------------------------

function runPreTool(
  world: PlanWorld,
  toolName: string,
  toolInput: object,
  sessionId?: string,
): HookVerdict {
  const stdout = execFileSync('bun', [PRE_TOOL_HOOK], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, CLAUDE_PROJECT_DIR: world.projectDirectory },
    input: JSON.stringify({ session_id: sessionId, tool_name: toolName, tool_input: toolInput }),
    encoding: 'utf8',
  });

  const trimmed = stdout.trim();
  if (trimmed === '') return { decision: 'allow', text: '' };
  const parsed = JSON.parse(trimmed) as {
    systemMessage?: string;
    hookSpecificOutput?: {
      permissionDecision?: string;
      permissionDecisionReason?: string;
      additionalContext?: string;
    };
  };
  if (parsed.hookSpecificOutput?.permissionDecision !== 'deny') {
    return { decision: 'allow', text: '' };
  }
  return {
    decision: 'deny',
    text: [
      parsed.hookSpecificOutput.permissionDecisionReason ?? '',
      parsed.hookSpecificOutput.additionalContext ?? '',
      parsed.systemMessage ?? '',
    ].join('\n'),
  };
}

function installProjectHooks(world: PlanWorld): void {
  const install = spawnSync(
    process.execPath,
    [PACKAGED_CLI, 'install', '--agents=none', '--no-input', '--offline', '--no-modify'],
    {
      cwd: world.projectDirectory,
      encoding: 'utf8',
    },
  );
  assert.equal(
    install.status,
    0,
    `Safeword project enrollment failed:\n${install.stdout ?? ''}\n${install.stderr ?? ''}`,
  );
  world.installedCliPath = nodePath.join(CODEX_PLUGIN_ROOT, 'runtime', 'cli.js');
  const configPath = nodePath.join(world.projectDirectory!, '.safeword', 'config.json');
  const installedConfig = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
  writeFileSync(
    configPath,
    `${JSON.stringify(
      { ...installedConfig, reviewGate: false, designApprovalGate: false },
      undefined,
      2,
    )}\n`,
  );
}

function arrangeRepairReviewer(world: PlanWorld, plan: string): void {
  createProject(world);
  installProjectHooks(world);
  seedTicket(world, { phase: 'plan-implementation', spec: true });
  writeFileSync(ticketArtifact(world, 'impl-plan.md'), plan);

  world.reviewerBinDirectory = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'plan-repair-'));
  chmodSync(world.reviewerBinDirectory, 0o700);
  const reviewer = nodePath.join(world.reviewerBinDirectory, 'claude');
  writeFileSync(
    reviewer,
    `#!/bin/sh
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  echo '${REVIEWER_CAPABILITIES.claude}'
  exit 0
fi
payload=$(/bin/cat)
dispatch_id=$(printf '%s' "$payload" | /usr/bin/sed -n 's/.*"dispatch_id":"\\([^"]*\\)".*/\\1/p')
if printf '%s' "$payload" | /usr/bin/grep -q 'REPAIR_COMPLETE'; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"Current exact bytes are complete.","findings":[]}\\n' "$dispatch_id"
elif printf '%s' "$payload" | /usr/bin/grep -q 'REPAIR_EXTERNAL'; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"request_changes","summary":"Plan is waiting on its behavior owner.","findings":[{"severity":"error","message":"Pending user decision: choose deny-by-default or cached access. Deny-by-default prevents exposure but reduces availability; cached access preserves availability but can serve stale authority. Resume: ask the user to choose one outcome, record it, then re-run plan review."}]}\\n' "$dispatch_id"
elif printf '%s' "$payload" | /usr/bin/grep -q 'REPAIR_AUTH_MISSING'; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"request_changes","summary":"Authorization remains unresolved.","findings":[{"severity":"error","message":"Authorization boundary is still missing; return to repair and decide where every request is checked."}]}\\n' "$dispatch_id"
else
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"request_changes","summary":"Three current design defects block approval.","findings":[{"severity":"error","message":"Authorization boundary is missing."},{"severity":"error","message":"Persisted resource owner conflicts with its policy-service source of truth."},{"severity":"error","message":"Rollback behavior is undecided."}]}\\n' "$dispatch_id"
fi
`,
  );
  chmodSync(reviewer, 0o755);
}

function runRepairReview(world: PlanWorld): RepairReviewResult {
  assert.ok(world.installedCliPath, 'the packaged Safeword CLI was not installed');
  assert.ok(world.reviewerBinDirectory, 'the deterministic reviewer was not arranged');
  const keyRoot = nodePath.join(world.projectDirectory!, 'review-integrity');
  const result = spawnSync(
    'bun',
    [
      world.installedCliPath,
      'review',
      'run',
      'plan-implementation',
      '--json',
      '--',
      nodePath.relative(world.projectDirectory!, ticketArtifact(world, 'impl-plan.md')),
    ],
    {
      cwd: world.projectDirectory,
      encoding: 'utf8',
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: world.projectDirectory,
        NODE_ENV: 'test',
        PATH: `${world.reviewerBinDirectory}:${process.env.PATH ?? ''}`,
        SAFEWORD_AGENT_RUNTIME: 'codex',
        SAFEWORD_REVIEW_KEY_ROOT: keyRoot,
      },
    },
  );
  assert.ok(result.status === 0 || result.status === 2, `${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout) as RepairReviewResult;
}

function reviewStatus(world: PlanWorld, reviewId: string): RepairReviewResult {
  const result = spawnSync(
    'bun',
    [world.installedCliPath!, 'review', 'status', reviewId, '--json'],
    {
      cwd: world.projectDirectory,
      encoding: 'utf8',
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: world.projectDirectory,
        NODE_ENV: 'test',
        SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(world.projectDirectory!, 'review-integrity'),
      },
    },
  );
  assert.ok(result.status === 0 || result.status === 2, `${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout) as RepairReviewResult;
}

function arrangeArchitectureReceipt(world: PlanWorld): void {
  createProject(world);
  installProjectHooks(world);
  seedTicket(world, { phase: 'plan-implementation', spec: true });
  writeFileSync(ticketArtifact(world, 'impl-plan.md'), VALID_PLAN);
  world.reviewerBinDirectory = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'plan-receipt-'));
  chmodSync(world.reviewerBinDirectory, 0o700);
  const reviewer = nodePath.join(world.reviewerBinDirectory, 'claude');
  writeFileSync(
    reviewer,
    `#!/bin/sh\nif printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then\n  echo '${REVIEWER_CAPABILITIES.claude}'\n  exit 0\nfi\npayload=$(/bin/cat)\ndispatch_id=$(printf '%s' "$payload" | /usr/bin/sed -n 's/.*"dispatch_id":"\\([^"]*\\)".*/\\1/p')\nprintf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"request_changes","summary":"The architecture decision needs attention.","findings":[{"severity":"error","message":"The shared-contract choice needs a resolvable durable architecture record; impl-plan.md has no configured architecture link."}]}\\n' "$dispatch_id"\n`,
  );
  chmodSync(reviewer, 0o755);
}

function assertInstalledPlanGateIsLive(world: PlanWorld): void {
  assert.ok(world.installedCliPath, 'the packaged Safeword CLI must be installed in the fixture');
  const result = spawnSync(
    'bun',
    [world.installedCliPath, 'hook', 'codex', 'pre-tool-use', '--plugin-hook'],
    {
      cwd: world.projectDirectory,
      env: { ...process.env, CLAUDE_PROJECT_DIR: world.projectDirectory },
      input: JSON.stringify({
        hook_event_name: 'PreToolUse',
        session_id: SESSION_ID,
        tool_name: 'Edit',
        tool_input: {
          file_path: ticketArtifact(world, 'ticket.md'),
          old_string: 'phase: plan-implementation',
          new_string: 'phase: plan-execution',
        },
      }),
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /impl-plan\.md/, 'installed CLI must enforce a known plan denial');
}

function stampCurrentPlanReview(world: PlanWorld): void {
  const pluginRoot = nodePath.join(world.projectDirectory!, '.review-plugin');
  mkdirSync(nodePath.join(pluginRoot, 'runtime'), { recursive: true });
  writeFileSync(
    nodePath.join(pluginRoot, 'runtime', 'cli.js'),
    [
      'const id = process.argv[4];',
      `process.stdout.write(JSON.stringify({ data: { review_id: id, status: 'approved', review_kind: 'plan-implementation', review_targets: ['.project/tickets/${TICKET_FOLDER}/impl-plan.md'], independence: 'cross-agent', author_agent: 'codex', actual_reviewer: 'claude' } }));`,
    ].join('\n'),
  );
  const result = spawnSync(
    'bun',
    [
      REVIEW_STAMP_HOOK,
      '--ticket',
      TICKET_FOLDER,
      '--author-agent',
      'codex',
      '--reviewer-agent',
      'claude',
      '--independence',
      'cross-agent',
      '--review-id',
      'b3f1c2d4-0000-4000-8000-000000000420',
      'impl-plan',
    ],
    {
      cwd: world.projectDirectory,
      encoding: 'utf8',
      env: {
        ...process.env,
        CLAUDE_PLUGIN_ROOT: pluginRoot,
        CLAUDE_PROJECT_DIR: world.projectDirectory,
        CLAUDE_SESSION_ID: SESSION_ID,
      },
    },
  );
  assert.equal(
    result.status,
    0,
    `review stamp failed:\n${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  );
}

function requestExecutionPlanning(world: PlanWorld): void {
  const ticket = ticketArtifact(world, 'ticket.md');
  assert.ok(world.installedCliPath, 'the packaged Safeword CLI must be installed in the fixture');
  const stdout = execFileSync(
    'bun',
    [world.installedCliPath, 'hook', 'codex', 'pre-tool-use', '--plugin-hook'],
    {
      cwd: world.projectDirectory,
      env: { ...process.env, CLAUDE_PROJECT_DIR: world.projectDirectory },
      input: JSON.stringify({
        hook_event_name: 'PreToolUse',
        session_id: SESSION_ID,
        tool_name: 'Edit',
        tool_input: {
          file_path: ticket,
          old_string: 'phase: plan-implementation',
          new_string: 'phase: plan-execution',
        },
      }),
      encoding: 'utf8',
    },
  );
  const trimmed = stdout.trim();
  if (trimmed === '') {
    world.verdict = { decision: 'allow', text: '' };
    writeFileSync(
      ticket,
      readFileSync(ticket, 'utf8').replace('phase: plan-implementation', 'phase: plan-execution'),
    );
    world.ticketPhase = 'plan-execution';
    return;
  }
  const parsed = JSON.parse(trimmed) as {
    systemMessage?: string;
    hookSpecificOutput?: {
      permissionDecision?: string;
      permissionDecisionReason?: string;
      additionalContext?: string;
    };
  };
  world.verdict = {
    decision: parsed.hookSpecificOutput?.permissionDecision === 'deny' ? 'deny' : 'allow',
    text: [
      parsed.hookSpecificOutput?.permissionDecisionReason ?? '',
      parsed.hookSpecificOutput?.additionalContext ?? '',
      parsed.systemMessage ?? '',
    ].join('\n'),
  };
}

function advancePhase(world: PlanWorld, targetPhase: string): void {
  const prior = world.ticketPhase;
  assert.ok(prior, 'fixture must record its starting phase');
  world.verdict = runPreTool(world, 'Edit', {
    file_path: ticketArtifact(world, 'ticket.md'),
    old_string: `phase: ${prior}`,
    new_string: `phase: ${targetPhase}`,
  });
}

/** Run the stop hook the way the runtime does (edit in transcript, hook JSON on stdin). */
function runStopHook(world: PlanWorld): { decision?: string; reason: string; exitCode: number } {
  const project = world.projectDirectory!;
  const transcriptPath = nodePath.join(project, 'transcript.jsonl');
  writeFileSync(
    transcriptPath,
    JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', name: 'Edit' },
          { type: 'text', text: 'Made changes.' },
        ],
      },
    }),
  );
  const result = spawnSync('bun', [STOP_HOOK], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, CLAUDE_PROJECT_DIR: project },
    input: JSON.stringify({
      session_id: SESSION_ID,
      transcript_path: transcriptPath,
      stop_hook_active: false,
      last_assistant_message: 'Made changes.',
    }),
    encoding: 'utf8',
  });
  const exitCode = result.status ?? 0;
  try {
    const parsed = JSON.parse((result.stdout ?? '').trim()) as {
      decision?: string;
      reason?: string;
    };
    return { decision: parsed.decision, reason: parsed.reason ?? '', exitCode };
  } catch {
    return { reason: '', exitCode };
  }
}

// ---------------------------------------------------------------------------
// Document reading
// ---------------------------------------------------------------------------

function readCopies(file: string): DocCopy[] {
  return BDD_SKILL_ROOTS.map(directory => {
    const path = nodePath.join(directory, file);
    return { path, text: readFileSync(path, 'utf8') };
  });
}

/** Assert a check against every read copy, failing with the copy's path. */
function eachDoc(docs: DocCopy[] | undefined, check: (text: string, path: string) => void): void {
  assert.ok(docs !== undefined && docs.length > 0, 'no shipped documents were read');
  for (const { path, text } of docs) check(text, path);
}

function matchDocs(docs: DocCopy[] | undefined, ...patterns: RegExp[]): void {
  eachDoc(docs, (text, path) => {
    for (const pattern of patterns) {
      assert.match(text, pattern, `${path} must match ${pattern}`);
    }
  });
}

After(function (this: PlanWorld) {
  if (this.projectDirectory !== undefined) {
    rmSync(this.projectDirectory, { recursive: true, force: true });
  }
  if (this.reviewerBinDirectory !== undefined) {
    rmSync(this.reviewerBinDirectory, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Givens — ticket fixtures in a throwaway project
// ---------------------------------------------------------------------------

Given('a new-flow feature ticket at the plan-implementation phase', function (this: PlanWorld) {
  seedTicket(this, { phase: 'plan-implementation', spec: true });
});

Given(
  'real project configuration, a ticket with an unresolved behavior-shaping choice, and human design approval is not required',
  function (this: PlanWorld) {
    createProject(this);
    installProjectHooks(this);
    seedTicket(this, { phase: 'plan-implementation', spec: true });
    assertInstalledPlanGateIsLive(this);
    writeFileSync(
      ticketArtifact(this, 'impl-plan.md'),
      VALID_PLAN.replace(
        '| gate | pre-tool | stop-only | too late |',
        '| Authentication ownership | unresolved | per-service ownership | decision pending |',
      ),
    );
  },
);

Given(
  'real project configuration, a ticket with all behavior-shaping choices resolved in a reviewed current plan, and human design approval is not required',
  function (this: PlanWorld) {
    createProject(this);
    installProjectHooks(this);
    seedTicket(this, { phase: 'plan-implementation', spec: true });
    assertInstalledPlanGateIsLive(this);
    writeFileSync(ticketArtifact(this, 'impl-plan.md'), VALID_PLAN);
    stampCurrentPlanReview(this);
  },
);

Given('its impl-plan.md is valid with status planned', function (this: PlanWorld) {
  writeFileSync(ticketArtifact(this, 'impl-plan.md'), VALID_PLAN);
});

Given('no impl-plan.md exists in the ticket folder', function (this: PlanWorld) {
  assert.equal(existsSync(ticketArtifact(this, 'impl-plan.md')), false);
});

Given(
  /^the Implementation Plan author and semantic reviewer receive (.+)$/,
  function (this: PlanWorld, contractState: string) {
    this.planContractState = contractState;
  },
);

Given(
  'real project configuration and no packaged decision-quality contract is reachable',
  function (this: PlanWorld) {
    createProject(this);
    seedTicket(this, { phase: 'plan-implementation', spec: true });
    writeFileSync(ticketArtifact(this, 'impl-plan.md'), VALID_PLAN);
    const controlPluginRoot = nodePath.join(this.projectDirectory!, 'control-codex-plugin');
    const missingPluginRoot = nodePath.join(this.projectDirectory!, 'missing-codex-plugin');
    cpSync(CODEX_PLUGIN_ROOT, controlPluginRoot, { recursive: true });
    cpSync(CODEX_PLUGIN_ROOT, missingPluginRoot, { recursive: true });
    const missingContractPath = nodePath.join(
      missingPluginRoot,
      'skills/bdd/references/PLAN_IMPLEMENTATION.md',
    );
    const withContract = readFileSync(missingContractPath, 'utf8');
    const withoutContract = withContract.replace(
      /<!-- SAFEWORD:PLAN_RUBRIC_START -->[\s\S]*?<!-- SAFEWORD:PLAN_RUBRIC_END -->/u,
      '',
    );
    assert.notEqual(withoutContract, withContract, 'the packaged contract fixture was not removed');
    writeFileSync(missingContractPath, withoutContract);
    this.controlInstalledCliPath = nodePath.join(controlPluginRoot, 'runtime/cli.js');
    this.installedCliPath = nodePath.join(missingPluginRoot, 'runtime/cli.js');

    this.reviewerBinDirectory = mkdtempSync(
      nodePath.join(nodeOs.tmpdir(), 'plan-contract-cucumber-'),
    );
    chmodSync(this.reviewerBinDirectory, 0o700);
    this.reviewerLaunchLog = nodePath.join(this.projectDirectory!, 'reviewer-launch.log');
    const reviewer = nodePath.join(this.reviewerBinDirectory, 'claude');
    writeFileSync(
      reviewer,
      `#!/bin/sh\nif printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then\n  echo '${REVIEWER_CAPABILITIES.claude}'\n  exit 0\nfi\nprintf 'invoked\\n' >> "$SAFEWORD_REVIEW_LAUNCH_LOG"\npayload=$(/bin/cat)\ndispatch_id=$(printf '%s' "$payload" | /usr/bin/sed -n 's/.*"dispatch_id":"\\([^"]*\\)".*/\\1/p')\nprintf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"The plan is otherwise reviewable.","findings":[]}\\n' "$dispatch_id"\n`,
    );
    chmodSync(reviewer, 0o755);
  },
);

Given('its impl-plan.md is missing a required section', function (this: PlanWorld) {
  writeFileSync(
    ticketArtifact(this, 'impl-plan.md'),
    VALID_PLAN.replace('## Decisions', '## Notes'),
  );
});

Given(
  'its impl-plan.md is valid but its status line reads implemented',
  function (this: PlanWorld) {
    writeFileSync(
      ticketArtifact(this, 'impl-plan.md'),
      VALID_PLAN.replace('**Status:** planned', '**Status:** implemented'),
    );
  },
);

Given(
  'a feature ticket with no spec.md at the plan-implementation phase',
  function (this: PlanWorld) {
    seedTicket(this, { phase: 'plan-implementation' });
  },
);

Given('a task ticket at the scenario-gate phase with no impl-plan.md', function (this: PlanWorld) {
  seedTicket(this, { phase: 'scenario-gate', type: 'task' });
  assert.equal(existsSync(ticketArtifact(this, 'impl-plan.md')), false);
});

Given('a feature ticket at the scenario-gate phase', function (this: PlanWorld) {
  seedTicket(this, { phase: 'scenario-gate' });
});

Given(
  'the ticket carries no phase_skips justification for plan-implementation',
  function (this: PlanWorld) {
    const content = readFileSync(ticketArtifact(this, 'ticket.md'), 'utf8');
    assert.doesNotMatch(content, /phase_skips/);
  },
);

Given(
  'the ticket carries a phase_skips justification for plan-implementation',
  function (this: PlanWorld) {
    seedTicket(this, {
      phase: 'scenario-gate',
      skips: ['plan-implementation: plan captured in the PR description'],
    });
  },
);

Given('a feature ticket at the intake phase', function (this: PlanWorld) {
  seedTicket(this, { phase: 'intake' });
});

Given('a feature ticket at the plan-implementation phase', function (this: PlanWorld) {
  // spec.md marks the new flow — the mid-planning stop must stay legal even
  // when the impl-plan stop gate could apply (hooks.test.ts scenario 11b).
  seedTicket(this, { phase: 'plan-implementation', spec: true });
});

Given(
  'real project configuration, an Implementation Plan with a missing authorization boundary, an incorrect data owner, and no rollback decision, and deterministic reviewer process results that return those findings then approve the corrected exact bytes',
  function (this: PlanWorld) {
    arrangeRepairReviewer(this, `${VALID_PLAN}\n\nREPAIR_INITIAL\n`);
  },
);

Given(
  'a plan defect requires the user who owns scope and behavior to choose between two behaviorally different outcomes and no authorized decision is available',
  function (this: PlanWorld) {
    arrangeRepairReviewer(this, `${VALID_PLAN}\n\nREPAIR_EXTERNAL\n`);
  },
);

Given(
  /^a plan has completed one repair round and its current exact bytes (resolve every blocking defect|still omit one required authorization decision)$/u,
  function (this: PlanWorld, correctionState: string) {
    const marker =
      correctionState === 'resolve every blocking defect'
        ? 'REPAIR_COMPLETE'
        : 'REPAIR_AUTH_MISSING';
    arrangeRepairReviewer(this, `${VALID_PLAN}\n\n${marker}\n`);
  },
);

Given('no test-definitions.md exists in the ticket folder', function (this: PlanWorld) {
  assert.equal(existsSync(ticketArtifact(this, 'test-definitions.md')), false);
});

Given('its test-definitions.md exists with scenario checkboxes', function (this: PlanWorld) {
  writeFileSync(
    ticketArtifact(this, 'test-definitions.md'),
    '# Test Definitions\n\n## Rule: Test rule\n\n- [ ] Scenario one\n',
  );
});

Given(
  'a session whose active feature ticket sits at the plan-implementation phase',
  function (this: PlanWorld) {
    seedTicket(this, { phase: 'plan-implementation' });
    // The prompt hook binds via the per-session state file; a stdin payload
    // with no session_id reads the `undefined` storage key.
    bindActiveTicket(this, 'undefined');
  },
);

Given(
  'a feature ticket whose impl-plan.md has the original five sections and no Doc impact section',
  function (this: PlanWorld) {
    seedTicket(this, { phase: 'plan-implementation', spec: true });
    writeFileSync(ticketArtifact(this, 'impl-plan.md'), VALID_PLAN);
    assert.doesNotMatch(VALID_PLAN, /Doc impact/);
  },
);

Given(
  'a feature ticket whose impl-plan.md includes a Doc impact section with no content and no skip line',
  function (this: PlanWorld) {
    seedTicket(this, { phase: 'plan-implementation', spec: true });
    writeFileSync(ticketArtifact(this, 'impl-plan.md'), `${VALID_PLAN}\n## Doc impact\n`);
  },
);

Given(/^an Implementation Plan with (.+)$/u, function (this: PlanWorld, presentation: string) {
  const buried = (lead: string) => `${FOCUSED_ARCHITECTURE}\n${lead}${FOCUSED_DECISIONS}`;
  switch (presentation) {
    case 'a decision summary buried beneath step-by-step coding instructions and repeated test evidence':
      this.focusedPlan = {
        plan: buried(
          '## Approach\n\n1. Create the authorization service.\n2. Run the gateway integration test.\n\nEvidence: gateway test passed.\nEvidence: gateway test passed again.',
        ),
      };
      this.focusedExpectedFinding = 'step-by-step coding instructions';
      break;
    case 'a decision summary buried beneath a repeated test-by-test evidence ledger with no execution instructions':
      this.focusedPlan = {
        plan: buried(
          '## Evidence ledger\n\nEvidence: gateway request test passed.\nEvidence: authorization failure test passed.',
        ),
      };
      this.focusedExpectedFinding = 'repeated test evidence';
      break;
    case 'an architecture-at-a-glance mental model followed by decision-bearing contracts, operational risks, and unresolved authority with supporting detail linked':
      this.focusedPlan = {
        plan: `${FOCUSED_ARCHITECTURE}${FOCUSED_DECISIONS}\nSupporting detail: linked-design.md\n`,
        linkedDetail: '# Supporting design\n\nThe denial response uses the unavailable status.\n',
      };
      break;
    case 'decision-bearing contracts, operational risks, and unresolved authority in the main review path but no architecture-at-a-glance mental model':
      this.focusedPlan = { plan: `# Implementation Plan\n${FOCUSED_DECISIONS}` };
      break;
    case 'a short summary that opens with the architecture-at-a-glance mental model, names a load-bearing failure-posture decision and its consequence, and links only fuller subordinate detail':
      this.focusedPlan = {
        plan: `${FOCUSED_ARCHITECTURE}\n## Decision-bearing contracts\n\nFailure-posture decision: fail closed when authorization is unavailable.\nConsequence: authorization outages deny resource access instead of risking exposure.\n\nSupporting detail: linked-design.md\n`,
        linkedDetail:
          '# Supporting design\n\nFailure posture: deny resource access when current authorization cannot be established.\n',
      };
      break;
    default:
      assert.fail(`unknown focused-review presentation: ${presentation}`);
  }
});

Given(
  /^an Implementation Plan has (a concise decision summary with named decisions and subordinate linked detail|a decision summary buried beneath step-by-step execution detail)$/u,
  function (this: PlanWorld, presentation: string) {
    switch (presentation) {
      case 'a concise decision summary with named decisions and subordinate linked detail':
        this.focusedPlan = {
          plan: `${FOCUSED_ARCHITECTURE}\n## Decision-bearing contracts\n\nFailure-posture decision: fail closed when authorization is unavailable.\nConsequence: authorization outages deny resource access instead of risking exposure.\n\nSupporting detail: linked-design.md\n`,
          linkedDetail:
            '# Supporting design\n\nFailure posture: deny resource access when current authorization cannot be established.\n',
        };
        break;
      case 'a decision summary buried beneath step-by-step execution detail':
        this.focusedPlan = {
          plan: `${FOCUSED_ARCHITECTURE}\n## Approach\n\n1. Create the authorization service.\n2. Wire the gateway.\n${FOCUSED_DECISIONS}`,
        };
        break;
      default:
        assert.fail(`unknown receipt presentation: ${presentation}`);
    }
  },
);

Given(
  'a short Implementation Plan summary with a load-bearing failure-posture decision recorded nowhere in the plan or its linked detail',
  function (this: PlanWorld) {
    this.focusedPlan = {
      plan: `${FOCUSED_ARCHITECTURE}\n## Decision-bearing contracts\n\nAuthorization is checked per request.\n\nSupporting detail: linked-design.md\n`,
      linkedDetail: '# Supporting design\n\nThe gateway uses the shared authorization service.\n',
    };
  },
);

Given(/^a feature's Implementation Plan has (.+)$/u, function (this: PlanWorld, dataState: string) {
  switch (dataState) {
    case 'one persisted entity change that omits data ownership and migration decisions':
      this.dataPlan = withoutDataFields('Ownership and access', 'Migration and backfill');
      break;
    case 'one persisted entity change that omits its purpose, store and model, and schema relationships':
      this.dataPlan = withoutDataFields('Purpose', 'Store and model', 'Schema and relationships');
      break;
    case 'one persisted entity change that omits retention and rollback consequences':
      this.dataPlan = withoutDataFields('Lifecycle and retention', 'Rollback');
      break;
    case 'one persisted entity change that omits identity and integrity decisions':
      this.dataPlan = withoutDataFields('Identity and integrity');
      break;
    case 'purpose, store and model, schema and relationships, source of truth, ownership and access, identity and integrity, cross-system flow, lifecycle and retention, migration and backfill, compliance, and rollback decisions recorded without migration commands':
      this.dataPlan = COMPLETE_DATA_PLAN;
      break;
    case 'a persisted cross-system flow with no source of truth or access decision':
      this.dataPlan = withoutDataFields('Source of truth', 'Ownership and access');
      break;
    case 'a regulated backfill with no compliance consequence':
      this.dataPlan = withoutDataFields('Compliance');
      break;
    case 'no data-contract, ownership, or lifecycle impact':
      this.dataPlan =
        '# Implementation Plan\n\nData applicability: skip: no data-contract, ownership, or lifecycle impact\n';
      break;
    default:
      assert.fail(`unknown data-applicability state: ${dataState}`);
  }
});

Given(
  'an Implementation Plan names a persisted entity owner that contradicts its source-of-truth authority',
  function (this: PlanWorld) {
    this.dataOwnershipPlan = ownershipPlan('the identity service', 'the profile service');
  },
);

Given(
  'an Implementation Plan names a persisted entity owner that agrees with its source-of-truth authority',
  function (this: PlanWorld) {
    this.dataOwnershipPlan = ownershipPlan('the identity service', 'the identity service');
  },
);

Given(
  /^an Implementation Plan records (the decision, alternative, losing reason, evidence reference, retrieval date, and applicable version in the packaged table|the same complete information in concise prose and bullets|prose that omits the evidence reference|prose that omits the applicable version|prose that omits the retrieval date)$/u,
  SUBPROCESS,
  function (this: PlanWorld, evidencePresentation: string) {
    createProject(this);
    installProjectHooks(this);
    writeFileSync(
      ticketArtifact(this, 'ticket.md'),
      [
        '---',
        `id: ${TICKET_ID}`,
        'type: feature',
        'phase: plan-implementation',
        'status: in_progress',
        `created: ${EVIDENCE_DATE}T00:00:00.000Z`,
        'inspiration_contract: v1',
        'inspiration_contract_scaffold: v1',
        'scope:',
        '  - verify decision evidence presentation',
        'out_of_scope:',
        '  - unrelated behavior',
        'done_when:',
        '  - the installed gate reports evidence omissions',
        '---',
        '',
        '# Evidence presentation fixture',
      ].join('\n'),
    );
    writeFileSync(
      ticketArtifact(this, 'spec.md'),
      '<!-- safeword:inspiration-contract:v1 -->\n# Spec: Evidence presentation\n',
    );
    assertInstalledPlanGateIsLive(this);
    writeFileSync(
      ticketArtifact(this, 'impl-plan.md'),
      evidencePresentationPlan(evidencePresentation),
    );
    this.ticketPhase = 'plan-implementation';
  },
);

Given(
  /^discovery has surfaced an out-of-scope capability with (.+)$/u,
  function (this: PlanWorld, scopeDecision: string) {
    const ticketId = 'PLAN01';
    const sessionId = 'scope-authority-session';
    const proposedScopeDigest = 'sha256:proposed-scope';
    const base = { ticketId, sessionId, proposedScopeDigest };

    switch (scopeDecision) {
      case 'no user-supplied scope-change approval':
        this.scopeExpansionInput = base;
        break;
      case 'typed scope-change authority bound to this ticket, session, and proposed scope':
        this.scopeExpansionInput = {
          ...base,
          authorityEvidence: {
            kind: 'user-scope-change',
            ticketId,
            sessionId,
            proposedScopeDigest,
          },
        };
        break;
      case 'only an agent-authored assertion with no externally supplied user authority':
        this.scopeExpansionInput = {
          ...base,
          untrustedClaims: ['The user approved adding this capability to scope.'],
        };
        break;
      default:
        assert.fail(`unknown scope decision: ${scopeDecision}`);
    }
  },
);

Given(
  /^the accepted Product Plan includes a persona who must (.+) and the Implementation Plan (.+)$/u,
  function (this: PlanWorld, personaNeed: string, coverageState: string) {
    const needs: Record<string, PersonaConsequenceFixture['need']> = {
      'trust the authorization and audit boundary': 'trust',
      'operate the feature through its supported interface': 'operation',
      'approve rollout from truthful assurance': 'approval',
      'recover safely after a refused operation': 'recovery',
    };
    const need = needs[personaNeed];
    assert.ok(need, `unknown persona need: ${personaNeed}`);
    assert.ok(
      coverageState === 'records that design consequence and its limit' ||
        coverageState === 'omits that consequence',
      `unknown persona coverage state: ${coverageState}`,
    );
    this.personaConsequence = {
      persona: 'accepted feature persona',
      need,
      consequenceRecorded: coverageState === 'records that design consequence and its limit',
      limitRecorded: coverageState === 'records that design consequence and its limit',
    };
  },
);

Given(
  "the accepted Product Plan includes a Technical Builder with an authorization-trust need and a Non-Technical Builder with a safe-recovery need, while the Implementation Plan covers only the Technical Builder's consequence",
  function (this: PlanWorld) {
    this.personaInventory = [
      {
        persona: 'Technical Builder',
        need: 'authorization-trust',
        designConsequence: 'authorization-trust',
        covered: true,
      },
      {
        persona: 'Non-Technical Builder',
        need: 'safe-recovery',
        designConsequence: 'safe-recovery',
        covered: false,
      },
    ];
  },
);

Given(
  'a failed review addressed to a Non-Technical Builder because a shared-contract choice has no durable architecture link',
  function (this: PlanWorld) {
    arrangeArchitectureReceipt(this);
  },
);

Given(
  'a failed review addressed to a Technical Builder because a shared-contract choice has no durable architecture link',
  function (this: PlanWorld) {
    arrangeArchitectureReceipt(this);
  },
);

Given(
  /^an Implementation Plan is written after some implementation exists with (.+) and claims (.+)$/u,
  function (this: PlanWorld, actualState: string, planClaim: string) {
    const base: PlanStateFixture = {
      implementationExists: false,
      currentBoundaryProof: false,
      humanReleaseApproval: false,
      humanDesignApproval: false,
      independentReviewPassed: false,
      knownDefectContradictsDecision: false,
      plannedBehaviorImplemented: false,
      claim: planClaim,
    };
    let actual: Partial<PlanStateFixture>;
    switch (actualState) {
      case 'code exists without current-boundary proof':
        actual = { implementationExists: true };
        break;
      case 'current-boundary proof exists but human approval is pending':
        actual = { implementationExists: true, currentBoundaryProof: true };
        break;
      case 'independent semantic review passed but configured human design approval was never requested':
        actual = { independentReviewPassed: true };
        break;
      case 'an implementation defect contradicts the proposed decision':
        actual = { implementationExists: true, knownDefectContradictsDecision: true };
        break;
      case 'existing implementation covers another accepted behavior while this planned behavior is absent':
        actual = { implementationExists: true, plannedBehaviorImplemented: false };
        break;
      default:
        assert.fail(`unknown actual plan state: ${actualState}`);
    }
    this.planState = { ...base, ...actual };
  },
);

Given(
  /^an architecturally significant workflow changes (.+) and the Implementation Plan records (.+)$/u,
  function (this: PlanWorld, concern: string, decisionDetail: string) {
    this.decisionDepth = decisionDepthFixture(concern, decisionDetail);
  },
);

Given(
  /^the Product Plan promises a measurable outcome for a named population and condition and the Implementation Plan (.+)$/u,
  function (this: PlanWorld, measurementState: string) {
    const complete = {
      quantitativePromise: true,
      changesTarget: false,
      changesPopulation: false,
      originDecided: true,
      methodDecided: true,
      safeguardsDecided: true,
      failureBehaviorDecided: true,
      instrumentationCommands: false,
    } satisfies MeasurementDesignFixture;
    switch (measurementState) {
      case 'decides the origin, method, validity safeguards, and failure behavior':
        this.measurementDesign = complete;
        break;
      case 'changes the promised target':
        this.measurementDesign = { ...complete, changesTarget: true };
        break;
      case 'changes the affected population':
        this.measurementDesign = { ...complete, changesPopulation: true };
        break;
      case 'decides origin, method, validity safeguards, and failure behavior but also lists exact instrumentation commands':
        this.measurementDesign = { ...complete, instrumentationCommands: true };
        break;
      case 'leaves validity safeguards unresolved without listing instrumentation commands':
        this.measurementDesign = { ...complete, safeguardsDecided: false };
        break;
      default:
        assert.fail(`unknown measurement state: ${measurementState}`);
    }
  },
);

Given(
  /^the Product Plan makes no quantitative promise and the Implementation Plan (.+)$/u,
  function (this: PlanWorld, applicabilityState: string) {
    const states: Record<string, MeasurementApplicabilityFixture['state']> = {
      'records no measurement-design applicability decision': 'missing',
      'records a bare applicability skip with no reason': 'bare-skip',
      'records a justified measurement-design applicability skip': 'justified-skip',
    };
    const state = states[applicabilityState];
    assert.ok(state, `unknown measurement applicability state: ${applicabilityState}`);
    this.measurementApplicability = { state };
  },
);

Given(
  /^real project configuration resolves its durable architecture location as (.+)$/u,
  function (this: PlanWorld, architectureLocation: string) {
    createProject(this);
    const architecture =
      architectureLocation === 'one project-owned architecture file'
        ? 'docs/decisions.md'
        : 'docs/adr';
    assert.ok(
      architectureLocation === 'one project-owned architecture file' ||
        architectureLocation === 'a project-owned ADR directory',
      `unknown architecture location: ${architectureLocation}`,
    );
    const configPath = nodePath.join(this.projectDirectory!, '.safeword', 'config.json');
    writeFileSync(
      configPath,
      `${JSON.stringify({ reviewGate: false, paths: { architecture } }, undefined, 2)}\n`,
    );
    if (architecture.endsWith('.md')) {
      mkdirSync(nodePath.dirname(nodePath.join(this.projectDirectory!, architecture)), {
        recursive: true,
      });
      writeFileSync(nodePath.join(this.projectDirectory!, architecture), '# Decisions\n');
    } else {
      mkdirSync(nodePath.join(this.projectDirectory!, architecture), { recursive: true });
    }
    seedTicket(this, { phase: 'plan-implementation', spec: true });
    bindActiveTicket(this, SESSION_ID);
  },
);

Given(
  /^a feature needs component and data design detail with (.+)$/u,
  function (this: PlanWorld, artifactState: string) {
    const linked = 'docs/feature-detail.md';
    this.planOfRecordSupporting = new Set<string>();
    switch (artifactState) {
      case 'all decisions contained in the Implementation Plan':
        this.planOfRecord = 'Required decision location: impl-plan.md\n';
        break;
      case 'all required decisions named with their consequence in the Implementation Plan and fuller detail linked as explicitly subordinate support':
        this.planOfRecord = `Required decision location: linked supporting detail
Decision and consequence: The identity service owns account links.
Supporting detail: ${linked}
Supporting authority: subordinate
`;
        this.planOfRecordSupporting.add(linked);
        break;
      case 'a linked document that claims independent feature-plan authority':
        this.planOfRecord = `Required decision location: linked supporting detail
Decision and consequence: The identity service owns account links.
Supporting detail: ${linked}
Supporting authority: independent feature plan
`;
        this.planOfRecordSupporting.add(linked);
        break;
      case 'a linked document that carries a required decision the Implementation Plan does not name':
        this.planOfRecord = `Required decision location: linked supporting detail
Supporting detail: ${linked}
Supporting authority: subordinate
`;
        this.planOfRecordSupporting.add(linked);
        break;
      default:
        assert.fail(`unknown plan-of-record artifact state: ${artifactState}`);
    }
  },
);

// ---------------------------------------------------------------------------
// Givens — shipped documents, manifest, and record
// ---------------------------------------------------------------------------

Given('the shipped bdd skill documents', function (this: PlanWorld) {
  for (const root of BDD_SKILL_ROOTS) {
    assert.ok(existsSync(root), `${root} must exist`);
  }
});

Given('the shipped templates and hook sources', function (this: PlanWorld) {
  for (const root of GREP_ROOTS) {
    assert.ok(existsSync(nodePath.join(PROJECT_ROOT, root)), `${root} must exist`);
  }
});

Given('the shipped bdd skill documents and the impl-plan template', function (this: PlanWorld) {
  for (const path of IMPL_PLAN_TEMPLATE_COPIES) {
    assert.ok(existsSync(path), `${path} must exist`);
  }
});

Given('the shipped website configuration reference', function (this: PlanWorld) {
  this.websiteReference = readFileSync(
    nodePath.join(PROJECT_ROOT, 'packages/website/src/content/docs/reference/configuration.mdx'),
    'utf8',
  );
});

Given('the shipped bdd splitting document', function (this: PlanWorld) {
  this.docs = readCopies('SPLITTING.md');
});

Given('the canonical phase list', function (this: PlanWorld) {
  // Read the shipped hook lib's CANONICAL_PHASES as source text — this lane
  // never imports project value modules.
  const source = readFileSync(
    nodePath.join(PROJECT_ROOT, 'packages/cli/templates/hooks/lib/phase-provenance.ts'),
    'utf8',
  );
  const arrayText = source.match(/export const CANONICAL_PHASES = \[([^\]]+)\]/)?.[1];
  assert.ok(arrayText, 'CANONICAL_PHASES not found in the shipped hook lib');
  this.phaseList = [...arrayText.matchAll(/'([^']+)'/g)].map(match => match[1] ?? '');
});

Given('the schema manifest', function (this: PlanWorld) {
  this.schemaSource = readFileSync(
    nodePath.join(PROJECT_ROOT, 'packages/cli/src/schema.ts'),
    'utf8',
  );
  this.cursorWrapperSource = readFileSync(
    nodePath.join(PROJECT_ROOT, 'packages/cli/src/cursor-wrappers.ts'),
    'utf8',
  );
});

Given('the project architecture record', function (this: PlanWorld) {
  this.architectureRecord = readFileSync(nodePath.join(PROJECT_ROOT, 'ARCHITECTURE.md'), 'utf8');
});

// ---------------------------------------------------------------------------
// Whens — gate, hook, and CLI invocations
// ---------------------------------------------------------------------------

When('the phase order is inspected', function (this: PlanWorld) {
  assert.ok(this.phaseList);
  assert.ok(this.phaseList.length > 0);
});

When(
  'the installed Safeword CLI requests Execution Planning',
  SUBPROCESS,
  function (this: PlanWorld) {
    requestExecutionPlanning(this);
  },
);

When('the plan-implementation distribution is inspected', function (this: PlanWorld) {
  assert.ok(this.schemaSource);
  assert.ok(this.schemaSource.length > 0);
  assert.ok(this.cursorWrapperSource);
  assert.ok(this.cursorWrapperSource.length > 0);
});

When('accepted architecture decisions are inspected', function (this: PlanWorld) {
  assert.ok(this.architectureRecord);
  assert.ok(this.architectureRecord.length > 0);
});

When(
  'the agent sets the ticket phase to {word}',
  SUBPROCESS,
  function (this: PlanWorld, targetPhase: string) {
    advancePhase(this, targetPhase);
  },
);

When('the plan is validated at a phase gate', SUBPROCESS, function (this: PlanWorld) {
  // Implementation Planning hands its design to Execution Planning; entering
  // implement additionally requires the separately reviewed execution plan.
  advancePhase(this, 'plan-execution');
});

When('the agent edits an application source file', SUBPROCESS, function (this: PlanWorld) {
  const sourcePath = nodePath.join(this.projectDirectory!, 'src', 'app.ts');
  mkdirSync(nodePath.dirname(sourcePath), { recursive: true });
  writeFileSync(sourcePath, 'export const app = 1;\n');
  bindActiveTicket(this, SESSION_ID);
  this.verdict = runPreTool(
    this,
    'Edit',
    {
      file_path: sourcePath,
      old_string: 'export const app = 1;',
      new_string: 'export const app = 2;',
    },
    SESSION_ID,
  );
});

When('the agent writes impl-plan.md in the ticket folder', SUBPROCESS, function (this: PlanWorld) {
  bindActiveTicket(this, SESSION_ID);
  this.verdict = runPreTool(
    this,
    'Write',
    { file_path: ticketArtifact(this, 'impl-plan.md'), content: VALID_PLAN },
    SESSION_ID,
  );
});

When('the agent ends the session', SUBPROCESS, function (this: PlanWorld) {
  this.stop = runStopHook(this);
});

When('the boundary check runs on its commit', SUBPROCESS, function (this: PlanWorld) {
  const directory = this.projectDirectory!;
  git(directory, 'init --quiet');
  git(directory, 'config user.email test@test.com');
  git(directory, 'config user.name Test');
  git(directory, 'commit --allow-empty -m baseline --quiet');
  git(directory, 'add -A');
  const result = spawnSync('bun', [CLI, 'boundary', '--at', 'commit'], {
    cwd: directory,
    encoding: 'utf8',
  });
  this.cli = {
    exitCode: result.status ?? 1,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim(),
  };
});

When('the user submits a prompt', SUBPROCESS, function (this: PlanWorld) {
  this.promptOutput = execFileSync('bun', [PROMPT_HOOK], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, CLAUDE_PROJECT_DIR: this.projectDirectory },
    input: '{}',
    encoding: 'utf8',
  });
});

When('the plan is submitted for semantic review', SUBPROCESS, function (this: PlanWorld) {
  assert.ok(this.planContractState, 'the contract state was not arranged');
  const result = spawnSync('bun', [PLAN_CONTRACT_REVIEW_HELPER], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    input: JSON.stringify({ contractState: this.planContractState }),
  });
  assert.equal(result.status, 0, result.stderr);
  this.planContractReview = JSON.parse(result.stdout) as PlanWorld['planContractReview'];
});

When('its focused decision review is completed', function (this: PlanWorld) {
  assert.ok(this.focusedPlan, 'the focused-review plan fixture was not arranged');
  const contract = extractPackagedPlanReviewRubric(readFileSync(CODEX_BDD_PLAN_REFERENCE, 'utf8'));
  this.focusedPlanReview = reviewFocusedDecisionPath(contract, this.focusedPlan);
});

When('its semantic review reaches a verdict', function (this: PlanWorld) {
  assert.ok(this.focusedPlan, 'the focused-review receipt fixture was not arranged');
  const contract = extractPackagedPlanReviewRubric(readFileSync(CODEX_BDD_PLAN_REFERENCE, 'utf8'));
  this.focusedPlanReview = reviewFocusedDecisionPath(contract, this.focusedPlan);
});

When('its decision review runs', function (this: PlanWorld) {
  assert.ok(this.planState, 'the plan-state fixture was not arranged');
  const contract = extractPackagedPlanReviewRubric(readFileSync(CODEX_BDD_PLAN_REFERENCE, 'utf8'));
  this.planStateReview = reviewPlanState(contract, this.planState);
});

When('the Implementation Plan is reviewed', function (this: PlanWorld) {
  const contract = extractPackagedPlanReviewRubric(readFileSync(CODEX_BDD_PLAN_REFERENCE, 'utf8'));
  if (this.measurementApplicability !== undefined) {
    this.measurementApplicabilityReview = reviewMeasurementApplicability(
      contract,
      this.measurementApplicability,
    );
    return;
  }
  if (this.measurementDesign !== undefined) {
    this.measurementDesignReview = reviewMeasurementDesign(contract, this.measurementDesign);
    return;
  }
  if (this.decisionDepth !== undefined) {
    this.decisionDepthReview = reviewDecisionDepth(contract, this.decisionDepth);
    return;
  }
  if (this.planState !== undefined) {
    this.planStateReview = reviewPlanState(contract, this.planState);
    return;
  }
  if (this.personaInventory !== undefined) {
    this.personaInventoryReview = reviewPersonaInventory(contract, this.personaInventory);
    return;
  }
  if (this.personaConsequence !== undefined) {
    this.personaConsequenceReview = reviewPersonaConsequences(contract, this.personaConsequence);
    return;
  }
  if (this.dataPlan !== undefined) {
    this.dataPlanReview = reviewDataApplicability(contract, this.dataPlan);
    return;
  }
  if (this.dataOwnershipPlan !== undefined) {
    this.dataOwnershipReview = reviewDataOwnershipConsistency(contract, this.dataOwnershipPlan);
    return;
  }
  if (this.planOfRecord !== undefined) {
    this.planOfRecordReview = reviewPlanOfRecord(
      contract,
      this.planOfRecord,
      this.planOfRecordSupporting ?? new Set(),
    );
    return;
  }
  assert.fail('no Implementation Plan review fixture was arranged');
});

When('Implementation Planning converges', async function (this: PlanWorld) {
  assert.ok(this.scopeExpansionInput, 'the scope expansion input was not arranged');
  const module = (await import('../packages/cli/templates/hooks/lib/impl-plan.ts')) as Record<
    string,
    unknown
  >;
  const evaluate = module.evaluateScopeExpansion;
  assert.equal(typeof evaluate, 'function', 'the scope-authority consumer is missing');
  this.scopeExpansionDecision = (
    evaluate as (input: PlanWorld['scopeExpansionInput']) => PlanWorld['scopeExpansionDecision']
  )(this.scopeExpansionInput);
});

When(
  /^the installed Safeword planning edit gate evaluates (.+) during Implementation Planning$/u,
  function (this: PlanWorld, targetPath: string) {
    const project = this.projectDirectory!;
    const targets: Record<string, string> = {
      'that exact file': 'docs/decisions.md',
      'a sibling file beside it': 'docs/decisions-notes.md',
      'a direct child named YYYYMMDD-slug.md': 'docs/adr/20260910-new-decision.md',
      'a direct child that does not match YYYYMMDD-slug.md': 'docs/adr/new-decision.md',
      'a nested dated ADR below a child directory': 'docs/adr/nested/20260910-decision.md',
      'a dated ADR outside that directory': 'docs/20260910-outside.md',
      'an ordinary source path': 'src/app.ts',
    };
    if (
      targetPath ===
      'a direct child named YYYYMMDD-slug.md whose resolved target lies outside that directory'
    ) {
      writeFileSync(nodePath.join(project, 'docs/outside.md'), '# Outside\n');
      const linked = nodePath.join(project, 'docs/adr/20260910-escaped.md');
      symlinkSync('../outside.md', linked);
      this.architectureEditTarget = linked;
    } else {
      const relative = targets[targetPath];
      assert.ok(relative, `unknown architecture edit target: ${targetPath}`);
      this.architectureEditTarget = nodePath.join(project, relative);
      if (targetPath.includes('nested')) mkdirSync(nodePath.dirname(this.architectureEditTarget));
    }
    this.verdict = runPreTool(this, 'Edit', { file_path: this.architectureEditTarget }, SESSION_ID);
  },
);

When(
  'the installed Safeword CLI prepares Implementation Plan review through real internal collaborators',
  SUBPROCESS,
  function (this: PlanWorld) {
    assert.ok(this.installedCliPath, 'the packaged Safeword CLI was not arranged');
    assert.ok(this.controlInstalledCliPath, 'the control packaged CLI was not arranged');
    assert.ok(this.reviewerBinDirectory, 'the deterministic reviewer was not arranged');
    assert.ok(this.reviewerLaunchLog, 'the reviewer launch log was not arranged');
    const run = (cliPath: string) =>
      spawnSync(
        'bun',
        [
          cliPath,
          'review',
          'run',
          'plan-implementation',
          '--json',
          '--',
          nodePath.relative(this.projectDirectory!, ticketArtifact(this, 'impl-plan.md')),
        ],
        {
          cwd: this.projectDirectory,
          encoding: 'utf8',
          env: {
            ...process.env,
            CLAUDE_PROJECT_DIR: this.projectDirectory,
            NODE_ENV: 'test',
            PATH: `${this.reviewerBinDirectory}:${process.env.PATH ?? ''}`,
            SAFEWORD_AGENT_RUNTIME: 'codex',
            SAFEWORD_REVIEW_LAUNCH_LOG: this.reviewerLaunchLog,
          },
        },
      );
    const control = run(this.controlInstalledCliPath);
    assert.equal(control.status, 0, `${control.stdout ?? ''}\n${control.stderr ?? ''}`);
    assert.match(control.stdout, /"status":"approved"/);
    assert.match(readFileSync(this.reviewerLaunchLog, 'utf8'), /invoked/);

    const result = run(this.installedCliPath);
    this.cli = {
      exitCode: result.status ?? 1,
      output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim(),
    };
  },
);

When(
  'those structural and semantic evidence checks run through the installed Safeword CLI',
  SUBPROCESS,
  function (this: PlanWorld) {
    assert.ok(this.installedCliPath, 'the packaged Safeword CLI was not installed');
    const result = spawnSync(
      'bun',
      [this.installedCliPath, 'hook', 'codex', 'pre-tool-use', '--plugin-hook'],
      {
        cwd: this.projectDirectory,
        env: { ...process.env, CLAUDE_PROJECT_DIR: this.projectDirectory },
        input: JSON.stringify({
          hook_event_name: 'PreToolUse',
          session_id: SESSION_ID,
          tool_name: 'Edit',
          tool_input: {
            file_path: ticketArtifact(this, 'ticket.md'),
            old_string: 'phase: plan-implementation',
            new_string: 'phase: plan-execution',
          },
        }),
        encoding: 'utf8',
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const output = (result.stdout ?? '').trim();
    if (output === '') {
      this.verdict = { decision: 'allow', text: '' };
      return;
    }
    const parsed = JSON.parse(output) as {
      systemMessage?: string;
      hookSpecificOutput?: {
        permissionDecision?: string;
        permissionDecisionReason?: string;
        additionalContext?: string;
      };
    };
    this.verdict = {
      decision: parsed.hookSpecificOutput?.permissionDecision === 'deny' ? 'deny' : 'allow',
      text: [
        parsed.hookSpecificOutput?.permissionDecisionReason ?? '',
        parsed.hookSpecificOutput?.additionalContext ?? '',
        parsed.systemMessage ?? '',
      ].join('\n'),
    };
  },
);

When(
  'the installed Safeword CLI completes the review and repair loop through real internal collaborators and the controlled reviewer process boundary',
  SUBPROCESS,
  function (this: PlanWorld) {
    const first = runRepairReview(this);
    const firstId = first.data?.review_id;
    assert.ok(firstId, 'the first review receipt has no review identity');

    writeFileSync(ticketArtifact(this, 'impl-plan.md'), `${VALID_PLAN}\n\nREPAIR_COMPLETE\n`);
    const firstAfterCorrection = reviewStatus(this, firstId);
    const current = runRepairReview(this);
    this.repairReviews = { first, firstAfterCorrection, current };
  },
);

When('the repair loop reaches that defect', SUBPROCESS, function (this: PlanWorld) {
  const first = runRepairReview(this);
  this.repairReviews = { first, current: first };
});

When('those current bytes are reviewed again', SUBPROCESS, function (this: PlanWorld) {
  const first = runRepairReview(this);
  this.repairReviews = { first, current: first };
});

When(
  'the installed Safeword CLI presents the review receipt through real internal collaborators',
  SUBPROCESS,
  function (this: PlanWorld) {
    assert.ok(this.installedCliPath, 'the packaged Safeword CLI was not installed');
    assert.ok(this.reviewerBinDirectory, 'the deterministic reviewer was not arranged');
    const result = spawnSync(
      'bun',
      [
        this.installedCliPath,
        'review',
        'run',
        'plan-implementation',
        '--',
        nodePath.relative(this.projectDirectory!, ticketArtifact(this, 'impl-plan.md')),
      ],
      {
        cwd: this.projectDirectory,
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: this.projectDirectory,
          NODE_ENV: 'test',
          PATH: `${this.reviewerBinDirectory}:${process.env.PATH ?? ''}`,
          SAFEWORD_AGENT_RUNTIME: 'codex',
        },
      },
    );
    this.cli = {
      exitCode: result.status ?? 1,
      output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim(),
    };
  },
);

// ---------------------------------------------------------------------------
// Whens — document reads
// ---------------------------------------------------------------------------

When('PLAN_IMPLEMENTATION.md is read', function (this: PlanWorld) {
  this.docs = readCopies('PLAN_IMPLEMENTATION.md');
});

When('the resume table and phase-file table are read', function (this: PlanWorld) {
  this.docs = readCopies('SKILL.md');
});

When('the scenario-gate exit checklist is read', function (this: PlanWorld) {
  this.docs = readCopies('SCENARIOS.md');
});

When('the planning and TDD phase docs are read', function (this: PlanWorld) {
  this.planDocs = readCopies('PLAN_IMPLEMENTATION.md');
  this.tddDocs = readCopies('TDD.md');
});

When('the Doc impact section is read', function (this: PlanWorld) {
  this.docs = readCopies('PLAN_IMPLEMENTATION.md');
  this.templateDocs = IMPL_PLAN_TEMPLATE_COPIES.map(path => ({
    path,
    text: readFileSync(path, 'utf8'),
  }));
});

When('its checkpoint and restart tables are read', function (this: PlanWorld) {
  assert.ok(this.docs !== undefined, 'the splitting document was not read');
});

When('the designApprovalGate entry is read', function (this: PlanWorld) {
  assert.ok(this.websiteReference !== undefined, 'the configuration reference was not read');
});

When('they are searched for the phrase {string}', function (this: PlanWorld, phrase: string) {
  this.grepHits = [];
  for (const root of GREP_ROOTS) {
    const result = spawnSync('grep', ['-rlF', phrase, root], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    });
    assert.ok(
      result.status === 0 || result.status === 1,
      `grep failed for ${root}: ${result.stderr}`,
    );
    const hits = (result.stdout ?? '').trim();
    if (hits !== '') this.grepHits.push(`${root}: ${hits}`);
  }
});

// ---------------------------------------------------------------------------
// Thens — transition gate decisions
// ---------------------------------------------------------------------------

Then('the phase change is accepted', function (this: PlanWorld) {
  assert.equal(
    this.verdict?.decision,
    'allow',
    `expected the phase change to be allowed; denial was:\n${this.verdict?.text}`,
  );
});

Then(
  'the workflow keeps the ticket in Implementation Planning and reports the unresolved choice',
  function (this: PlanWorld) {
    assert.equal(
      this.verdict?.decision,
      'deny',
      'installed CLI must keep an unresolved behavior-shaping choice in Implementation Planning',
    );
    assert.equal(this.ticketPhase, 'plan-implementation');
    assert.match(this.verdict?.text ?? '', /Authentication ownership/);
  },
);

Then(
  'the first receipt names all three defects together and the approving receipt binds the corrected bytes rather than the original bytes and records no remaining blocking defect',
  function (this: PlanWorld) {
    const reviews = this.repairReviews;
    assert.ok(reviews?.current, 'the repair loop did not produce both receipts');
    const firstFindings = reviews.first.findings.map(finding => finding.message).join('\n');
    assert.match(firstFindings, /Authorization boundary is missing/u);
    assert.match(firstFindings, /owner conflicts with its policy-service source of truth/u);
    assert.match(firstFindings, /Rollback behavior is undecided/u);
    assert.equal(reviews.firstAfterCorrection?.data?.status, 'stale');
    assert.equal(reviews.current.data?.status, 'approved');
    assert.equal(
      reviews.current.findings.some(finding => finding.severity === 'error'),
      false,
    );
    assert.notEqual(reviews.first.data?.review_id, reviews.current.data?.review_id);
  },
);

Then(
  'the plan remains unapproved with the pending decision, its consequences, and the one resume action named',
  function (this: PlanWorld) {
    const review = this.repairReviews?.current;
    assert.ok(review, 'the external-authority review did not run');
    assert.notEqual(review.data?.status, 'approved');
    const findings = review.findings.map(finding => finding.message).join('\n');
    assert.match(findings, /Pending user decision/u);
    assert.match(findings, /Deny-by-default prevents exposure but reduces availability/u);
    assert.match(findings, /cached access preserves availability but can serve stale authority/u);
    assert.match(
      findings,
      /Resume: ask the user to choose one outcome, record it, then re-run plan review/u,
    );
    assert.equal(this.ticketPhase, 'plan-implementation');
  },
);

Then('the plan is eligible to proceed from Implementation Planning', function (this: PlanWorld) {
  const review = this.repairReviews?.current;
  assert.equal(review?.data?.status, 'approved');
  assert.equal(
    review?.findings.some(finding => finding.severity === 'error'),
    false,
  );
});

Then(
  'the plan remains blocked on that decision and returns to repair rather than being approved because one repair occurred',
  function (this: PlanWorld) {
    const review = this.repairReviews?.current;
    assert.ok(review, 'the corrected plan was not re-reviewed');
    assert.notEqual(review.data?.status, 'approved');
    assert.match(
      review.findings.map(finding => finding.message).join('\n'),
      /Authorization boundary is still missing; return to repair/u,
    );
    assert.equal(this.ticketPhase, 'plan-implementation');
  },
);

Then('the workflow enters Execution Planning', function (this: PlanWorld) {
  if (this.result !== undefined) {
    assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
    return;
  }
  assert.equal(
    this.verdict?.decision,
    'allow',
    `expected Execution Planning entry; denial was:\n${this.verdict?.text ?? ''}`,
  );
  assert.equal(this.ticketPhase, 'plan-execution');
  assert.match(readFileSync(ticketArtifact(this, 'ticket.md'), 'utf8'), /phase: plan-execution/);
});

Then(
  'the plan is eligible for semantic review against those shared obligations',
  function (this: PlanWorld) {
    const review = this.planContractReview;
    assert.ok(review, 'semantic review did not return a result');
    assert.equal(review.verdict, 'approve');
    assert.deepEqual(review.authorObligations, review.reviewerObligations);
    assert.ok(review.authorObligations.length > 0, 'the shared contract has no obligations');
    assert.equal(
      review.findings.some(finding => /contract reconciliation/i.test(finding.message)),
      false,
      'matching contracts must not add a reconciliation finding',
    );
  },
);

Then(
  'approval is blocked with the conflicting obligation named for contract reconciliation',
  function (this: PlanWorld) {
    const review = this.planContractReview;
    assert.ok(review, 'semantic review did not return a result');
    assert.equal(
      review.verdict,
      'request_changes',
      'contract reconciliation must block approval when Proof quality conflicts with Require execution sequencing',
    );
    const errors = review.findings
      .filter(finding => finding.severity === 'error')
      .map(finding => finding.message)
      .join('\n');
    assert.match(errors, /Proof quality/);
    assert.match(errors, /Require execution sequencing/);
    assert.match(errors, /contract reconciliation/i);
  },
);

Then(
  'authoring and approval are blocked with the regenerate action named',
  function (this: PlanWorld) {
    assert.ok(this.cli, 'the installed review command did not return');
    assert.match(
      this.cli.output,
      /packaged decision-quality contract/i,
      `installed CLI did not name the generate:plan-rubric recovery for its missing packaged decision-quality contract:\n${this.cli.output}`,
    );
    assert.match(this.cli.output, /generate:plan-rubric/);
    assert.notEqual(this.cli.exitCode, 0);
  },
);

Then('the plan fails focused reviewability', function (this: PlanWorld) {
  assert.equal(this.focusedPlanReview?.verdict, 'request_changes');
  assert.ok(this.focusedExpectedFinding, 'the expected removable detail was not arranged');
  assert.match(
    this.focusedPlanReview?.findings.map(finding => finding.message).join('\n') ?? '',
    new RegExp(this.focusedExpectedFinding, 'u'),
  );
});

Then('the plan passes focused reviewability', function (this: PlanWorld) {
  assert.equal(
    this.focusedPlanReview?.verdict,
    'approve',
    this.focusedPlanReview?.findings.map(finding => finding.message).join('\n'),
  );
});

Then(
  'the plan fails focused reviewability because it does not open with an architecture-at-a-glance mental model',
  function (this: PlanWorld) {
    assert.equal(this.focusedPlanReview?.verdict, 'request_changes');
    assert.match(
      this.focusedPlanReview?.findings.map(finding => finding.message).join('\n') ?? '',
      /architecture-at-a-glance mental model/,
    );
  },
);

Then(
  'the plan passes focused reviewability because the decision remains in the main review path',
  function (this: PlanWorld) {
    assert.equal(
      this.focusedPlanReview?.verdict,
      'approve',
      this.focusedPlanReview?.findings.map(finding => finding.message).join('\n'),
    );
  },
);

Then(
  'the plan fails focused reviewability because that decision is absent from the review path',
  function (this: PlanWorld) {
    assert.equal(this.focusedPlanReview?.verdict, 'request_changes');
    assert.match(
      this.focusedPlanReview?.findings.map(finding => finding.message).join('\n') ?? '',
      /failure-posture decision and its consequence are absent/,
    );
  },
);

function assertDataFindings(world: PlanWorld, ...findings: string[]): void {
  assert.equal(world.dataPlanReview?.verdict, 'request_changes');
  const messages = world.dataPlanReview?.findings.map(finding => finding.message).join('\n') ?? '';
  for (const finding of findings) assert.match(messages, new RegExp(finding, 'iu'));
}

Then('approval is blocked with ownership and migration named', function (this: PlanWorld) {
  assertDataFindings(this, 'Ownership and access', 'Migration and backfill');
});

Then(
  'approval is blocked with purpose, store and model, and schema relationships named',
  function (this: PlanWorld) {
    assertDataFindings(this, 'Purpose', 'Store and model', 'Schema and relationships');
  },
);

Then('approval is blocked with retention and rollback named', function (this: PlanWorld) {
  assertDataFindings(this, 'Lifecycle and retention', 'Rollback');
});

Then('approval is blocked with identity and integrity named', function (this: PlanWorld) {
  assertDataFindings(this, 'Identity and integrity');
});

Then('data guidance does not block approval', function (this: PlanWorld) {
  assert.equal(
    this.dataPlanReview?.verdict,
    'approve',
    this.dataPlanReview?.findings.map(finding => finding.message).join('\n'),
  );
});

Then('approval is blocked with source of truth and access named', function (this: PlanWorld) {
  assertDataFindings(this, 'Source of truth', 'Ownership and access');
});

Then('approval is blocked with compliance named', function (this: PlanWorld) {
  assertDataFindings(this, 'Compliance');
});

Then('approval is blocked with the conflicting data owner named', function (this: PlanWorld) {
  assert.equal(this.dataOwnershipReview?.verdict, 'request_changes');
  assert.match(
    this.dataOwnershipReview?.findings.map(finding => finding.message).join('\n') ?? '',
    /conflicting data owner.+profile service/iu,
  );
});

Then('data ownership consistency does not block approval', function (this: PlanWorld) {
  assert.equal(
    this.dataOwnershipReview?.verdict,
    'approve',
    this.dataOwnershipReview?.findings.map(finding => finding.message).join('\n'),
  );
});

Then('eligible for semantic review', function (this: PlanWorld) {
  assert.equal(
    this.verdict?.decision,
    'allow',
    `complete evidence should reach semantic review:\n${this.verdict?.text ?? ''}`,
  );
});

Then('the capability remains outside the accepted plan', function (this: PlanWorld) {
  assert.deepEqual(this.scopeExpansionDecision, {
    accepted: false,
    reason: 'missing-or-mismatched-user-authority',
  });
});

Then("the capability enters this ticket's accepted consumer boundary", function (this: PlanWorld) {
  assert.deepEqual(this.scopeExpansionDecision, {
    accepted: true,
    reason: 'matching-user-authority',
  });
});

Then('persona coverage does not block approval', function (this: PlanWorld) {
  assert.equal(
    this.personaConsequenceReview?.verdict,
    'approve',
    this.personaConsequenceReview?.findings.map(finding => finding.message).join('\n'),
  );
});

Then(
  /^approval is blocked with the uncovered (trust|operation|approval|recovery) need named$/u,
  function (this: PlanWorld, need: string) {
    assert.equal(this.personaConsequenceReview?.verdict, 'request_changes');
    assert.match(
      this.personaConsequenceReview?.findings.map(finding => finding.message).join('\n') ?? '',
      new RegExp(`uncovered ${need} need`, 'iu'),
    );
  },
);

Then(
  'approval is blocked with the omitted Non-Technical Builder and safe-recovery consequence named',
  function (this: PlanWorld) {
    assert.equal(this.personaInventoryReview?.verdict, 'request_changes');
    const findings =
      this.personaInventoryReview?.findings.map(finding => finding.message).join('\n') ?? '';
    assert.match(findings, /omits Non-Technical Builder/iu);
    assert.match(findings, /safe-recovery consequence/iu);
  },
);

Then(/^the receipt records (.+)$/u, function (this: PlanWorld, receiptResult: string) {
  const review = this.focusedPlanReview;
  assert.ok(review, 'semantic review did not produce a receipt');
  if (receiptResult === 'a reviewability pass') {
    assert.equal(
      review.verdict,
      'approve',
      review.findings.map(finding => finding.message).join('\n'),
    );
    assert.match(review.summary, /reviewability: pass/iu);
    return;
  }
  assert.equal(
    receiptResult,
    'a reviewability failure naming the obscuring detail',
    `unknown receipt result: ${receiptResult}`,
  );
  assert.equal(review.verdict, 'request_changes');
  assert.match(review.summary, /reviewability: failure/iu);
  assert.match(
    review.findings.map(finding => finding.message).join('\n'),
    /step-by-step coding instructions/iu,
  );
});

Then(
  'its first user-visible sentence says the shared-contract choice needs an architecture record and its recovery line tells them to add that link before resubmitting, with neither line containing phase names, review identifiers, contract digests, or internal type names',
  function (this: PlanWorld) {
    const lines = this.cli?.output
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    assert.ok(
      lines && lines.length >= 2,
      `installed CLI returned no layered receipt:\n${this.cli?.output}`,
    );
    const firstSentence = lines[0] ?? '';
    const recoveryLine = lines.find(line => /^Recovery:/u.test(line)) ?? '';
    assert.match(
      firstSentence,
      /shared-contract choice needs (?:a durable )?architecture record/iu,
    );
    assert.match(recoveryLine, /add.+architecture link.+before resubmitting/iu);
    const nonTechnicalLines = `${firstSentence}\n${recoveryLine}`;
    assert.doesNotMatch(
      nonTechnicalLines,
      /plan-implementation|plan-execution|review[_ -]?id|dispatch[_ -]?id|sha-?256|digest|ReviewerOutput|CliResult/iu,
    );
  },
);

Then(
  'it preserves the failing check, Implementation Plan location, and durable-record obligation alongside the recovery',
  function (this: PlanWorld) {
    const output = this.cli?.output ?? '';
    assert.match(output, /Check: durable architecture link — failed/iu);
    assert.match(
      output,
      new RegExp(`Implementation Plan: \\.project/tickets/${TICKET_FOLDER}/impl-plan\\.md`, 'u'),
    );
    assert.match(
      output,
      /Obligation: shared-contract choices require a resolvable durable architecture record/iu,
    );
    assert.match(output, /Recovery: add the durable architecture link before resubmitting/iu);
  },
);

Then(
  /^approval is blocked because (implementation is presented as proof|proof is presented as human authority|independent review is presented as human authority)$/u,
  function (this: PlanWorld, reason: string) {
    assert.equal(this.planStateReview?.verdict, 'request_changes');
    assert.match(
      this.planStateReview?.findings.map(finding => finding.message).join('\n') ?? '',
      new RegExp(reason, 'iu'),
    );
  },
);

Then('state truthfulness does not block approval', function (this: PlanWorld) {
  assert.equal(
    this.planStateReview?.verdict,
    'approve',
    this.planStateReview?.findings.map(finding => finding.message).join('\n'),
  );
});

Then('decision depth does not block approval', function (this: PlanWorld) {
  assert.equal(
    this.decisionDepthReview?.verdict,
    'approve',
    this.decisionDepthReview?.findings.map(finding => finding.message).join('\n'),
  );
});

Then(
  /^approval is blocked with (the missing evidence model|the missing authority decision|atomicity boundary and retry behavior|the missing lifecycle evidence model|crash boundary, retry behavior, and compatibility policy|cutover boundary, retry behavior, and preserved interoperability evidence) named$/u,
  function (this: PlanWorld, missing: string) {
    assert.equal(this.decisionDepthReview?.verdict, 'request_changes');
    const messages =
      this.decisionDepthReview?.findings.map(finding => finding.message).join('\n') ?? '';
    const expected = missing
      .replace(/^the missing /u, '')
      .split(/, and | and |, /u)
      .map(value => value.trim());
    for (const field of expected) assert.match(messages, new RegExp(field, 'iu'));
  },
);

Then('measurement design does not block approval', function (this: PlanWorld) {
  const review = this.measurementApplicabilityReview ?? this.measurementDesignReview;
  assert.equal(
    review?.verdict,
    'approve',
    review?.findings.map(finding => finding.message).join('\n'),
  );
});

Then(
  /^approval is blocked because (?:the )?(Product-owned target was changed|Product-owned population was changed|instrumentation belongs in Execution Planning)$/u,
  function (this: PlanWorld, reason: string) {
    assert.equal(this.measurementDesignReview?.verdict, 'request_changes');
    assert.match(
      this.measurementDesignReview?.findings.map(finding => finding.message).join('\n') ?? '',
      new RegExp(reason, 'iu'),
    );
  },
);

Then('approval is blocked with the missing validity decision named', function (this: PlanWorld) {
  assert.equal(this.measurementDesignReview?.verdict, 'request_changes');
  assert.match(
    this.measurementDesignReview?.findings.map(finding => finding.message).join('\n') ?? '',
    /missing validity decision/iu,
  );
});

Then('approval is blocked until measurement applicability is explicit', function (this: PlanWorld) {
  assert.equal(this.measurementApplicabilityReview?.verdict, 'request_changes');
  assert.match(
    this.measurementApplicabilityReview?.findings.map(finding => finding.message).join('\n') ?? '',
    /measurement applicability.+explicit/iu,
  );
});

Then('approval is blocked until the measurement skip is justified', function (this: PlanWorld) {
  assert.equal(this.measurementApplicabilityReview?.verdict, 'request_changes');
  assert.match(
    this.measurementApplicabilityReview?.findings.map(finding => finding.message).join('\n') ?? '',
    /measurement skip.+justified/iu,
  );
});

Then(
  /^blocked by the structural check with the missing (evidence reference|applicable version|retrieval date) named$/u,
  function (this: PlanWorld, missingField: string) {
    assert.equal(this.verdict?.decision, 'deny', 'incomplete evidence must be blocked');
    const reason = this.verdict?.text?.split('\n')[0] ?? '';
    assert.match(
      reason,
      new RegExp(`Implementation decision evidence is missing the ${missingField}\\.`, 'iu'),
    );
    for (const presentField of ['evidence reference', 'applicable version', 'retrieval date']) {
      if (presentField !== missingField) {
        assert.doesNotMatch(reason, new RegExp(presentField, 'iu'));
      }
    }
  },
);

Then(
  'the architecture-record edit is permitted so a significant decision can be recorded before review',
  function (this: PlanWorld) {
    assert.equal(this.verdict?.decision, 'allow', this.verdict?.text);
  },
);

Then(
  'creation is permitted so a significant decision can be recorded before review',
  function (this: PlanWorld) {
    assert.equal(this.verdict?.decision, 'allow', this.verdict?.text);
  },
);

Then(/^the edit remains blocked because (.+)$/u, function (this: PlanWorld, _reason: string) {
  assert.equal(
    this.verdict?.decision,
    'deny',
    'the planning edit gate unexpectedly allowed the path',
  );
  assert.match(this.verdict?.text ?? '', /application code stays untouched while planning/iu);
});

Then('the edit remains blocked by the planning freeze', function (this: PlanWorld) {
  assert.equal(
    this.verdict?.decision,
    'deny',
    'the planning edit gate unexpectedly allowed the path',
  );
  assert.match(this.verdict?.text ?? '', /application code stays untouched while planning/iu);
});

Then(
  /^the receipt names (?:it|the Implementation Plan) as the single design plan of record and (?:requires no second design artifact|accepts the supporting link)$/u,
  function (this: PlanWorld) {
    assert.equal(this.planOfRecordReview?.verdict, 'approve');
    assert.match(this.planOfRecordReview?.summary ?? '', /single design plan of record/iu);
  },
);

Then(
  /^approval is blocked until (?:that authority|that required decision) returns to the Implementation Plan$/u,
  function (this: PlanWorld) {
    assert.equal(this.planOfRecordReview?.verdict, 'request_changes');
    assert.match(
      this.planOfRecordReview?.findings.map(finding => finding.message).join('\n') ?? '',
      /return .+ to impl-plan\.md/iu,
    );
  },
);

Then('the phase change is denied', function (this: PlanWorld) {
  assert.equal(this.verdict?.decision, 'deny', 'expected the hook to deny this phase change');
});

Then('the denial names the missing implementation plan', function (this: PlanWorld) {
  assert.match(this.verdict?.text ?? '', /impl-plan\.md/);
});

Then('the denial names the missing plan section', function (this: PlanWorld) {
  assert.match(this.verdict?.text ?? '', /Decisions/);
});

Then('the denial names the stale plan status', function (this: PlanWorld) {
  assert.match(this.verdict?.text ?? '', /implemented/);
});

Then('the denial names impl-plan.md as the missing artifact', function (this: PlanWorld) {
  assert.match(this.verdict?.text ?? '', /impl-plan\.md/);
});

Then('the denial names the scaffold template to author the plan from', function (this: PlanWorld) {
  assert.match(this.verdict?.text ?? '', /impl-plan-template\.md/);
});

Then(
  'the denial names plan-implementation and plan-execution as the skipped phases',
  function (this: PlanWorld) {
    assert.deepEqual(missingPhases(this.verdict?.text ?? ''), [
      'plan-implementation',
      'plan-execution',
    ]);
  },
);

Then('the plan passes', function (this: PlanWorld) {
  assert.equal(
    this.verdict?.decision,
    'allow',
    `expected the plan to pass its gate; denial was:\n${this.verdict?.text}`,
  );
});

Then('the plan fails validation naming the empty section', function (this: PlanWorld) {
  assert.equal(this.verdict?.decision, 'deny', 'expected the gate to fail the plan');
  assert.match(this.verdict?.text ?? '', /Doc impact/);
});

// ---------------------------------------------------------------------------
// Thens — code freeze
// ---------------------------------------------------------------------------

Then('the edit is denied', function (this: PlanWorld) {
  assert.equal(this.verdict?.decision, 'deny', 'expected the hook to deny this edit');
});

Then('the denial names the planning work remaining', function (this: PlanWorld) {
  const text = this.verdict?.text ?? '';
  assert.match(text, /planning|plan-implementation/i);
  assert.match(text, /impl-plan\.md/);
});

Then('the write is accepted', function (this: PlanWorld) {
  assert.equal(
    this.verdict?.decision,
    'allow',
    `expected the write to be allowed; denial was:\n${this.verdict?.text}`,
  );
});

// ---------------------------------------------------------------------------
// Thens — stop gate, boundary, and prompt reminder
// ---------------------------------------------------------------------------

Then('the stop is blocked until the ledger exists', function (this: PlanWorld) {
  assert.equal(this.stop?.decision, 'block', 'expected the stop hook to block');
  assert.match(this.stop?.reason ?? '', /test-definitions\.md/);
});

Then('the stop is allowed', function (this: PlanWorld) {
  assert.equal(this.stop?.exitCode, 0);
  assert.notEqual(this.stop?.decision, 'block', this.stop?.reason);
  const reason = this.stop?.reason ?? '';
  assert.ok(
    !reason.includes('requires impl-plan.md'),
    `mid-planning stop must not demand the plan; got:\n${reason}`,
  );
  assert.ok(
    !reason.includes('requires test-definitions.md'),
    `stop must not demand the ledger it already has; got:\n${reason}`,
  );
});

Then('the ledger check reports the missing ledger', function (this: PlanWorld) {
  assert.equal(this.cli?.exitCode, 0);
  assert.match(this.cli?.output ?? '', /ledger is missing|no test-definitions/i);
});

Then(
  'the injected phase reminder describes authoring the implementation plan',
  function (this: PlanWorld) {
    const output = this.promptOutput ?? '';
    assert.match(output, /plan-implementation/);
    assert.match(output, /impl-plan\.md/);
  },
);

// ---------------------------------------------------------------------------
// Thens — resume routing, scenario-gate exit, and swept surfaces
// ---------------------------------------------------------------------------

Then(
  'the plan-implementation row directs the agent to PLAN_IMPLEMENTATION.md and continuing the implementation plan',
  function (this: PlanWorld) {
    matchDocs(
      this.docs,
      /`plan-implementation`[^\n]*Continue the implementation plan \(\[PLAN_IMPLEMENTATION\.md\]\(PLAN_IMPLEMENTATION\.md\)\)/,
      /`plan-implementation`\s*\|\s*\[PLAN_IMPLEMENTATION\.md\]\(PLAN_IMPLEMENTATION\.md\)/,
    );
  },
);

Then('no exit step directs authoring impl-plan.md', function (this: PlanWorld) {
  eachDoc(this.docs, (text, path) => {
    assert.doesNotMatch(text, /Write `?impl-plan\.md`?/, path);
  });
});

Then('its phase advance targets plan-implementation', function (this: PlanWorld) {
  eachDoc(this.docs, (text, path) => {
    assert.ok(text.includes('phase: plan-implementation'), path);
  });
});

Then('no occurrences are found', function (this: PlanWorld) {
  assert.deepEqual(this.grepHits, [], `phrase still shipped:\n${this.grepHits?.join('\n')}`);
});

// ---------------------------------------------------------------------------
// Thens — PLAN_IMPLEMENTATION.md content contract
// ---------------------------------------------------------------------------

Then('it directs authoring impl-plan.md with the five design sections', function (this: PlanWorld) {
  eachDoc(this.docs, (text, path) => {
    assert.ok(text.includes('impl-plan.md'), path);
    for (const section of [
      'Approach',
      'Decisions',
      'Design alignment',
      'Known deviations',
      'Assessment triggers',
    ]) {
      assert.ok(text.includes(section), `${path} must name the ${section} section`);
    }
  });
});

Then(
  'it directs consulting the architecture record before filling the alignment section',
  function (this: PlanWorld) {
    matchDocs(this.docs, /paths\.architecture/, /before/i);
  },
);

Then(
  'it directs offering an ADR draft when a decision spans features, data ownership, or cross-service contracts',
  function (this: PlanWorld) {
    matchDocs(this.docs, /ADR/, /data ownership/i, /cross-service contracts/i);
  },
);

Then(
  'it directs amending or superseding the contradicted ADR rather than recording the deviation alone',
  function (this: PlanWorld) {
    matchDocs(this.docs, /supersed/i);
  },
);

Then(
  'it bounds the ADR offer to decisions affecting structure, key quality attributes, or ones difficult to reverse',
  function (this: PlanWorld) {
    matchDocs(
      this.docs,
      /shared structure or contracts/i,
      /key quality attributes/i,
      /difficult-to-reverse/i,
    );
  },
);

Then(
  "it directs recording routine choices in the plan's decisions table alone",
  function (this: PlanWorld) {
    matchDocs(this.docs, /Decisions table/i);
  },
);

Then(
  'it directs writing them to the location resolved from paths.architecture, appending to a file or adding a date-prefixed file to a directory',
  function (this: PlanWorld) {
    matchDocs(this.docs, /paths\.architecture/, /date-prefixed/i);
  },
);

Then('it directs scaffolding new ADRs from the shipped ADR template', function (this: PlanWorld) {
  matchDocs(this.docs, /New ADRs scaffold from `\.safeword\/templates\/adr-template\.md`/i);
});

Then(
  'it directs never writing decision records into generated architecture state documents',
  function (this: PlanWorld) {
    matchDocs(
      this.docs,
      /architecture\.generated\.md|generated architecture state/i,
      /never|not a destination|don't write/i,
    );
  },
);

Then(
  'they direct updating the plan and superseding any affected ADR when implementation contradicts a planned decision, before verify',
  function (this: PlanWorld) {
    matchDocs(this.planDocs, /during implement|mid-flight|proven wrong/i, /supersed/i);
    matchDocs(this.tddDocs, /reconcile the plan/i);
  },
);

Then(
  'it identifies affected documentation sources and required outcomes or a reasoned skip, leaving documentation tasks and build order to Execution Planning',
  function (this: PlanWorld) {
    matchDocs(
      this.docs,
      /Doc impact/,
      /docs\.sources/,
      /customer-visible/i,
      /required documentation outcome; Execution Planning owns the tasks and their build order/i,
      /Internal-only: `skip: <reason>`/i,
    );
    eachDoc(this.templateDocs, (text, path) => {
      assert.ok(text.includes('## Doc impact'), path);
      assert.ok(text.includes('docs.sources'), path);
    });
  },
);

Then(
  'it directs recording, for each surface the spec lists as affected, the proof that covers it or a per-surface skip with a reason',
  function (this: PlanWorld) {
    matchDocs(this.docs, /affected surface/i, /skip/i);
  },
);

Then('it states a brief plan is correct for a small feature', function (this: PlanWorld) {
  matchDocs(this.docs, /brief plan is correct|small feature/i);
});

Then(
  'it directs deeper treatment for hard-to-reverse or cross-cutting work',
  function (this: PlanWorld) {
    matchDocs(this.docs, /hard-to-reverse|cross-cutting/i);
  },
);

Then(
  'it keeps impl-plan.md as the single design plan, links qualifying ADRs, and permits only subordinate supporting detail',
  function (this: PlanWorld) {
    matchDocs(
      this.docs,
      /single feature design plan of record/i,
      /resolvable link to the configured\s+durable architecture record/i,
      /supporting detail cannot become a second design\s+authority/i,
    );
  },
);

Then('it directs keeping each ADR to a page or two', function (this: PlanWorld) {
  matchDocs(this.docs, /page or two/i);
});

Then('it warns against mega-records and design guides in disguise', function (this: PlanWorld) {
  matchDocs(this.docs, /mega/i);
});

Then(
  'its exit review directs flagging spans deletable without information loss',
  function (this: PlanWorld) {
    matchDocs(this.docs, /deleted? without (information )?loss|deletion test/i);
  },
);

Then(
  'it states a shorter plan scores no worse than a longer one at equal decision coverage',
  function (this: PlanWorld) {
    matchDocs(this.docs, /shorter plan scores no worse/i);
  },
);

Then('it states skip lines govern applicability, never effort or size', function (this: PlanWorld) {
  matchDocs(this.docs, /applicability, never effort/i);
});

Then(
  'the five sections remain content-or-skip regardless of feature size',
  function (this: PlanWorld) {
    matchDocs(this.docs, /content-or-skip/i);
  },
);

Then(
  'it directs reading the generated architecture state doc and the decision record for reuse candidates after sketching the ideal approach',
  function (this: PlanWorld) {
    matchDocs(
      this.docs,
      /after (sketching|designing) the ideal|ideal (approach|design) first/i,
      /reuse/i,
    );
  },
);

Then(
  'it frames existing architecture as changeable with a recorded decision, not a constraint to conform to',
  function (this: PlanWorld) {
    matchDocs(this.docs, /sunk[- ]cost|changeable with a recorded decision/i);
  },
);

Then(
  'it keeps component and data-model decisions in impl-plan.md and loads the data-architecture guide for applicable concerns',
  function (this: PlanWorld) {
    eachDoc(this.docs, (text, path) => {
      assert.match(text, /Keep each choice and its consequence in\s+`impl-plan.md`/i, path);
      assert.match(text, /data-architecture-guide/i, path);
      assert.match(
        text,
        /data contracts, ownership, lifecycle, migration, or cross-system flow change/i,
        path,
      );
    });
  },
);

Then(
  'it directs running the figure-it-out skill for each load-bearing design choice recorded in the decisions table',
  function (this: PlanWorld) {
    matchDocs(this.docs, /figure-it-out/i, /load-bearing/i);
  },
);

Then(
  "it directs mapping installed language skills to the plan's scenarios for the languages the feature touches",
  function (this: PlanWorld) {
    matchDocs(this.docs, /language skills?/i, /languages? the feature touches|feature's touched/i);
  },
);

Then(
  "it directs surfacing only the skills relevant to the feature's touched components, not the repository's full inventory",
  function (this: PlanWorld) {
    matchDocs(this.docs, /not the (repository|repo)'s full inventory|never the full inventory/i);
  },
);

Then(
  "it directs reading the installed version's documentation for each component the plan selects before recording the decision",
  function (this: PlanWorld) {
    matchDocs(this.docs, /installed version'?s? documentation/i);
  },
);

Then(
  "it directs any human-facing plan checkpoint to occur only after the phase's independent review has passed",
  function (this: PlanWorld) {
    matchDocs(this.docs, /independent review/i, /only after|before any human/i);
  },
);

Then(
  'it directs asking the user for information not derivable from the codebase or research whenever the gap appears',
  function (this: PlanWorld) {
    matchDocs(this.docs, /elicit|only the user (has|knows)/i);
  },
);

Then(
  'it states the reviewed plan advances to Execution Planning without human approval when designApprovalGate is absent or off',
  function (this: PlanWorld) {
    eachDoc(this.docs, (text, path) => {
      assert.ok(text.includes('designApprovalGate'), path);
      assert.match(text, /absent or off/i, path);
      assert.match(text, /advances autonomously|without human approval/i, path);
    });
  },
);

Then(
  'it states that with designApprovalGate enabled the reviewed plan requires user approval before Execution Planning',
  function (this: PlanWorld) {
    eachDoc(this.docs, (text, path) => {
      assert.ok(text.includes('designApprovalGate'), path);
      assert.match(text, /user's digest-bound approval or decline before changing phase/i, path);
      assert.match(text, /successful approval[\s\S]*sets `phase: plan-execution`/i, path);
      assert.match(
        text,
        /Declined, pending, invalid, or stale evidence remains in Implementation\s+Planning/i,
        path,
      );
    });
  },
);

Then(
  'it documents the key as defaulting to off with autonomous advancement',
  function (this: PlanWorld) {
    const text = this.websiteReference ?? '';
    assert.ok(text.includes('designApprovalGate'), 'configuration.mdx must document the key');
    assert.match(text, /default.*off|off.*default/i);
    assert.match(text, /autonomous/i);
  },
);

Then(
  'it directs sessions without an interactive user to record the pending approval in the work log',
  function (this: PlanWorld) {
    matchDocs(this.docs, /without an interactive user|headless/i, /work log/i);
  },
);

Then(
  "it directs surfacing the reviewed plan in the session's reviewable output",
  function (this: PlanWorld) {
    matchDocs(this.docs, /reviewable output|PR description|session summary/i);
  },
);

Then(
  'its steps require no bash auto-expansion and no interactively-authenticated tools',
  function (this: PlanWorld) {
    eachDoc(this.docs, (text, path) => {
      assert.doesNotMatch(text, /^!`/m, `${path} must carry no bash auto-expansion lines`);
    });
  },
);

Then(
  'its transition-gate and designApprovalGate guidance each define behavior for sessions without an interactive user',
  function (this: PlanWorld) {
    eachDoc(this.docs, (text, path) => {
      assert.ok(text.includes('designApprovalGate'), path);
      assert.match(text, /without an interactive user|headless/i, path);
      assert.match(text, /Cursor Cloud/i, path);
    });
  },
);

// ---------------------------------------------------------------------------
// Thens — canonical order, splitting, schema, and the architecture record
// ---------------------------------------------------------------------------

Then(
  'it reads intake, define-behavior, scenario-gate, plan-implementation, plan-execution, implement, verify, done',
  function (this: PlanWorld) {
    assert.deepEqual(this.phaseList, [
      'intake',
      'define-behavior',
      'scenario-gate',
      'plan-implementation',
      'plan-execution',
      'implement',
      'verify',
      'done',
    ]);
  },
);

Then('the task-count split checkpoint is keyed to plan-implementation', function (this: PlanWorld) {
  matchDocs(this.docs, /\*\*plan-implementation\*\*[^\n]*tasks/);
});

Then(
  'split children at plan-implementation or later restart at plan-implementation',
  function (this: PlanWorld) {
    matchDocs(this.docs, /plan-implementation\+[^\n]*`plan-implementation`/);
  },
);

Then(
  'PLAN_IMPLEMENTATION.md is registered for the Claude skill directory, the Codex skill directory, and a Cursor rule',
  function (this: PlanWorld) {
    assert.ok(
      this.schemaSource?.includes("'.claude/skills/bdd/PLAN_IMPLEMENTATION.md'"),
      'schema.ts must register the Claude skill copy',
    );
    assert.ok(
      existsSync(CODEX_BDD_PLAN_REFERENCE),
      'the Codex plugin must package the BDD planning reference',
    );
    assert.ok(
      this.cursorWrapperSource?.includes("'bdd-plan-implementation'"),
      'cursor-wrappers.ts must register the Cursor rule',
    );
  },
);

Then(
  'the Claude copy is byte-identical and the Cursor and Codex assets are registered',
  function (this: PlanWorld) {
    const template = readFileSync(
      nodePath.join(PROJECT_ROOT, 'packages/cli/templates/skills/bdd/PLAN_IMPLEMENTATION.md'),
      'utf8',
    );
    // Only `.claude/` is a byte-identical installed copy. The Codex surface is the
    // generated plugin, whose assets are transformed at generation and asserted to
    // derive from the template by codex-plugin-catalogue.release.test.ts; its
    // packaging is already checked by the `registered` step above. `.agents/skills/`
    // was retired in V5V4YP — the schema deletes those paths on upgrade.
    for (const installed of [
      nodePath.join(PROJECT_ROOT, '.claude/skills/bdd/PLAN_IMPLEMENTATION.md'),
    ]) {
      assert.equal(readFileSync(installed, 'utf8'), template, `${installed} drifted from template`);
    }
    assert.ok(
      existsSync(nodePath.join(PROJECT_ROOT, '.cursor/rules/bdd-plan-implementation.mdc')),
      'the Cursor rule wrapper must exist',
    );
  },
);

Then('an accepted ADR records the plan-implementation phase', function (this: PlanWorld) {
  const text = this.architectureRecord ?? '';
  const headingIndex = text.indexOf('### plan-implementation: a gated planning phase');
  assert.ok(headingIndex !== -1, 'ARCHITECTURE.md must record the plan-implementation ADR');
  const section = text.slice(headingIndex, headingIndex + 400);
  assert.match(section, /\*\*Status:\*\* Accepted/);
});

Then('the decomposition-retirement ADR is marked superseded by it', function (this: PlanWorld) {
  const text = this.architectureRecord ?? '';
  assert.match(text, /retire `decomposition` phase/);
  assert.match(text, /superseded by "plan-implementation: a gated planning phase"/);
});
