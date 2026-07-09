/**
 * Acceptance steps for the phase-provenance gate (0KYEBN, #644 G2).
 *
 * Exercises the real pre-tool-quality.ts hook against throwaway safeword
 * projects: ticket.md writes that would create a feature ticket past intake,
 * jump phases, flip a ticket's type to feature, or repair unparseable
 * frontmatter must be denied unless every skipped phase carries a phase_skips
 * justification. Following this lane's subprocess-based design, the steps
 * shell out to the hook and assert on its stdout JSON — so the assertions
 * verify the decision and denial text the agent actually sees. Targets the
 * template hook (source of truth); the dogfood mirror stays identical via
 * scripts/parity-check.ts. Mirrors the unit coverage in
 * packages/cli/tests/hooks/phase-provenance.test.ts.
 */

import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const PROJECT_ROOT = nodePath.resolve(import.meta.dirname, '..');
const HOOK_PATH = nodePath.join(PROJECT_ROOT, 'packages/cli/templates/hooks/pre-tool-quality.ts');

interface HookVerdict {
  decision: 'allow' | 'deny';
  /** Denial text the agent and user see (reason + context + system message). */
  text: string;
}

interface ProvenanceWorld extends SafewordWorld {
  projectDirectory?: string;
  ticketDirectory?: string;
  verdict?: HookVerdict;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A persona the readiness fixtures can reference. */
const PERSONAS = '# Personas\n\n## Fixture Person (FP)\n\n**Role:** exercises gates.\n';

/** spec.md satisfying the JTBD + criteria gates for readiness-complete tickets. */
const SPEC = [
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

interface TicketOptions {
  /** `null` omits the type field entirely. */
  type: string | null;
  /** `null` omits the phase field entirely. */
  phase: string | null;
  /** phase_skips block-sequence entries, verbatim after the dash. */
  skips?: string[];
}

function ticketContent(options: TicketOptions): string {
  const lines = ['---', 'id: ZZTEST', 'slug: fixture'];
  if (options.type !== null) lines.push(`type: ${options.type}`);
  if (options.phase !== null) lines.push(`phase: ${options.phase}`);
  lines.push(
    'status: in_progress',
    'scope: gate fixture',
    'out_of_scope: none',
    'done_when: gate passes',
  );
  if (options.skips !== undefined) {
    lines.push('phase_skips:');
    for (const entry of options.skips) lines.push(`  - ${entry}`);
  }
  lines.push('---', '', '# Fixture', '');
  return lines.join('\n');
}

/** Frontmatter block present but yielding no parseable key: value pairs. */
const UNPARSEABLE_TICKET = '---\n{ not yaml [\n%%%\n---\n\n# Fixture\n';

function createProject(this: ProvenanceWorld): string {
  const project = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-provenance-'));
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  const namespace = nodePath.join(project, '.project');
  mkdirSync(nodePath.join(namespace, 'tickets'), { recursive: true });
  writeFileSync(nodePath.join(namespace, 'personas.md'), PERSONAS);
  this.projectDirectory = project;
  this.ticketDirectory = nodePath.join(namespace, 'tickets', 'ZZTEST-fixture');
  mkdirSync(this.ticketDirectory, { recursive: true });
  return project;
}

/** Write a prior ticket.md plus the readiness artifacts (#404 gate inputs). */
function seedTicket(world: ProvenanceWorld, options: TicketOptions | { raw: string }): void {
  if (world.projectDirectory === undefined) createProject.call(world);
  const directory = world.ticketDirectory!;
  const content = 'raw' in options ? options.raw : ticketContent(options);
  writeFileSync(nodePath.join(directory, 'ticket.md'), content);
  writeFileSync(nodePath.join(directory, 'spec.md'), SPEC);
  writeFileSync(nodePath.join(directory, 'dimensions.md'), 'skip: single-dimension fixture\n');
}

// ---------------------------------------------------------------------------
// Hook invocation
// ---------------------------------------------------------------------------

function runHook(world: ProvenanceWorld, toolName: string, toolInput: object): HookVerdict {
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

function ticketPath(world: ProvenanceWorld): string {
  return nodePath.join(world.ticketDirectory!, 'ticket.md');
}

function writeTicket(world: ProvenanceWorld, content: string): void {
  if (world.projectDirectory === undefined) createProject.call(world);
  world.verdict = runHook(world, 'Write', { file_path: ticketPath(world), content });
}

function editTicket(world: ProvenanceWorld, oldString: string, newString: string): void {
  const prior = readFileSync(ticketPath(world), 'utf8');
  assert.ok(prior.includes(oldString), `fixture must contain "${oldString}" to edit`);
  world.verdict = runHook(world, 'Edit', {
    file_path: ticketPath(world),
    old_string: oldString,
    new_string: newString,
  });
}

/** Full-content rewrite of an existing ticket.md — same Write payload as creation. */
const rewriteTicket = writeTicket;

After(function (this: ProvenanceWorld) {
  if (this.projectDirectory !== undefined) {
    rmSync(this.projectDirectory, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Givens — prior world state
// ---------------------------------------------------------------------------

Given('a ticket folder with no ticket.md', function (this: ProvenanceWorld) {
  createProject.call(this);
  assert.equal(existsSync(ticketPath(this)), false);
});

Given('a feature ticket.md at phase {word}', function (this: ProvenanceWorld, phase: string) {
  seedTicket(this, { type: 'feature', phase });
});

Given('a feature ticket.md with no phase field', function (this: ProvenanceWorld) {
  seedTicket(this, { type: 'feature', phase: null });
});

Given('a task ticket.md at phase {word}', function (this: ProvenanceWorld, phase: string) {
  seedTicket(this, { type: 'task', phase });
});

Given(
  'a ticket.md with no type field at phase {word}',
  function (this: ProvenanceWorld, phase: string) {
    seedTicket(this, { type: null, phase });
  },
);

Given('a ticket.md whose YAML frontmatter does not parse', function (this: ProvenanceWorld) {
  seedTicket(this, { raw: UNPARSEABLE_TICKET });
});

// ---------------------------------------------------------------------------
// Whens — creation writes
// ---------------------------------------------------------------------------

// "…and no phase_skips" is the same write as the bare form — the suffix keeps
// the Gherkin explicit about the hatch being absent.
When(
  'a feature ticket.md is written with phase {word}( and no phase_skips)',
  function (this: ProvenanceWorld, phase: string) {
    writeTicket(this, ticketContent({ type: 'feature', phase }));
  },
);

When('a feature ticket.md is written with no phase field', function (this: ProvenanceWorld) {
  writeTicket(this, ticketContent({ type: 'feature', phase: null }));
});

When(
  'a {word} ticket.md is written with phase implement',
  function (this: ProvenanceWorld, type: string) {
    writeTicket(this, ticketContent({ type, phase: 'implement' }));
  },
);

When(
  'a ticket.md with no type field is written with phase implement',
  function (this: ProvenanceWorld) {
    writeTicket(this, ticketContent({ type: null, phase: 'implement' }));
  },
);

When(
  'a feature ticket.md is written with phase implement and phase_skips entries with reasons for intake, define-behavior, scenario-gate, and plan-implementation',
  function (this: ProvenanceWorld) {
    writeTicket(
      this,
      ticketContent({
        type: 'feature',
        phase: 'implement',
        skips: [
          'intake: retro-ticketing work already scoped in PR review',
          'define-behavior: scenarios exist as tests in the PR',
          'scenario-gate: reviewed by maintainer on the PR thread',
          'plan-implementation: plan captured in the PR description',
        ],
      }),
    );
  },
);

When(
  'a feature ticket.md is written with phase implement and a phase_skips entry with a reason for intake only',
  function (this: ProvenanceWorld) {
    writeTicket(
      this,
      ticketContent({
        type: 'feature',
        phase: 'implement',
        skips: ['intake: retro-ticketing work already scoped in PR review'],
      }),
    );
  },
);

When(
  'a feature ticket.md is written with phase define-behavior and a phase_skips entry for intake whose reason is blank',
  function (this: ProvenanceWorld) {
    writeTicket(
      this,
      ticketContent({ type: 'feature', phase: 'define-behavior', skips: ['intake:'] }),
    );
  },
);

When('a ticket.md is written with no YAML frontmatter', function (this: ProvenanceWorld) {
  writeTicket(this, '# Fixture\n\nNo frontmatter at all.\n');
});

When(
  'a ticket.md is written whose YAML frontmatter does not parse',
  function (this: ProvenanceWorld) {
    writeTicket(this, UNPARSEABLE_TICKET);
  },
);

// ---------------------------------------------------------------------------
// Whens — edits to an existing ticket.md
// ---------------------------------------------------------------------------

When('the ticket.md is edited to phase {word}', function (this: ProvenanceWorld, phase: string) {
  const prior = readFileSync(ticketPath(this), 'utf8');
  const priorPhase = prior.match(/^phase:\s*(\S+)/m)?.[1];
  assert.ok(priorPhase, 'fixture must carry a phase to change');
  editTicket(this, `phase: ${priorPhase}`, `phase: ${phase}`);
});

When(
  'the ticket.md is MultiEdited to phase {word}',
  function (this: ProvenanceWorld, phase: string) {
    // Drive the MultiEdit payload shape (tool_input.edits[]) so the hook's
    // content reconstruction is exercised end-to-end, not just Write/Edit.
    const prior = readFileSync(ticketPath(this), 'utf8');
    const priorPhase = prior.match(/^phase:\s*(\S+)/m)?.[1];
    assert.ok(priorPhase, 'fixture must carry a phase to change');
    this.verdict = runHook(this, 'MultiEdit', {
      file_path: ticketPath(this),
      edits: [{ old_string: `phase: ${priorPhase}`, new_string: `phase: ${phase}` }],
    });
  },
);

When(
  'the ticket.md is edited to phase {word} with no phase_skips',
  function (this: ProvenanceWorld, phase: string) {
    const prior = readFileSync(ticketPath(this), 'utf8');
    const priorPhase = prior.match(/^phase:\s*(\S+)/m)?.[1];
    if (priorPhase === undefined) {
      // Absent-phase prior: adding the phase field is the edit.
      editTicket(this, 'status: in_progress', `phase: ${phase}\nstatus: in_progress`);
    } else {
      editTicket(this, `phase: ${priorPhase}`, `phase: ${phase}`);
    }
  },
);

When(
  'the ticket.md is edited to phase implement and phase_skips entries with reasons for define-behavior, scenario-gate, and plan-implementation',
  function (this: ProvenanceWorld) {
    // New-flow fixture (seedTicket writes spec.md): the TXRHMD plan gate
    // requires a valid planned impl-plan.md at implement entry — a provenance
    // skip justifies the phase jump, never the missing plan.
    writeFileSync(
      nodePath.join(this.ticketDirectory!, 'impl-plan.md'),
      [
        '# Impl Plan: fixture',
        '',
        '**Status:** planned',
        '',
        '## Approach',
        'One slice.',
        '## Decisions',
        'skip: fixture',
        '## Arch alignment',
        'skip: no ADRs in this project yet',
        '## Known deviations',
        'skip: none',
        '## Assessment triggers',
        'skip: fixture',
        '',
      ].join('\n'),
    );
    editTicket(
      this,
      'phase: intake\nstatus: in_progress',
      [
        'phase: implement',
        'status: in_progress',
        'phase_skips:',
        '  - define-behavior: scenarios exist as tests in the PR',
        '  - scenario-gate: reviewed by maintainer on the PR thread',
        '  - plan-implementation: plan captured in the PR description',
      ].join('\n'),
    );
  },
);

When(
  'the ticket.md is edited to type feature without changing its phase field',
  function (this: ProvenanceWorld) {
    const prior = readFileSync(ticketPath(this), 'utf8');
    if (prior.includes('type: task')) {
      editTicket(this, 'type: task', 'type: feature');
    } else {
      // Typeless prior: adding the type field is the edit.
      editTicket(this, 'id: ZZTEST', 'id: ZZTEST\ntype: feature');
    }
  },
);

When(
  'the ticket.md is edited to type feature and phase_skips entries with reasons for intake, define-behavior, scenario-gate, and plan-implementation',
  function (this: ProvenanceWorld) {
    editTicket(
      this,
      'type: task',
      [
        'type: feature',
        'phase_skips:',
        '  - intake: retro-ticketing work already scoped in PR review',
        '  - define-behavior: scenarios exist as tests in the PR',
        '  - scenario-gate: reviewed by maintainer on the PR thread',
        '  - plan-implementation: plan captured in the PR description',
      ].join('\n'),
    );
  },
);

When('the ticket.md is edited without changing its phase field', function (this: ProvenanceWorld) {
  editTicket(this, '# Fixture', '# Fixture\n\n- work log appended\n');
});

When('the ticket.md is edited without changing its frontmatter', function (this: ProvenanceWorld) {
  editTicket(this, '# Fixture', '# Fixture\n\n- work log appended\n');
});

When(
  'the ticket.md is edited so its frontmatter parses with type feature and phase implement and no phase_skips',
  function (this: ProvenanceWorld) {
    rewriteTicket(this, ticketContent({ type: 'feature', phase: 'implement' }));
  },
);

When(
  'the ticket.md is edited so its frontmatter parses with type feature and phase intake',
  function (this: ProvenanceWorld) {
    rewriteTicket(this, ticketContent({ type: 'feature', phase: 'intake' }));
  },
);

// ---------------------------------------------------------------------------
// Thens — decision and denial text
// ---------------------------------------------------------------------------

Then('the write is denied', function (this: ProvenanceWorld) {
  assert.equal(this.verdict?.decision, 'deny', 'expected the hook to deny this write');
});

Then('the write is allowed', function (this: ProvenanceWorld) {
  assert.equal(
    this.verdict?.decision,
    'allow',
    `expected the hook to allow this write; denial was:\n${this.verdict?.text}`,
  );
});

Then(
  'the denial explains that feature tickets start at intake and names phase_skips as the deliberate alternative',
  function (this: ProvenanceWorld) {
    const text = this.verdict?.text ?? '';
    assert.match(text, /intake/i);
    assert.match(text, /phase_skips/);
  },
);

Then(
  'the denial names define-behavior, scenario-gate, and plan-implementation as the phases still needing justification',
  function (this: ProvenanceWorld) {
    const text = this.verdict?.text ?? '';
    assert.match(text, /define-behavior/);
    assert.match(text, /scenario-gate/);
    assert.match(text, /plan-implementation/);
  },
);

Then('the denial does not name intake', function (this: ProvenanceWorld) {
  // The denial must list only unjustified phases. "intake" may appear inside
  // remediation prose (e.g. "start at intake"), so assert against the named
  // missing-phase list rather than the whole text.
  const text = this.verdict?.text ?? '';
  const listMatch = text.match(/justification[^:]*:\s*([^.]*)/i);
  const namedList = listMatch?.[1] ?? text;
  assert.doesNotMatch(namedList, /\bintake\b/);
});

Then(
  'the denial explains that a skip requires a non-empty reason',
  function (this: ProvenanceWorld) {
    assert.match(this.verdict?.text ?? '', /non-empty reason/i);
  },
);

Then(
  'the denial names define-behavior, scenario-gate, and plan-implementation as the skipped phases',
  function (this: ProvenanceWorld) {
    const text = this.verdict?.text ?? '';
    assert.match(text, /define-behavior/);
    assert.match(text, /scenario-gate/);
    assert.match(text, /plan-implementation/);
  },
);

Then(
  'the denial names define-behavior, scenario-gate, plan-implementation, implement, and verify as the skipped phases',
  function (this: ProvenanceWorld) {
    const text = this.verdict?.text ?? '';
    assert.match(text, /define-behavior/);
    assert.match(text, /scenario-gate/);
    assert.match(text, /plan-implementation/);
    assert.match(text, /\bimplement\b/);
    assert.match(text, /\bverify\b/);
  },
);

Then('the denial lists the canonical phases', function (this: ProvenanceWorld) {
  const text = this.verdict?.text ?? '';
  for (const phase of [
    'intake',
    'define-behavior',
    'scenario-gate',
    'plan-implementation',
    'implement',
    'verify',
  ]) {
    assert.match(text, new RegExp(phase));
  }
  assert.match(text, /\bdone\b/);
});

Then(
  'the denial explains that becoming a feature past intake requires phase_skips justifications',
  function (this: ProvenanceWorld) {
    const text = this.verdict?.text ?? '';
    assert.match(text, /feature/i);
    assert.match(text, /phase_skips/);
  },
);

Then(
  'the denial explains that ticket.md requires YAML frontmatter',
  function (this: ProvenanceWorld) {
    assert.match(this.verdict?.text ?? '', /frontmatter/i);
  },
);

Then(
  'the denial explains that ticket.md requires parseable YAML frontmatter',
  function (this: ProvenanceWorld) {
    const text = this.verdict?.text ?? '';
    assert.match(text, /frontmatter/i);
    assert.match(text, /parse/i);
  },
);
