/**
 * Acceptance steps for the artifact-precedence gate (87Y167, #644 G1).
 *
 * Exercises the real pre-tool-quality.ts hook against throwaway safeword
 * projects: creations of spec.md / dimensions.md / test-definitions.md and
 * ticket.md advances into implement must walk the forward chain — each
 * artifact on complete prerequisites, scenarios on a reviewed spec,
 * implementation on independently reviewed scenarios. Subprocess-based like
 * steps/phase-provenance.steps.ts (whose generic ticket Givens/Whens/Thens
 * this file reuses at runtime); assertions read the hook's stdout JSON.
 * Mirrors the unit coverage in packages/cli/tests/hooks/artifact-precedence.test.ts.
 */

import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

// The review-stamp log-line contract (review-ledger.ts): scope is
// `<ticket>:<artifact>@<sha1-12 of content>`. Reconstructed here rather than
// imported so the acceptance lane asserts the on-disk contract as a black box.
function hashArtifact(content: string): string {
  return createHash('sha1').update(content).digest('hex').slice(0, 12);
}

function reviewScope(ticketId: string, artifact: string, contentHash: string): string {
  return `${ticketId}:${artifact}@${contentHash}`;
}

const PROJECT_ROOT = nodePath.resolve(import.meta.dirname, '..');
const HOOK_PATH = nodePath.join(PROJECT_ROOT, 'packages/cli/templates/hooks/pre-tool-quality.ts');

interface HookVerdict {
  decision: 'allow' | 'deny';
  text: string;
}

