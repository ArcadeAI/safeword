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
import { execFileSync, execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { git } from './support/repo-fixtures.ts';
import type { SafewordWorld } from './world.js';

const PROJECT_ROOT = nodePath.resolve(import.meta.dirname, '..');
const PRE_TOOL_HOOK = nodePath.join(
  PROJECT_ROOT,
  'packages/cli/templates/hooks/pre-tool-quality.ts',
);
const STOP_HOOK = nodePath.join(PROJECT_ROOT, 'packages/cli/templates/hooks/stop-quality.ts');
const PROMPT_HOOK = nodePath.join(PROJECT_ROOT, 'packages/cli/templates/hooks/prompt-questions.ts');
const CLI = nodePath.join(PROJECT_ROOT, 'packages/cli/src/cli.ts');

/** Both shipped copies of every bdd skill document (template + dogfood). */
const BDD_SKILL_ROOTS = [
  nodePath.join(PROJECT_ROOT, 'packages/cli/templates/skills/bdd'),
  nodePath.join(PROJECT_ROOT, '.claude/skills/bdd'),
];

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
  stop?: { decision?: string; reason: string; exitCode: number };
  promptOutput?: string;
  cli?: { exitCode: number; output: string };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A shape-valid impl-plan (mirrors plan-transition-gate.test.ts VALID_PLAN). */
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
});

// ---------------------------------------------------------------------------
// Givens — ticket fixtures in a throwaway project
// ---------------------------------------------------------------------------

Given('a new-flow feature ticket at the plan-implementation phase', function (this: PlanWorld) {
  seedTicket(this, { phase: 'plan-implementation', spec: true });
});

Given('its impl-plan.md is valid with status planned', function (this: PlanWorld) {
  writeFileSync(ticketArtifact(this, 'impl-plan.md'), VALID_PLAN);
});

Given('no impl-plan.md exists in the ticket folder', function (this: PlanWorld) {
  assert.equal(existsSync(ticketArtifact(this, 'impl-plan.md')), false);
});

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

When(
  'the agent sets the ticket phase to {word}',
  SUBPROCESS,
  function (this: PlanWorld, targetPhase: string) {
    advancePhase(this, targetPhase);
  },
);

When('the plan is validated at a phase gate', SUBPROCESS, function (this: PlanWorld) {
  // The implement-entry transition gate is the phase gate that parses the plan.
  advancePhase(this, 'implement');
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
    const hits = execSync(`grep -rlF "${phrase}" ${root} 2>/dev/null || true`, {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    }).trim();
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

Then('the denial names plan-implementation as the skipped phase', function (this: PlanWorld) {
  const text = this.verdict?.text ?? '';
  assert.match(text, /plan-implementation/);
  assert.match(text, /skip|justification/i);
});

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
      /`plan-implementation`[^\n]*Continue the implementation plan \(PLAN_IMPLEMENTATION\.md\)/,
      /`plan-implementation`\s*\|\s*PLAN_IMPLEMENTATION\.md/,
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
      'Arch alignment',
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
    matchDocs(this.docs, /structure, key quality attributes/i, /difficult to reverse/i);
  },
);

Then(
  "it directs recording routine choices in the plan's decisions table alone",
  function (this: PlanWorld) {
    matchDocs(this.docs, /Decisions table/i);
  },
);

Then('it directs scaffolding new ADRs from the safeword ADR template', function (this: PlanWorld) {
  eachDoc(this.docs, (text, path) => {
    assert.ok(text.includes('adr-template.md'), path);
  });
});

Then(
  'it directs writing them to the location resolved from paths.architecture, appending to a file or adding a date-prefixed file to a directory',
  function (this: PlanWorld) {
    matchDocs(this.docs, /paths\.architecture/, /date-prefixed/i);
  },
);

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
  "it directs enumerating which configured documentation sources the feature's customer-visible changes touch, as build-order tasks or an explicit skip with a reason",
  function (this: PlanWorld) {
    matchDocs(
      this.docs,
      /Doc impact/,
      /docs\.sources/,
      /customer-visible/i,
      /build order/i,
      /skip/i,
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
  'it directs storing impl-plan.md and qualifying ADRs, routing deeper design to the existing design-doc lane rather than novel artifact kinds',
  function (this: PlanWorld) {
    matchDocs(this.docs, /design-doc/i, /no (new|novel) artifact kinds|novel artifact/i);
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
  'it routes component and data-model design to the design-doc template and the data-architecture guide rather than new plan sections',
  function (this: PlanWorld) {
    eachDoc(this.docs, (text, path) => {
      assert.ok(text.includes('design-doc-template.md'), path);
      assert.match(text, /data-architecture-guide/i, path);
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
  'it states the reviewed plan advances to implement without human approval when designApprovalGate is absent or off',
  function (this: PlanWorld) {
    eachDoc(this.docs, (text, path) => {
      assert.ok(text.includes('designApprovalGate'), path);
      assert.match(text, /absent or off/i, path);
      assert.match(text, /advances autonomously|without human approval/i, path);
    });
  },
);

Then(
  'it states that with designApprovalGate enabled the reviewed plan is presented for user approval before implement',
  function (this: PlanWorld) {
    eachDoc(this.docs, (text, path) => {
      assert.ok(text.includes('designApprovalGate'), path);
      assert.match(text, /user approval/i, path);
      assert.match(text, /before `?implement`?/i, path);
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
  'it reads intake, define-behavior, scenario-gate, plan-implementation, implement, verify, done',
  function (this: PlanWorld) {
    assert.deepEqual(this.phaseList, [
      'intake',
      'define-behavior',
      'scenario-gate',
      'plan-implementation',
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
      this.schemaSource?.includes(
        "['bdd/PLAN_IMPLEMENTATION.md', 'skills/bdd/PLAN_IMPLEMENTATION.md']",
      ),
      'schema.ts must register the Codex skill copy',
    );
    assert.ok(
      this.cursorWrapperSource?.includes("'bdd-plan-implementation'"),
      'cursor-wrappers.ts must register the Cursor rule',
    );
  },
);

Then('each installed copy is byte-identical to its template', function (this: PlanWorld) {
  const template = readFileSync(
    nodePath.join(PROJECT_ROOT, 'packages/cli/templates/skills/bdd/PLAN_IMPLEMENTATION.md'),
    'utf8',
  );
  for (const installed of [
    nodePath.join(PROJECT_ROOT, '.claude/skills/bdd/PLAN_IMPLEMENTATION.md'),
    nodePath.join(PROJECT_ROOT, '.agents/skills/bdd/PLAN_IMPLEMENTATION.md'),
  ]) {
    assert.equal(readFileSync(installed, 'utf8'), template, `${installed} drifted from template`);
  }
  assert.ok(
    existsSync(nodePath.join(PROJECT_ROOT, '.cursor/rules/bdd-plan-implementation.mdc')),
    'the Cursor rule wrapper must exist',
  );
});

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
