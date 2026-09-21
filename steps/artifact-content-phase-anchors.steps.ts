/**
 * Acceptance steps for artifact-content phase anchors (HGYGND; supersedes the
 * evidence-anchored-phase-transitions steps).
 *
 * Two lanes. Predicate lane: like phase-provenance.steps.ts, shells out to bun
 * (`bun -e`) to run the REAL template lib and assert its verdict — the tree is
 * an in-memory map reconstructed into an ArtifactReader inside the runner (a
 * function can't cross the process boundary), or the bare filesystem for the
 * no-git scenario. Command lane: real temp git repos (squash-merge, amend,
 * shallow clone, staged-tree) driving `bun packages/cli/src/cli.ts boundary`,
 * asserting on output and the audit record.
 */

import { strict as assert } from 'node:assert';
import { execFileSync, execSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, unlinkSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';

import { Given, Then, When } from '@cucumber/cucumber';

import { WORKSPACE_ROOTS } from '../packages/cli/src/utils/workspace-roots.ts';
import { git, readAuditEntries, writeFileAt } from './support/repo-fixtures.ts';
import type { SafewordWorld } from './world.js';

const PROJECT_ROOT = nodePath.resolve(import.meta.dirname, '..');
const CLI = nodePath.join(PROJECT_ROOT, 'packages/cli/src/cli.ts');
const LIB_URL = pathToFileURL(
  nodePath.join(PROJECT_ROOT, 'packages/cli/templates/hooks/lib/phase-provenance.ts'),
).href;

const SHA = 'a1b2c3d';
const TICKET_DIR = '.project/tickets/ACA001-fixture';
const IMPL_PLAN = `${TICKET_DIR}/impl-plan.md`;
const EXECUTION_PLAN = `${TICKET_DIR}/execution-plan.md`;
const SPEC = `${TICKET_DIR}/spec.md`;
const LEDGER = `${TICKET_DIR}/test-definitions.md`;
const VERIFY = `${TICKET_DIR}/verify.md`;
const FEATURE_SRC = 'features/fixture.feature';
const GONE = `${TICKET_DIR}/gone/execution-plan.md`;

const SHAPE_VALID_EXECUTION_PLAN = '# Execution Plan\n\nBuild the fixture.\n';

const SHAPE_VALID_SPEC = [
  '# Spec: fixture',
  '',
  '## Jobs To Be Done',
  '',
  '### fixture.SWM1 — Keep phase evidence trustworthy',
  '',
  '**Persona:** Safeword Maintainer (SWM)',
  '',
  '> When a phase advances, I want its output recorded, so the boundary can verify it.',
  '',
].join('\n');

const SHAPE_VALID_IMPL_PLAN = [
  '# Impl Plan: fixture',
  '',
  '**Status:** planned',
  '',
  '## Approach',
  '',
  'Swap the grammar in place.',
  '',
  '## Decisions',
  '',
  'skip: fixture plan',
  '',
  '## Arch alignment',
  '',
  'skip: fixture plan',
  '',
  '## Known deviations',
  '',
  'skip: fixture plan',
  '',
  '## Assessment triggers',
  '',
  'skip: fixture plan',
  '',
].join('\n');

const HOLLOW_IMPL_PLAN = [
  '# Impl Plan: fixture',
  '',
  '**Status:** planned',
  '',
  '## Approach',
  '',
  '## Decisions',
  '',
  '## Arch alignment',
  '',
  '## Known deviations',
  '',
  '## Assessment triggers',
  '',
].join('\n');

const FEATURE_CONTENT = 'Feature: fixture\n\n  Scenario: something happens\n    Then ok\n';
const LEDGER_CONTENT = [
  '# Test Definitions',
  '',
  '### Scenario: s1',
  '',
  '- [ ] RED',
  '- [ ] GREEN',
  '- [ ] REFACTOR',
  '',
].join('\n');
const VERIFY_CONTENT = '# Verify\n\n**PR Scope:** ✅ in scope\n';

interface AnchorVerdict {
  kind: 'not-applicable' | 'anchored' | 'unanchored';
  reason?: string;
}

interface AnchorWorld extends SafewordWorld {
  priorType?: string | null;
  priorPhase?: string | null;
  priorAnchors?: string[];
  tree?: Record<string, string>;
  anchorArtifact?: { path: string; content: string };
  fsDir?: string;
  verdict?: AnchorVerdict;
  dir?: string;
  remote?: string;
  cli?: { exitCode: number; output: string };
}

function ticketContent(
  type: string | null,
  phase: string | null,
  anchors?: string[],
  skips?: string[],
): string {
  const lines = ['---', 'id: ACA001', 'slug: fixture'];
  if (type !== null) lines.push(`type: ${type}`);
  if (phase !== null) lines.push(`phase: ${phase}`);
  lines.push('status: in_progress');
  if (anchors !== undefined && anchors.length > 0) {
    lines.push('phase_anchors:');
    for (const entry of anchors) lines.push(`  - ${entry}`);
  }
  if (skips !== undefined) {
    lines.push('phase_skips:');
    for (const entry of skips) lines.push(`  - ${entry}`);
  }
  lines.push('---', '', '# Fixture', '');
  return lines.join('\n');
}

// Runs the real detector under bun, where the lib's `.js` imports resolve.
// `tree` (a path→content map) is reconstructed into an ArtifactReader inside
// the runner; `tree: 'fs'` reads the filesystem relative to cwd (the no-git
// scenario); `tree: null` passes no reader (format-only).
const RUNNER = `
const { detectUnanchoredPhaseTransition, detectUnanchoredPhaseState } = await import(${JSON.stringify(LIB_URL)});
const { prior, proposed, tree, mode } = JSON.parse(await new Response(Bun.stdin).text());
const { readFileSync } = await import('node:fs');
const scope = {
  ticketPath: ${JSON.stringify(TICKET_DIR)},
  featureRoots: ['features'],
  workspaceRoots: ${JSON.stringify(WORKSPACE_ROOTS)},
};
const read = tree === null ? undefined
  : tree === 'fs' ? (p) => { try { return readFileSync(p, 'utf8'); } catch { return undefined; } }
  : (p) => (Object.hasOwn(tree, p) ? tree[p] : undefined);
const verdict = mode === 'state'
  ? detectUnanchoredPhaseState(proposed, scope, read)
  : detectUnanchoredPhaseTransition(prior, proposed, scope, read);
console.log(JSON.stringify(verdict));
`;

function runDetector(
  world: AnchorWorld,
  proposed: string,
  mode: 'transition' | 'state' = 'transition',
): AnchorVerdict {
  const prior = ticketContent(
    world.priorType ?? null,
    world.priorPhase ?? null,
    world.priorAnchors,
  );
  const tree = world.fsDir !== undefined ? 'fs' : (world.tree ?? {});
  const stdout = execFileSync('bun', ['-e', RUNNER], {
    cwd: world.fsDir ?? PROJECT_ROOT,
    input: JSON.stringify({ prior, proposed, tree, mode }),
    encoding: 'utf8',
  });
  return JSON.parse(stdout.trim()) as AnchorVerdict;
}

function advance(
  world: AnchorWorld,
  options: { type?: string | null; phase: string; anchors?: string[] },
): void {
  const proposedType = options.type === undefined ? (world.priorType ?? null) : options.type;
  const anchors = [...(world.priorAnchors ?? []), ...(options.anchors ?? [])];
  world.verdict = runDetector(world, ticketContent(proposedType, options.phase, anchors));
}

// ---------------------------------------------------------------------------
// Predicate lane — Givens
// ---------------------------------------------------------------------------

Given(
  'a {word} ticket at phase {word}( with no anchors recorded)',
  function (this: AnchorWorld, kind: string, phase: string) {
    this.priorType = kind === 'none' ? null : kind;
    this.priorPhase = phase;
    this.tree = {};
  },
);

Given(
  'a feature ticket at phase {word} whose execution-plan artifact exists and is shape-valid',
  function (this: AnchorWorld, phase: string) {
    this.priorType = 'feature';
    this.priorPhase = phase;
    this.tree = { [EXECUTION_PLAN]: SHAPE_VALID_EXECUTION_PLAN };
  },
);

Given(
  'a feature ticket at phase plan-execution whose execution-plan is shape-valid and whose earlier define-behavior anchor path is absent',
  function (this: AnchorWorld) {
    this.priorType = 'feature';
    this.priorPhase = 'plan-execution';
    this.priorAnchors = ['define-behavior: features/removed.feature'];
    this.tree = { [EXECUTION_PLAN]: SHAPE_VALID_EXECUTION_PLAN };
  },
);

Given(
  'a feature ticket at phase {word} whose {word} anchor artifact exists and is shape-valid',
  function (this: AnchorWorld, phase: string, artifact: string) {
    const artifacts: Record<string, { path: string; content: string }> = {
      spec: { path: SPEC, content: SHAPE_VALID_SPEC },
      'feature-source': { path: FEATURE_SRC, content: FEATURE_CONTENT },
      'impl-plan': { path: IMPL_PLAN, content: SHAPE_VALID_IMPL_PLAN },
      'execution-plan': { path: EXECUTION_PLAN, content: SHAPE_VALID_EXECUTION_PLAN },
      ledger: { path: LEDGER, content: LEDGER_CONTENT },
      verify: { path: VERIFY, content: VERIFY_CONTENT },
    };
    const selected = artifacts[artifact];
    assert.ok(selected, `unknown anchor artifact ${artifact}`);
    this.priorType = 'feature';
    this.priorPhase = phase;
    this.anchorArtifact = selected;
    this.tree = { [selected.path]: selected.content };
  },
);

Given(
  'a feature ticket at phase define-behavior whose feature source exists with scenario content',
  function (this: AnchorWorld) {
    this.priorType = 'feature';
    this.priorPhase = 'define-behavior';
    this.tree = { [FEATURE_SRC]: FEATURE_CONTENT };
  },
);

Given(
  'a feature ticket at phase define-behavior whose legacy test-definitions file exists with scenario content',
  function (this: AnchorWorld) {
    this.priorType = 'feature';
    this.priorPhase = 'define-behavior';
    this.tree = { [LEDGER]: LEDGER_CONTENT };
  },
);

Given(
  'a feature ticket that entered implement once, whose earlier implement anchor names a path absent from the tree',
  function (this: AnchorWorld) {
    this.priorType = 'feature';
    this.priorPhase = 'plan-execution';
    this.priorAnchors = [`implement: ${GONE}`];
    this.tree = { [EXECUTION_PLAN]: SHAPE_VALID_EXECUTION_PLAN };
  },
);

Given(
  'a feature ticket whose earlier implement anchor names its existing shape-valid execution-plan',
  function (this: AnchorWorld) {
    this.priorType = 'feature';
    this.priorPhase = 'plan-execution';
    this.priorAnchors = [`implement: ${EXECUTION_PLAN}`];
    this.tree = { [EXECUTION_PLAN]: SHAPE_VALID_EXECUTION_PLAN };
  },
);

Given(
  'a feature ticket in a working directory with no git repository at all, whose anchored artifact is readable in the tree',
  function (this: AnchorWorld) {
    const dir = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-anchor-nogit-'));
    const full = nodePath.join(dir, EXECUTION_PLAN);
    mkdirSync(nodePath.dirname(full), { recursive: true });
    writeFileSync(full, SHAPE_VALID_EXECUTION_PLAN);
    this.fsDir = dir;
    this.priorType = 'feature';
    this.priorPhase = 'plan-execution';
  },
);

Given(
  'a feature ticket at phase plan-execution whose anchored path does not exist in the tree',
  function (this: AnchorWorld) {
    this.priorType = 'feature';
    this.priorPhase = 'plan-execution';
    this.tree = {};
  },
);

Given(
  'a feature ticket at phase plan-implementation whose impl-plan artifact exists but fails its shape check',
  function (this: AnchorWorld) {
    this.priorType = 'feature';
    this.priorPhase = 'plan-implementation';
    this.tree = { [IMPL_PLAN]: HOLLOW_IMPL_PLAN };
  },
);

Given(
  'a feature ticket at phase verify with an existing README file in the tree',
  function (this: AnchorWorld) {
    this.priorType = 'feature';
    this.priorPhase = 'verify';
    this.tree = { 'README.md': '# Fixture readme\n' };
  },
);

Given(
  'a feature ticket at rest at phase implement with no phase_anchors entry for implement',
  function (this: AnchorWorld) {
    this.priorType = 'feature';
    this.priorPhase = 'implement';
    this.tree = {};
  },
);

Given(
  'a feature ticket at rest at phase implement whose implement anchor is a hex-shaped commit SHA',
  function (this: AnchorWorld) {
    this.priorType = 'feature';
    this.priorPhase = 'implement';
    this.priorAnchors = [`implement: ${SHA}`];
    this.tree = {};
  },
);

// ---------------------------------------------------------------------------
// Predicate lane — Whens
// ---------------------------------------------------------------------------

When(
  "it advances to implement recording that artifact's path for implement",
  function (this: AnchorWorld) {
    advance(this, { phase: 'implement', anchors: [`implement: ${EXECUTION_PLAN}`] });
  },
);

When(
  'it advances four steps to implement recording that execution-plan path for implement only',
  function (this: AnchorWorld) {
    advance(this, { phase: 'implement', anchors: [`implement: ${EXECUTION_PLAN}`] });
  },
);

When(
  'it advances to {word} recording that artifact path for {word}',
  function (this: AnchorWorld, phase: string, anchorPhase: string) {
    assert.equal(anchorPhase, phase);
    assert.ok(this.anchorArtifact, 'anchor artifact fixture was not initialized');
    advance(this, {
      phase,
      anchors: [`${anchorPhase}: ${this.anchorArtifact.path}`],
    });
  },
);

When(
  'it advances to scenario-gate recording that feature source path for scenario-gate',
  function (this: AnchorWorld) {
    advance(this, { phase: 'scenario-gate', anchors: [`scenario-gate: ${FEATURE_SRC}`] });
  },
);

When(
  'it advances to scenario-gate recording that legacy test-definitions file path for scenario-gate',
  function (this: AnchorWorld) {
    advance(this, { phase: 'scenario-gate', anchors: [`scenario-gate: ${LEDGER}`] });
  },
);

When(
  'it re-enters implement appending an anchor naming its existing shape-valid execution-plan',
  function (this: AnchorWorld) {
    advance(this, { phase: 'implement', anchors: [`implement: ${EXECUTION_PLAN}`] });
  },
);

When(
  'it re-enters implement appending an implement anchor whose path is absent from the tree',
  function (this: AnchorWorld) {
    advance(this, { phase: 'implement', anchors: [`implement: ${GONE}`] });
  },
);

When('the advance is checked', function (this: AnchorWorld) {
  advance(this, { phase: 'implement', anchors: [`implement: ${EXECUTION_PLAN}`] });
});

When(
  'it advances to {word} with no phase_anchors block recorded',
  function (this: AnchorWorld, phase: string) {
    advance(this, { phase });
  },
);

When(
  'it advances to implement with a phase_anchors block naming only plan-execution',
  function (this: AnchorWorld) {
    this.tree = { ...this.tree, [FEATURE_SRC]: FEATURE_CONTENT };
    advance(this, { phase: 'implement', anchors: [`plan-execution: ${IMPL_PLAN}`] });
  },
);

When(
  'it advances to {word} recording an empty anchor value for {word}',
  function (this: AnchorWorld, phase: string, anchorPhase: string) {
    advance(this, { phase, anchors: [`${anchorPhase}:`] });
  },
);

When(
  'it advances to implement recording {string} as the anchor for implement',
  function (this: AnchorWorld, value: string) {
    advance(this, { phase: 'implement', anchors: [`implement: ${value}`] });
  },
);

When('it advances to implement recording that path for implement', function (this: AnchorWorld) {
  advance(this, { phase: 'implement', anchors: [`implement: ${EXECUTION_PLAN}`] });
});

When(
  "it advances to plan-execution recording that artifact's path for plan-execution",
  function (this: AnchorWorld) {
    advance(this, { phase: 'plan-execution', anchors: [`plan-execution: ${IMPL_PLAN}`] });
  },
);

When(
  'it advances to done recording the README path as the anchor for done',
  function (this: AnchorWorld) {
    advance(this, { phase: 'done', anchors: ['done: README.md'] });
  },
);

When(
  'it advances to implement recording a hex-shaped commit SHA as the anchor for implement',
  function (this: AnchorWorld) {
    advance(this, { phase: 'implement', anchors: [`implement: ${SHA}`] });
  },
);

When('it moves back to {word} with no anchor', function (this: AnchorWorld, phase: string) {
  advance(this, { phase });
});

When(
  'it is re-saved at phase {word} with no new anchor',
  function (this: AnchorWorld, phase: string) {
    advance(this, { phase });
  },
);

When('it advances to {word} with no anchor', function (this: AnchorWorld, phase: string) {
  advance(this, { phase });
});

When('its type is changed to feature without changing the phase', function (this: AnchorWorld) {
  advance(this, { type: 'feature', phase: this.priorPhase ?? 'implement' });
});

When('its body is edited without changing the phase', function (this: AnchorWorld) {
  const prior = ticketContent(this.priorType ?? null, this.priorPhase ?? null, this.priorAnchors);
  this.verdict = runDetector(this, `${prior}\nan extra body line\n`);
});

When('the at-rest anchor advisory inspects it', function (this: AnchorWorld) {
  const content = ticketContent(this.priorType ?? null, this.priorPhase ?? null, this.priorAnchors);
  this.verdict = runDetector(this, content, 'state');
});

When('safeword check runs on the project', function (this: AnchorWorld) {
  const result = spawnSync('bun', [CLI, 'check', '--agents', 'none', '--offline'], {
    cwd: this.dir,
    encoding: 'utf8',
  });
  this.cli = {
    exitCode: result.status ?? 1,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim(),
  };
});

// ---------------------------------------------------------------------------
// Predicate lane — Thens
// ---------------------------------------------------------------------------

Then('the advance is recognized as anchored', function (this: AnchorWorld) {
  assert.equal(
    this.verdict?.kind,
    'anchored',
    `expected anchored; got ${JSON.stringify(this.verdict)}`,
  );
});

Then('the advance is flagged as unanchored', function (this: AnchorWorld) {
  assert.equal(
    this.verdict?.kind,
    'unanchored',
    `expected unanchored; got ${JSON.stringify(this.verdict)}`,
  );
});

Then('the advance is not flagged', function (this: AnchorWorld) {
  assert.equal(
    this.verdict?.kind,
    'not-applicable',
    `expected not-applicable; got ${JSON.stringify(this.verdict)}`,
  );
});

Then('the transition check raises no anchor finding', function (this: AnchorWorld) {
  assert.equal(
    this.verdict?.kind,
    'not-applicable',
    `expected transition check to be not-applicable; got ${JSON.stringify(this.verdict)}`,
  );
});

Then('the finding names the expected anchor line for implement', function (this: AnchorWorld) {
  assert.match(this.verdict?.reason ?? '', /- implement:/);
  assert.match(this.verdict?.reason ?? '', /execution-plan\.md/);
});

Then('the finding says the artifact is missing from the tree', function (this: AnchorWorld) {
  assert.match(this.verdict?.reason ?? '', /missing/i);
});

Then('the finding says the artifact fails its shape check', function (this: AnchorWorld) {
  assert.match(this.verdict?.reason ?? '', /shape/i);
});

Then(
  'the finding says the artifact is not the expected kind for done',
  function (this: AnchorWorld) {
    assert.match(this.verdict?.reason ?? '', /expected/i);
    assert.match(this.verdict?.reason ?? '', /verify\.md/);
  },
);

Then(
  'the finding says the artifact is not the expected kind for implement',
  function (this: AnchorWorld) {
    assert.match(this.verdict?.reason ?? '', /expected/i);
    assert.match(this.verdict?.reason ?? '', /execution-plan\.md/);
  },
);

Then('the finding identifies the legacy commit SHA migration', function (this: AnchorWorld) {
  assert.match(this.verdict?.reason ?? '', /legacy commit-SHA anchor/i);
  assert.match(this.verdict?.reason ?? '', /artifact path instead/i);
});

Then('no anchor finding is raised', function (this: AnchorWorld) {
  assert.equal(
    this.verdict?.kind,
    'not-applicable',
    `expected not-applicable; got ${JSON.stringify(this.verdict)}`,
  );
});

// ---------------------------------------------------------------------------
// Command lane — real repos, real CLI
// ---------------------------------------------------------------------------

function createProject(world: AnchorWorld): string {
  const dir = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-anchor-cli-'));
  git(dir, 'init --quiet');
  git(dir, 'config user.email test@test.com');
  git(dir, 'config user.name Test');
  mkdirSync(nodePath.join(dir, '.safeword'), { recursive: true });
  writeFileAt(dir, 'README.md', 'fixture\n');
  world.dir = dir;
  return dir;
}

function addPushedBaseline(world: AnchorWorld): void {
  const remote = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-anchor-remote-'));
  execSync('git init --bare --quiet', { cwd: remote, stdio: 'pipe' });
  git(world.dir!, 'add -A');
  git(world.dir!, 'commit -m baseline --quiet');
  git(world.dir!, `remote add origin ${remote}`);
  git(world.dir!, 'push -u origin HEAD --quiet');
  world.remote = remote;
}

function runBoundary(world: AnchorWorld, at: 'commit' | 'push'): void {
  const result = spawnSync('bun', [CLI, 'boundary', '--at', at], {
    cwd: world.dir,
    encoding: 'utf8',
  });
  world.cli = { exitCode: result.status ?? 1, output: `${result.stdout}\n${result.stderr}`.trim() };
}

function lastAuditEntry(dir: string): string {
  const entry = readAuditEntries(dir).at(-1);
  return entry === undefined ? '' : JSON.stringify(entry);
}

function createCommittedAnchoredAdvance(world: AnchorWorld): { dir: string; branch: string } {
  const dir = createProject(world);
  writeFileAt(dir, `${TICKET_DIR}/ticket.md`, ticketContent('feature', 'plan-execution'));
  addPushedBaseline(world);
  const branch = git(dir, 'branch --show-current').trim();
  writeFileAt(dir, EXECUTION_PLAN, SHAPE_VALID_EXECUTION_PLAN);
  writeFileAt(
    dir,
    `${TICKET_DIR}/ticket.md`,
    ticketContent('feature', 'implement', [`implement: ${EXECUTION_PLAN}`]),
  );
  git(dir, 'add -A');
  git(dir, 'commit -m advance --quiet');
  return { dir, branch };
}

function seedTicket(world: AnchorWorld, ticketPath: string, phase: string): string {
  const dir = createProject(world);
  writeFileAt(dir, `${ticketPath}/ticket.md`, ticketContent('feature', phase));
  git(dir, 'add -A');
  git(dir, 'commit -m seed --quiet');
  return dir;
}

Given(
  "a staged advance anchored to another ticket's shape-valid execution-plan",
  function (this: AnchorWorld) {
    const foreignTicket = '.project/tickets/ACA002-foreign';
    const foreignPlan = `${foreignTicket}/execution-plan.md`;
    const dir = seedTicket(this, TICKET_DIR, 'plan-execution');
    writeFileAt(dir, foreignPlan, SHAPE_VALID_EXECUTION_PLAN);
    writeFileAt(
      dir,
      `${TICKET_DIR}/ticket.md`,
      ticketContent('feature', 'implement', [`implement: ${foreignPlan}`]),
    );
    git(dir, 'add -A');
  },
);

Given("a staged advance anchored to another ticket's feature source", function (this: AnchorWorld) {
  const foreignFeature = 'features/another-ticket.feature';
  const dir = seedTicket(this, TICKET_DIR, 'define-behavior');
  writeFileAt(dir, foreignFeature, FEATURE_CONTENT);
  writeFileAt(
    dir,
    `${TICKET_DIR}/ticket.md`,
    ticketContent('feature', 'scenario-gate', [`scenario-gate: ${foreignFeature}`]),
  );
  git(dir, 'add -A');
});

Given(
  'a staged project configuring a non-default feature lane and an advance anchored to a feature source inside it',
  function (this: AnchorWorld) {
    const configuredFeature = 'tests/behaviors/fixture.feature';
    const dir = createProject(this);
    writeFileAt(
      dir,
      '.safeword/config.json',
      JSON.stringify({ paths: { features: 'tests/behaviors' } }, undefined, 2),
    );
    writeFileAt(dir, `${TICKET_DIR}/ticket.md`, ticketContent('feature', 'define-behavior'));
    git(dir, 'add -A');
    git(dir, 'commit -m seed --quiet');
    writeFileAt(dir, configuredFeature, FEATURE_CONTENT);
    writeFileAt(
      dir,
      `${TICKET_DIR}/ticket.md`,
      ticketContent('feature', 'scenario-gate', [`scenario-gate: ${configuredFeature}`]),
    );
    git(dir, 'add -A');
  },
);

Given('a staged advance whose anchor uses a Git index-stage prefix', function (this: AnchorWorld) {
  const stagedAlias = `0:${EXECUTION_PLAN}`;
  const dir = seedTicket(this, TICKET_DIR, 'plan-execution');
  writeFileAt(dir, EXECUTION_PLAN, SHAPE_VALID_EXECUTION_PLAN);
  writeFileAt(
    dir,
    `${TICKET_DIR}/ticket.md`,
    ticketContent('feature', 'implement', [`implement: ${stagedAlias}`]),
  );
  git(dir, 'add -A');
});

Given(
  'a staged owned feature source that is then removed from the worktree',
  function (this: AnchorWorld) {
    const dir = seedTicket(this, TICKET_DIR, 'define-behavior');
    writeFileAt(dir, FEATURE_SRC, FEATURE_CONTENT);
    writeFileAt(
      dir,
      `${TICKET_DIR}/ticket.md`,
      ticketContent('feature', 'scenario-gate', [`scenario-gate: ${FEATURE_SRC}`]),
    );
    git(dir, 'add -A');
    unlinkSync(nodePath.join(dir, FEATURE_SRC));
  },
);

Given(
  'a Safeword project with a feature ticket at rest at phase implement and no implement anchor',
  function (this: AnchorWorld) {
    const dir = createProject(this);
    const setup = spawnSync('bun', [CLI, 'setup', '--yes', '--agents', 'none'], {
      cwd: dir,
      encoding: 'utf8',
    });
    assert.equal(setup.status, 0, `${setup.stdout ?? ''}\n${setup.stderr ?? ''}`.trim());
    writeFileAt(dir, `${TICKET_DIR}/ticket.md`, ticketContent('feature', 'implement'));
  },
);

Given(
  'a staged advance anchored to a correctly named feature inside its ticket directory but outside every feature lane',
  function (this: AnchorWorld) {
    const lookalike = `${TICKET_DIR}/fixture.feature`;
    const dir = seedTicket(this, TICKET_DIR, 'define-behavior');
    writeFileAt(dir, lookalike, FEATURE_CONTENT);
    writeFileAt(
      dir,
      `${TICKET_DIR}/ticket.md`,
      ticketContent('feature', 'scenario-gate', [`scenario-gate: ${lookalike}`]),
    );
    git(dir, 'add -A');
  },
);

function stageConfiguredTicket(
  world: AnchorWorld,
  configuredProjectRoot: string,
  ticketRoot = 'custom',
): void {
  const ticketPath = `${ticketRoot}/tickets/ACA001-fixture`;
  const defaultTicketPath = '.project/tickets/ACA001-fixture';
  const defaultPlanPath = `${defaultTicketPath}/impl-plan.md`;
  const dir = createProject(world);
  writeFileAt(dir, `${ticketPath}/ticket.md`, ticketContent('feature', 'plan-implementation'));
  writeFileAt(
    dir,
    `${defaultTicketPath}/ticket.md`,
    ticketContent('feature', 'plan-implementation'),
  );
  git(dir, 'add -A');
  git(dir, 'commit -m seed --quiet');
  writeFileAt(
    dir,
    '.safeword/config.json',
    JSON.stringify({ paths: { projectRoot: configuredProjectRoot } }, undefined, 2),
  );
  writeFileAt(dir, defaultPlanPath, SHAPE_VALID_IMPL_PLAN);
  writeFileAt(
    dir,
    `${ticketPath}/ticket.md`,
    ticketContent('feature', 'plan-execution', [`plan-execution: ${defaultPlanPath}`]),
  );
  writeFileAt(
    dir,
    `${defaultTicketPath}/ticket.md`,
    ticketContent('feature', 'plan-execution', [`plan-execution: ${defaultPlanPath}`]),
  );
  git(dir, 'add -A');
}

Given(
  'a project-root configuration staged for a custom root while its worktree copy points at the default root',
  function (this: AnchorWorld) {
    stageConfiguredTicket(this, 'custom');
    writeFileAt(
      this.dir!,
      '.safeword/config.json',
      JSON.stringify({ paths: { projectRoot: '.project' } }, undefined, 2),
    );
  },
);

Given(
  'a staged project root containing dot and duplicate separator segments',
  function (this: AnchorWorld) {
    stageConfiguredTicket(this, 'shadow/../custom//');
  },
);

Given(
  'staged repository-root ticket and feature lanes with an anchor owned by another ticket',
  function (this: AnchorWorld) {
    const rootTicket = 'tickets/ACA001-fixture';
    const foreignFeature = 'another-ticket.feature';
    const dir = createProject(this);
    writeFileAt(
      dir,
      '.safeword/config.json',
      JSON.stringify({ paths: { projectRoot: '.', features: '.' } }, undefined, 2),
    );
    writeFileAt(dir, `${rootTicket}/ticket.md`, ticketContent('feature', 'define-behavior'));
    git(dir, 'add -A');
    git(dir, 'commit -m seed --quiet');
    writeFileAt(dir, foreignFeature, FEATURE_CONTENT);
    writeFileAt(
      dir,
      `${rootTicket}/ticket.md`,
      ticketContent('feature', 'scenario-gate', [`scenario-gate: ${foreignFeature}`]),
    );
    git(dir, 'add -A');
  },
);

Given('a staged project-root configuration outside the repository', function (this: AnchorWorld) {
  const dir = createProject(this);
  writeFileAt(
    dir,
    '.safeword/config.json',
    JSON.stringify({ paths: { projectRoot: '../outside' } }, undefined, 2),
  );
  git(dir, 'add -A');
});

Given(
  'a project whose ticket advanced phases across several commits — an earlier phase anchored by a legacy hex SHA — that were then squash-merged into one',
  function (this: AnchorWorld) {
    const dir = createProject(this);
    writeFileAt(dir, `${TICKET_DIR}/ticket.md`, ticketContent('feature', 'scenario-gate'));
    addPushedBaseline(this);
    const legacyHex = git(dir, 'rev-parse --short HEAD').trim();
    writeFileAt(dir, FEATURE_SRC, FEATURE_CONTENT);
    writeFileAt(dir, IMPL_PLAN, SHAPE_VALID_IMPL_PLAN);
    writeFileAt(
      dir,
      `${TICKET_DIR}/ticket.md`,
      ticketContent('feature', 'plan-execution', [
        `define-behavior: ${legacyHex}`,
        `scenario-gate: ${FEATURE_SRC}`,
        `plan-implementation: ${FEATURE_SRC}`,
        `plan-execution: ${IMPL_PLAN}`,
      ]),
    );
    git(dir, 'add -A');
    git(dir, 'commit -m c1 --quiet');
    writeFileAt(dir, EXECUTION_PLAN, SHAPE_VALID_EXECUTION_PLAN);
    writeFileAt(
      dir,
      `${TICKET_DIR}/ticket.md`,
      ticketContent('feature', 'implement', [
        `define-behavior: ${legacyHex}`,
        `scenario-gate: ${FEATURE_SRC}`,
        `plan-implementation: ${FEATURE_SRC}`,
        `plan-execution: ${IMPL_PLAN}`,
        `implement: ${EXECUTION_PLAN}`,
      ]),
    );
    git(dir, 'add -A');
    git(dir, 'commit -m c2 --quiet');
    git(dir, 'reset --soft @{u}');
    git(dir, 'commit -m squashed --quiet');
    git(dir, 'push origin HEAD --quiet');
    this.priorAnchors = [
      `define-behavior: ${legacyHex}`,
      `scenario-gate: ${FEATURE_SRC}`,
      `plan-implementation: ${FEATURE_SRC}`,
      `plan-execution: ${IMPL_PLAN}`,
      `implement: ${EXECUTION_PLAN}`,
    ];
  },
);

When(
  'a further advance recording a path anchor for its entered phase reaches the push boundary',
  function (this: AnchorWorld) {
    const dir = this.dir!;
    writeFileAt(dir, LEDGER, LEDGER_CONTENT);
    writeFileAt(
      dir,
      `${TICKET_DIR}/ticket.md`,
      ticketContent('feature', 'verify', [...(this.priorAnchors ?? []), `verify: ${LEDGER}`]),
    );
    git(dir, 'add -A');
    git(dir, 'commit -m further-advance --quiet');
    runBoundary(this, 'push');
  },
);

Given(
  'a project whose ticket recorded a path anchor in a commit that was then amended',
  function (this: AnchorWorld) {
    const { dir } = createCommittedAnchoredAdvance(this);
    git(dir, 'commit --amend --quiet -m amended-advance');
  },
);

Given(
  'a project whose ticket recorded a path anchor in a commit that was then rebased',
  function (this: AnchorWorld) {
    const { branch, dir } = createCommittedAnchoredAdvance(this);
    git(dir, 'checkout --quiet -b rewritten-base @{u}');
    writeFileAt(dir, 'README.md', '# rewritten base\n');
    git(dir, 'add README.md');
    git(dir, 'commit -m upstream-base --quiet');
    git(dir, `checkout --quiet ${branch}`);
    git(dir, 'rebase rewritten-base --quiet');
  },
);

Given(
  'a shallow single-depth clone of a project with an anchored feature ticket in the outgoing range',
  function (this: AnchorWorld) {
    const dir = createProject(this);
    writeFileAt(dir, `${TICKET_DIR}/ticket.md`, ticketContent('feature', 'plan-execution'));
    addPushedBaseline(this);
    const shallow = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-anchor-shallow-'));
    git(shallow, `clone --quiet --depth 1 ${this.remote!} .`);
    git(shallow, 'config user.email test@test.com');
    git(shallow, 'config user.name Test');
    // Git tracks no empty directories — recreate the .safeword marker the
    // boundary command requires, exactly as a fresh container's setup would.
    mkdirSync(nodePath.join(shallow, '.safeword'), { recursive: true });
    writeFileAt(shallow, EXECUTION_PLAN, SHAPE_VALID_EXECUTION_PLAN);
    writeFileAt(
      shallow,
      `${TICKET_DIR}/ticket.md`,
      ticketContent('feature', 'implement', [`implement: ${EXECUTION_PLAN}`]),
    );
    git(shallow, 'add -A');
    git(shallow, 'commit -m advance --quiet');
    // The shared boundary-command steps operate on this.dir — point it at the
    // shallow clone (the original full-clone project has served its purpose).
    this.dir = shallow;
  },
);

Given(
  'a staged forward advance anchored to an execution-plan path that exists on disk but is not staged',
  function (this: AnchorWorld) {
    const dir = createProject(this);
    writeFileAt(dir, `${TICKET_DIR}/ticket.md`, ticketContent('feature', 'plan-execution'));
    git(dir, 'add -A');
    git(dir, 'commit -m seed --quiet');
    // On disk only — never `git add`ed, so the staged tree lacks it.
    writeFileAt(dir, EXECUTION_PLAN, SHAPE_VALID_EXECUTION_PLAN);
    writeFileAt(
      dir,
      `${TICKET_DIR}/ticket.md`,
      ticketContent('feature', 'implement', [`implement: ${EXECUTION_PLAN}`]),
    );
    git(dir, `add ${TICKET_DIR}/ticket.md`);
  },
);

Given(
  'a staged forward advance anchored to an impl-plan that fails its shape check',
  function (this: AnchorWorld) {
    const dir = createProject(this);
    writeFileAt(dir, `${TICKET_DIR}/ticket.md`, ticketContent('feature', 'plan-implementation'));
    git(dir, 'add -A');
    git(dir, 'commit -m seed --quiet');
    writeFileAt(dir, IMPL_PLAN, HOLLOW_IMPL_PLAN);
    writeFileAt(
      dir,
      `${TICKET_DIR}/ticket.md`,
      ticketContent('feature', 'plan-execution', [`plan-execution: ${IMPL_PLAN}`]),
    );
    git(dir, 'add -A');
  },
);

Given(
  'a pushed forward advance anchored to an execution-plan path that exists in the worktree but not the pushed HEAD tree',
  function (this: AnchorWorld) {
    const dir = createProject(this);
    writeFileAt(dir, `${TICKET_DIR}/ticket.md`, ticketContent('feature', 'plan-execution'));
    addPushedBaseline(this);
    writeFileAt(
      dir,
      `${TICKET_DIR}/ticket.md`,
      ticketContent('feature', 'implement', [`implement: ${EXECUTION_PLAN}`]),
    );
    git(dir, `add ${TICKET_DIR}/ticket.md`);
    git(dir, 'commit -m advance --quiet');
    writeFileAt(dir, EXECUTION_PLAN, SHAPE_VALID_EXECUTION_PLAN);
  },
);

Given(
  'a staged forward advance whose entered phase carries a hex-shaped legacy anchor',
  function (this: AnchorWorld) {
    const dir = createProject(this);
    writeFileAt(dir, `${TICKET_DIR}/ticket.md`, ticketContent('feature', 'plan-execution'));
    git(dir, 'add -A');
    git(dir, 'commit -m seed --quiet');
    writeFileAt(
      dir,
      `${TICKET_DIR}/ticket.md`,
      ticketContent('feature', 'implement', [`implement: ${SHA}`]),
    );
    git(dir, `add ${TICKET_DIR}/ticket.md`);
  },
);

Given(
  'a pushed range whose ticket carries a valid artifact-path anchor and a ledger tick SHA absent from history',
  function (this: AnchorWorld) {
    const dir = createProject(this);
    writeFileAt(dir, `${TICKET_DIR}/ticket.md`, ticketContent('feature', 'plan-execution'));
    addPushedBaseline(this);
    writeFileAt(dir, EXECUTION_PLAN, SHAPE_VALID_EXECUTION_PLAN);
    writeFileAt(
      dir,
      LEDGER,
      [
        '# Test Definitions',
        '',
        '### Scenario: s1',
        '',
        '- [x] RED deadbee',
        '- [ ] GREEN',
        '- [ ] REFACTOR',
        '',
      ].join('\n'),
    );
    writeFileAt(
      dir,
      `${TICKET_DIR}/ticket.md`,
      ticketContent('feature', 'implement', [`implement: ${EXECUTION_PLAN}`]),
    );
    git(dir, 'add -A');
    git(dir, 'commit -m advance --quiet');
  },
);

// `the boundary command runs at the …` / `it exits zero with no anchor warning`
// / `the audit entry records a passing phase-anchor verdict` are defined in
// boundary-reconciliation-gate.steps.ts — cucumber steps are global, so this
// file adds only the anchor-specific vocabulary.

Then(
  'it exits zero with no warning about unreachable history or shallow clones',
  function (this: AnchorWorld) {
    assert.equal(this.cli?.exitCode, 0);
    assert.doesNotMatch(this.cli?.output ?? '', /unreachable|not reachable|shallow/i);
  },
);

Then(
  'it exits zero and warns that the anchored artifact is missing from the staged tree',
  function (this: AnchorWorld) {
    assert.equal(this.cli?.exitCode, 0);
    assert.match(this.cli?.output ?? '', /missing/i);
  },
);

Then(
  'it exits zero and warns that the anchored artifact fails its shape check',
  function (this: AnchorWorld) {
    assert.equal(this.cli?.exitCode, 0);
    assert.match(this.cli?.output ?? '', /phase-anchor.*fails its shape check/is);
  },
);

Then(
  'it exits zero and warns that the anchored artifact is missing from the pushed tree',
  function (this: AnchorWorld) {
    assert.equal(this.cli?.exitCode, 0);
    assert.match(this.cli?.output ?? '', /phase-anchor.*missing from the tree/is);
  },
);

Then('the anchor check passes', function (this: AnchorWorld) {
  const entry = lastAuditEntry(this.dir!);
  assert.match(entry, /phase-anchor.*pass|pass.*phase-anchor/);
});

Then('the ledger check still warns about the unreachable tick SHA', function (this: AnchorWorld) {
  assert.match(this.cli?.output ?? '', /deadbee|ledger/i);
});

Then(
  'it exits zero and warns that the anchor is outside this ticket',
  function (this: AnchorWorld) {
    assert.equal(this.cli?.exitCode, 0);
    assert.match(this.cli?.output ?? '', /outside this ticket/i);
  },
);

Then('it exits zero and warns that the anchor is not repo-relative', function (this: AnchorWorld) {
  assert.equal(this.cli?.exitCode, 0);
  assert.match(this.cli?.output ?? '', /repo-relative/i);
});

Then(
  'safeword check advises the expected path-shaped anchor line for implement',
  function (this: AnchorWorld) {
    assert.ok(this.cli, 'safeword check did not run');
    assert.match(this.cli?.output ?? '', /- implement: <ticket-folder>\/execution-plan\.md/);
  },
);

Then(
  'it exits zero and warns with the expected path-shaped anchor line',
  function (this: AnchorWorld) {
    assert.equal(this.cli?.exitCode, 0);
    assert.match(this.cli?.output ?? '', /legacy commit-SHA anchor/i);
    assert.match(this.cli?.output ?? '', /- implement: <ticket-folder>\/execution-plan\.md/);
  },
);

Then('it exits zero and warns about the phase anchor', function (this: AnchorWorld) {
  assert.equal(this.cli?.exitCode, 0);
  assert.match(this.cli?.output ?? '', /phase-anchor/i);
});

Then(
  'it exits zero and warns that the feature anchor is outside every executable or configured feature lane',
  function (this: AnchorWorld) {
    assert.equal(this.cli?.exitCode, 0);
    assert.match(this.cli?.output ?? '', /phase-anchor/i);
    assert.match(this.cli?.output ?? '', /outside this ticket/i);
  },
);

Then(
  'it exits zero and warns that the project root is outside the repository',
  function (this: AnchorWorld) {
    assert.equal(this.cli?.exitCode, 0);
    assert.match(this.cli?.output ?? '', /outside.*repository|repository.*outside/i);
  },
);