interface PrecedenceWorld extends SafewordWorld {
  projectDirectory?: string;
  ticketDirectory?: string;
  verdict?: HookVerdict;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PERSONAS = '# Personas\n\n## Fixture Person (FP)\n\n**Role:** exercises gates.\n';

const COMPLETE_SPEC = [
  '# Spec: fixture',
  '',
  '## Jobs To Be Done',
  '',
  '### fixture.FP1 — exercise the gate',
  '',
  '**Persona:** Fixture Person (FP)',
  '',
  '> When I write tickets, I want gates to fire, so I can trust phase state.',
  '',
  '#### fixture.FP1.AC1 — the gate decides deterministically',
  '',
].join('\n');

const JOBLESS_SPEC = '# Spec: fixture\n\n## Jobs To Be Done\n\n';
const NO_AC_SPEC = COMPLETE_SPEC.replace(
  '#### fixture.FP1.AC1 — the gate decides deterministically',
  '',
);
const JOBS_SKIP_SPEC = '# Spec: fixture\n\n## Jobs To Be Done\n\nskip: internal plumbing\n';
const JOBS_BLANK_SKIP_SPEC = '# Spec: fixture\n\n## Jobs To Be Done\n\nskip:\n';

const SOURCE_PATH = 'features/fixture.feature';
const SOURCE_CONTENT = 'Feature: fixture\n\n  Scenario: a\n    Given a world\n';
const LEDGER_WITH_SOURCE = `# Test Definitions: fixture\n\nFeature source: \`${SOURCE_PATH}\`\n\n### Scenario: a\n\n- [ ] RED\n`;
const LEDGER_NO_SOURCE = '# Test Definitions: fixture\n\n### Scenario: a\n\n- [ ] RED\n';

function ticketContent(options: { type?: string | null; phase: string; skips?: string[] }): string {
  const lines = ['---', 'id: ZZTEST', 'slug: fixture'];
  if (options.type !== null) lines.push(`type: ${options.type ?? 'feature'}`);
  lines.push(
    `phase: ${options.phase}`,
    'status: in_progress',
    'scope: gate fixture',
    'out_of_scope: none',
    'done_when: gate passes',
  );
  if (options.skips !== undefined) {
    lines.push('phase_skips:');
    for (const skipEntry of options.skips) lines.push(`  - ${skipEntry}`);
  }
  lines.push('---', '', '# Fixture', '');
  return lines.join('\n');
}

function createProject(world: PrecedenceWorld): void {
  const project = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-precedence-'));
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  const namespace = nodePath.join(project, '.project');
  mkdirSync(nodePath.join(namespace, 'tickets'), { recursive: true });
  writeFileSync(nodePath.join(namespace, 'personas.md'), PERSONAS);
  world.projectDirectory = project;
  world.ticketDirectory = nodePath.join(namespace, 'tickets', 'ZZTEST-fixture');
  mkdirSync(world.ticketDirectory, { recursive: true });
}

/** Seed ticket.md only — spec/dimensions/test-definitions stay absent. */
function seedBareTicket(
  world: PrecedenceWorld,
  options: { type?: string | null; phase: string; skips?: string[] },
): void {
  if (world.projectDirectory === undefined) createProject(world);
  writeFileSync(nodePath.join(world.ticketDirectory!, 'ticket.md'), ticketContent(options));
}

function writeArtifact(world: PrecedenceWorld, name: string, content: string): void {
  writeFileSync(nodePath.join(world.ticketDirectory!, name), content);
}

function removeArtifact(world: PrecedenceWorld, name: string): void {
  rmSync(nodePath.join(world.ticketDirectory!, name), { force: true });
}

/**
 * Establish spec.md as the given state. Derived artifacts (dimensions.md,
 * test-definitions.md) are removed: a world defined by its spec state has not
 * derived anything from that spec yet, and the creation gates only fire on
 * writes that would create the artifact.
 */
function establishSpec(world: PrecedenceWorld, content: string): void {
  writeArtifact(world, 'spec.md', content);
  removeArtifact(world, 'dimensions.md');
  removeArtifact(world, 'test-definitions.md');
}

function appendStampLine(world: PrecedenceWorld, entry: string): void {
  const logFile = nodePath.join(world.projectDirectory!, '.project', 'skill-invocations.log');
  const prior = existsSync(logFile) ? readFileSync(logFile, 'utf8') : '';
  writeFileSync(logFile, `${prior}2026-01-01T00:00:00.000Z fixture-session ${entry}\n`);
}

function ticketArtifactContent(world: PrecedenceWorld, name: string): string {
  return readFileSync(nodePath.join(world.ticketDirectory!, name), 'utf8');
}

/** The content the implement-entry gate reviews: named source, else the ledger. */
function scenarioReviewContent(world: PrecedenceWorld): string {
  const ledger = ticketArtifactContent(world, 'test-definitions.md');
  const sourceFile = nodePath.join(world.projectDirectory!, SOURCE_PATH);
  return ledger.includes('Feature source:') && existsSync(sourceFile)
    ? readFileSync(sourceFile, 'utf8')
    : ledger;
}

// ---------------------------------------------------------------------------
// Hook invocation
// ---------------------------------------------------------------------------

function runHook(world: PrecedenceWorld, toolName: string, toolInput: object): HookVerdict {
  const stdout = execFileSync('bun', [HOOK_PATH], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, CLAUDE_PROJECT_DIR: world.projectDirectory },
    input: JSON.stringify({ tool_name: toolName, tool_input: toolInput }),
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

function writeInTicketFolder(world: PrecedenceWorld, name: string, content: string): void {
  world.verdict = runHook(world, 'Write', {
    file_path: nodePath.join(world.ticketDirectory!, name),
    content,
  });
}

// ---------------------------------------------------------------------------
// Givens — ticket worlds (unique wordings; generic ticket Givens/Whens/Thens
// come from steps/phase-provenance.steps.ts at runtime)
// ---------------------------------------------------------------------------

Given(
  'a {word} ticket.md at phase {word} and no spec.md',
  function (this: PrecedenceWorld, type: string, phase: string) {
    seedBareTicket(this, { type, phase });
  },
);

Given(
  'a ticket.md with no type field at phase {word} and no spec.md',
  function (this: PrecedenceWorld, phase: string) {
    seedBareTicket(this, { type: null, phase });
  },
);

Given(
  'a feature ticket.md at phase {word} with no spec.md yet',
  function (this: PrecedenceWorld, phase: string) {
    seedBareTicket(this, { phase });
  },
);

Given(
  'a feature ticket.md at phase {word} with a complete spec.md and dimensions.md',
  function (this: PrecedenceWorld, phase: string) {
    seedBareTicket(this, { phase });
    writeArtifact(this, 'spec.md', COMPLETE_SPEC);
    writeArtifact(this, 'dimensions.md', 'skip: single-dimension fixture\n');
  },
);

Given(
  'a feature ticket.md at phase {word} with no spec.md and no dimensions.md',
  function (this: PrecedenceWorld, phase: string) {
    seedBareTicket(this, { phase });
  },
);

Given(
  'a feature ticket.md at phase {word} with a complete spec.md and no dimensions.md',
  function (this: PrecedenceWorld, phase: string) {
    seedBareTicket(this, { phase });
    writeArtifact(this, 'spec.md', COMPLETE_SPEC);
  },
);

Given(
  'a feature ticket.md at phase define-behavior with an existing dimensions.md',
  function (this: PrecedenceWorld) {
    seedBareTicket(this, { phase: 'define-behavior' });
    writeArtifact(this, 'dimensions.md', '| Dimension | Partitions |\n| --- | --- |\n| a | b |\n');
  },
);

Given(
  'a feature ticket.md at phase implement with an existing test-definitions.md',
  function (this: PrecedenceWorld) {
    seedBareTicket(this, { phase: 'implement' });
    writeArtifact(this, 'spec.md', COMPLETE_SPEC);
    writeArtifact(this, 'dimensions.md', 'skip: single-dimension fixture\n');
    writeArtifact(this, 'test-definitions.md', LEDGER_NO_SOURCE);
  },
);

Given(
  'a feature ticket.md at phase scenario-gate with saved scenarios',
  function (this: PrecedenceWorld) {
    seedBareTicket(this, { phase: 'scenario-gate' });
    writeArtifact(this, 'spec.md', COMPLETE_SPEC);
    writeArtifact(this, 'dimensions.md', 'skip: single-dimension fixture\n');
    writeArtifact(this, 'test-definitions.md', LEDGER_WITH_SOURCE);
    mkdirSync(nodePath.join(this.projectDirectory!, 'features'), { recursive: true });
    writeFileSync(nodePath.join(this.projectDirectory!, SOURCE_PATH), SOURCE_CONTENT);
  },
);

Given(
  'a feature ticket.md at phase scenario-gate whose test-definitions.md names a feature source file',
  function (this: PrecedenceWorld) {
    seedBareTicket(this, { phase: 'scenario-gate' });
    writeArtifact(this, 'spec.md', COMPLETE_SPEC);
    writeArtifact(this, 'dimensions.md', 'skip: single-dimension fixture\n');
    writeArtifact(this, 'test-definitions.md', LEDGER_WITH_SOURCE);
    mkdirSync(nodePath.join(this.projectDirectory!, 'features'), { recursive: true });
    writeFileSync(nodePath.join(this.projectDirectory!, SOURCE_PATH), SOURCE_CONTENT);
  },
);

Given(
  'a feature ticket.md at phase scenario-gate whose test-definitions.md names no feature source file',
  function (this: PrecedenceWorld) {
    seedBareTicket(this, { phase: 'scenario-gate' });
    writeArtifact(this, 'spec.md', COMPLETE_SPEC);
    writeArtifact(this, 'dimensions.md', 'skip: single-dimension fixture\n');
    writeArtifact(this, 'test-definitions.md', LEDGER_NO_SOURCE);
  },
);

Given(
  'a feature ticket.md at phase scenario-gate and no test-definitions.md',
  function (this: PrecedenceWorld) {
    seedBareTicket(this, { phase: 'scenario-gate' });
    writeArtifact(this, 'spec.md', COMPLETE_SPEC);
    writeArtifact(this, 'dimensions.md', 'skip: single-dimension fixture\n');
  },
);

Given(
  'a feature ticket.md at phase intake and no test-definitions.md',
  function (this: PrecedenceWorld) {
    seedBareTicket(this, { phase: 'intake' });
    writeArtifact(this, 'spec.md', COMPLETE_SPEC);
    writeArtifact(this, 'dimensions.md', 'skip: single-dimension fixture\n');
  },
);

Given('a project folder that is not under the tickets namespace', function (this: PrecedenceWorld) {
  createProject(this);
  mkdirSync(nodePath.join(this.projectDirectory!, 'docs'), { recursive: true });
});

// ---------------------------------------------------------------------------
// Givens — spec states (derived artifacts reset: a world defined by its spec
// has not derived dimensions/scenarios from it yet)
// ---------------------------------------------------------------------------

Given('a spec.md whose Jobs To Be Done section is empty', function (this: PrecedenceWorld) {
  establishSpec(this, JOBLESS_SPEC);
});

Given(
  'a spec.md with a resolvable Job To Be Done but no Acceptance Criterion under it',
  function (this: PrecedenceWorld) {
    establishSpec(this, NO_AC_SPEC);
  },
);

Given(
  'a spec.md whose Jobs To Be Done and Acceptance Criteria are complete',
  function (this: PrecedenceWorld) {
    establishSpec(this, COMPLETE_SPEC);
  },
);

Given(
  'a spec.md whose Jobs To Be Done section is a skip with a reason',
  function (this: PrecedenceWorld) {
    establishSpec(this, JOBS_SKIP_SPEC);
  },
);

Given(
  'a spec.md whose Jobs To Be Done section is a skip with a blank reason',
  function (this: PrecedenceWorld) {
    establishSpec(this, JOBS_BLANK_SKIP_SPEC);
  },
);

// ---------------------------------------------------------------------------
// Givens — review-gate flag and stamps
// ---------------------------------------------------------------------------

Given('the reviewGate config flag is off', function (this: PrecedenceWorld) {
  writeFileSync(
    nodePath.join(this.projectDirectory!, '.safeword', 'config.json'),
    '{ "reviewGate": false }\n',
  );
});

Given("no review stamp exists for the ticket's spec.md", function (this: PrecedenceWorld) {
  // Fresh throwaway projects carry no skill-invocations.log — assert, don't create.
  assert.equal(
    existsSync(nodePath.join(this.projectDirectory!, '.project', 'skill-invocations.log')),
    false,
  );
});

Given(
  "a review stamp exists for the ticket's spec.md at its current content",
  function (this: PrecedenceWorld) {
    const hash = hashArtifact(ticketArtifactContent(this, 'spec.md'));
    appendStampLine(this, `review:${reviewScope('ZZTEST-fixture', 'spec', hash)}`);
  },
);

Given(
  "a review stamp exists for an earlier content of the ticket's spec.md",
  function (this: PrecedenceWorld) {
    const hash = hashArtifact('an earlier spec revision');
    appendStampLine(this, `review:${reviewScope('ZZTEST-fixture', 'spec', hash)}`);
  },
);

Given(
  "a logged review skip with a reason exists for the ticket's spec.md at its current content",
  function (this: PrecedenceWorld) {
    const hash = hashArtifact(ticketArtifactContent(this, 'spec.md'));
    appendStampLine(
      this,
      `review:${reviewScope('ZZTEST-fixture', 'spec', hash)} skip:greenfield spike`,
    );
  },
);

Given(
  "a logged review skip with a blank reason exists for the ticket's spec.md at its current content",
  function (this: PrecedenceWorld) {
    const hash = hashArtifact(ticketArtifactContent(this, 'spec.md'));
    appendStampLine(this, `review:${reviewScope('ZZTEST-fixture', 'spec', hash)} skip: `);
  },
);

Given(
  "a review stamp exists for a different ticket's spec.md at identical content",
  function (this: PrecedenceWorld) {
    const hash = hashArtifact(ticketArtifactContent(this, 'spec.md'));
    appendStampLine(this, `review:${reviewScope('OTHER0-ticket', 'spec', hash)}`);
  },
);

Given("no review stamp exists for the ticket's scenarios", function (this: PrecedenceWorld) {
  assert.equal(
    existsSync(nodePath.join(this.projectDirectory!, '.project', 'skill-invocations.log')),
    false,
  );
});

Given(
  "a review stamp exists for the ticket's scenarios at their current content",
  function (this: PrecedenceWorld) {
    const hash = hashArtifact(scenarioReviewContent(this));
    appendStampLine(this, `review:${reviewScope('ZZTEST-fixture', 'scenarios', hash)}`);
  },
);

Given(
  "a review stamp exists for an earlier content of the ticket's scenarios",
  function (this: PrecedenceWorld) {
    const hash = hashArtifact('an earlier scenario revision');
    appendStampLine(this, `review:${reviewScope('ZZTEST-fixture', 'scenarios', hash)}`);
  },
);

Given(
  "a logged review skip with a reason exists for the ticket's scenarios at their current content",
  function (this: PrecedenceWorld) {
    const hash = hashArtifact(scenarioReviewContent(this));
    appendStampLine(
      this,
      `review:${reviewScope('ZZTEST-fixture', 'scenarios', hash)} skip:greenfield spike`,
    );
  },
);

Given(
  "a logged review skip with a blank reason exists for the ticket's scenarios at their current content",
  function (this: PrecedenceWorld) {
    const hash = hashArtifact(scenarioReviewContent(this));
    appendStampLine(this, `review:${reviewScope('ZZTEST-fixture', 'scenarios', hash)} skip: `);
  },
);

Given(
  'a review stamp exists for the test-definitions.md at its current content',
  function (this: PrecedenceWorld) {
    const hash = hashArtifact(ticketArtifactContent(this, 'test-definitions.md'));
    appendStampLine(this, `review:${reviewScope('ZZTEST-fixture', 'scenarios', hash)}`);
  },
);

Given('no review stamp exists for the feature source file', function (this: PrecedenceWorld) {
  // The only stamps written so far target other artifacts — nothing to do.
});

Given(
  'a review stamp recorded for a different ticket exists for that feature source file at its current content',
  function (this: PrecedenceWorld) {
    const hash = hashArtifact(SOURCE_CONTENT);
    appendStampLine(this, `review:${reviewScope('OTHER0-ticket', 'scenarios', hash)}`);
  },
);

Given(
  'a review stamp recorded for this ticket exists for that feature source file at its current content',
  function (this: PrecedenceWorld) {
    const hash = hashArtifact(SOURCE_CONTENT);
    appendStampLine(this, `review:${reviewScope('ZZTEST-fixture', 'scenarios', hash)}`);
  },
);

Given(
  'the ticket.md carries a phase_skips entry with a reason for intake',
  function (this: PrecedenceWorld) {
    const ticketFile = nodePath.join(this.ticketDirectory!, 'ticket.md');
    const prior = readFileSync(ticketFile, 'utf8');
    const phase = prior.match(/^phase:\s*(\S+)/m)?.[1] ?? 'scenario-gate';
    writeFileSync(ticketFile, ticketContent({ phase, skips: ['intake: migrated from tracker'] }));
  },
);

// ---------------------------------------------------------------------------
// Whens — artifact writes
// ---------------------------------------------------------------------------

When('a spec.md is written in that ticket folder', function (this: PrecedenceWorld) {
  writeInTicketFolder(this, 'spec.md', COMPLETE_SPEC);
});

When('a dimensions.md is written in that ticket folder', function (this: PrecedenceWorld) {
  writeInTicketFolder(
    this,
    'dimensions.md',
    '| Dimension | Partitions |\n| --- | --- |\n| a | b |\n',
  );
});

When('a test-definitions.md is written in that ticket folder', function (this: PrecedenceWorld) {
  writeInTicketFolder(this, 'test-definitions.md', LEDGER_NO_SOURCE);
});

When('a notes.md is written in that ticket folder', function (this: PrecedenceWorld) {
  writeInTicketFolder(this, 'notes.md', '# Scratch notes\n');
});

When('a spec.md is written in that project folder', function (this: PrecedenceWorld) {
  this.verdict = runHook(this, 'Write', {
    file_path: nodePath.join(this.projectDirectory!, 'docs', 'spec.md'),
    content: '# A project spec outside tickets\n',
  });
});

When('a dimensions.md is written in that project folder', function (this: PrecedenceWorld) {
  this.verdict = runHook(this, 'Write', {
    file_path: nodePath.join(this.projectDirectory!, 'docs', 'dimensions.md'),
    content: '# Project dimensions outside tickets\n',
  });
});

When('the existing dimensions.md is edited', function (this: PrecedenceWorld) {
  this.verdict = runHook(this, 'Edit', {
    file_path: nodePath.join(this.ticketDirectory!, 'dimensions.md'),
    old_string: '| a | b |',
    new_string: '| a | b, c |',
  });
});

When('the existing test-definitions.md is edited', function (this: PrecedenceWorld) {
  this.verdict = runHook(this, 'Edit', {
    file_path: nodePath.join(this.ticketDirectory!, 'test-definitions.md'),
    old_string: '### Scenario: a',
    new_string: '### Scenario: a (renamed)',
  });
});

// "the ticket.md is edited to phase {word}" comes from phase-provenance.steps.ts
// — one definition, shared world shape, so redefining it here would be ambiguous.

// ---------------------------------------------------------------------------
// Thens — denial content
// ---------------------------------------------------------------------------

function denialText(world: PrecedenceWorld): string {
  return world.verdict?.text ?? '';
}

Then(
  'the denial names ticket.md as the artifact to create first',
  function (this: PrecedenceWorld) {
    assert.match(denialText(this), /ticket\.md/);
  },
);

Then('the denial names spec.md as the artifact to author first', function (this: PrecedenceWorld) {
  assert.match(denialText(this), /spec\.md/);
});

Then(
  'the denial names dimensions.md as the artifact to author next',
  function (this: PrecedenceWorld) {
    assert.match(denialText(this), /dimensions\.md/);
  },
);

Then('the denial does not demand dimensions.md before spec.md', function (this: PrecedenceWorld) {
  assert.doesNotMatch(denialText(this), /dimensions\.md/);
});

Then(
  'the denial explains that spec.md needs a Job To Be Done or a skip reason before dimensions',
  function (this: PrecedenceWorld) {
    assert.match(denialText(this), /Job To Be Done or a skip reason before dimensions/i);
  },
);

Then(
  'the denial explains that every Job To Be Done needs an Acceptance Criterion or a skip reason',
  function (this: PrecedenceWorld) {
    assert.match(denialText(this), /Acceptance Criterion or a skip reason/i);
  },
);

Then(
  'the denial explains that spec.md must be reviewed at its current content before scenarios',
  function (this: PrecedenceWorld) {
    assert.match(denialText(this), /spec\.md must be reviewed at its current content/i);
  },
);

Then(
  'the denial names self-review or a logged skip as the way forward',
  function (this: PrecedenceWorld) {
    const text = denialText(this);
    assert.match(text, /self-review/i);
    assert.match(text, /skip/i);
  },
);

Then(
  'the denial explains that the spec review is stale because the spec changed after it',
  function (this: PrecedenceWorld) {
    assert.match(denialText(this), /stale when the spec (is )?changed|goes stale/i);
  },
);

Then(
  'the denial explains that the scenarios need an independent review at their current content',
  function (this: PrecedenceWorld) {
    assert.match(denialText(this), /independent review at their current content/i);
  },
);

Then(
  'the denial names review-spec or a logged skip as the way forward',
  function (this: PrecedenceWorld) {
    const text = denialText(this);
    assert.match(text, /review-spec/i);
    assert.match(text, /skip/i);
  },
);

Then(
  'the denial explains that the scenario review is stale because the scenarios changed after it',
  function (this: PrecedenceWorld) {
    assert.match(denialText(this), /invalidated when the scenarios change after it/i);
  },
);

Then(
  'the denial names test-definitions.md as the artifact to create first',
  function (this: PrecedenceWorld) {
    assert.match(denialText(this), /test-definitions\.md/);
  },
);

Then(
  'the denial includes the ordered-patch note about pre-edit-state evaluation',
  function (this: PrecedenceWorld) {
    assert.match(denialText(this), /pre-edit filesystem/i);
  },
);
