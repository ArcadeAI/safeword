/**
 * Acceptance steps for the PM-grade intake readiness gate (TPP6Y2).
 *
 * Exercises the real prompt-questions.ts hook against throwaway safeword
 * projects: the readiness pointer must surface while scoping (no active ticket,
 * or the intake phase) and disappear once a build phase is under way. Following
 * this lane's subprocess-based design, the steps shell out to the hook and
 * assert on its stdout rather than importing project internals — so the
 * assertions verify the text the agent actually sees. Mirrors the unit coverage
 * in packages/cli/tests/hooks/readiness-pointer.test.ts.
 */

import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const PROJECT_ROOT = nodePath.resolve(import.meta.dirname, '..');
const HOOK_PATH = nodePath.join(PROJECT_ROOT, '.safeword/hooks/prompt-questions.ts');
const SAFEWORD_TEMPLATE = nodePath.join(PROJECT_ROOT, 'packages/cli/templates/SAFEWORD.md');

// The pointer's opening sentinel — unmistakable in the hook's stdout, so its
// presence/absence is the surface/suppress signal.
const POINTER_SIGNATURE = 'Ready to build?';
// Mirror of READINESS_POINTER_WORD_CAP in .safeword/hooks/lib/readiness-pointer.ts —
// the pointer must stay a compressed pointer, not spelled-out prompts.
const POINTER_WORD_CAP = 30;

interface ReadinessWorld extends SafewordWorld {
  projectDirectory?: string;
  safewordPath?: string;
  hookOutput?: string;
  renderedPointer?: string;
  safewordContent?: string;
}

// Build a throwaway safeword project, optionally with an active ticket at a
// given phase. Mirrors the unit test's layout: ticket under the default
// .project namespace, plus the matching quality-state file so the hook binds to
// it. `withScenarios` adds a mid-RED test-definitions.md so the implement-phase
// hook can derive a TDD step.
function createProject(ticket?: {
  phase: string;
  status: string;
  withScenarios?: boolean;
}): string {
  const project = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-readiness-'));
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });

  if (ticket) {
    const ticketDirectory = nodePath.join(project, '.project', 'tickets', 'AAA111-demo');
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(ticketDirectory, 'ticket.md'),
      `---\nid: AAA111\nslug: demo\ntype: task\nphase: ${ticket.phase}\nstatus: ${ticket.status}\n---\n\n# Demo\n`,
    );
    if (ticket.withScenarios) {
      // One scenario mid-RED (1 checked, 2 unchecked) → deriveTddStep('red'), so
      // the hook emits the implement-phase `TDD: RED` guidance line.
      writeFileSync(
        nodePath.join(ticketDirectory, 'test-definitions.md'),
        '## Scenario: demo\n\n- [x] RED\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
    }
    writeFileSync(
      nodePath.join(project, '.project', 'quality-state-undefined.json'),
      JSON.stringify({ activeTicket: 'AAA111' }),
    );
  }

  return project;
}

// Run the prompt-questions hook against the project via CLAUDE_PROJECT_DIR (the
// same wiring the unit test uses) and capture stdout.
function runPromptHook(projectDirectory: string): string {
  return execFileSync('bun', [HOOK_PATH], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
    input: '{}',
    encoding: 'utf8',
  });
}

After(function (this: ReadinessWorld) {
  if (this.projectDirectory !== undefined) {
    rmSync(this.projectDirectory, { recursive: true, force: true });
  }
});

Given('a session with no active ticket', function (this: ReadinessWorld) {
  this.projectDirectory = createProject();
});

Given('an active ticket in the intake phase', function (this: ReadinessWorld) {
  this.projectDirectory = createProject({ phase: 'intake', status: 'in_progress' });
});

Given('an active ticket in the implement phase', function (this: ReadinessWorld) {
  this.projectDirectory = createProject({
    phase: 'implement',
    status: 'in_progress',
    withScenarios: true,
  });
});

Given('a Clarify-phase prompt reminder', function (this: ReadinessWorld) {
  this.projectDirectory = createProject();
});

Given('the SAFEWORD.md standing instructions', function (this: ReadinessWorld) {
  this.safewordPath = SAFEWORD_TEMPLATE;
});

When('the prompt reminder is generated', { timeout: 30_000 }, function (this: ReadinessWorld) {
  assert.ok(this.projectDirectory, 'project directory was not created');
  this.hookOutput = runPromptHook(this.projectDirectory);
});

When('the readiness pointer is rendered', { timeout: 30_000 }, function (this: ReadinessWorld) {
  assert.ok(this.projectDirectory, 'project directory was not created');
  this.hookOutput = runPromptHook(this.projectDirectory);
  const pointerLine = this.hookOutput
    .split('\n')
    .find(outputLine => outputLine.includes(POINTER_SIGNATURE));
  assert.ok(pointerLine, `readiness pointer was not rendered:\n${this.hookOutput}`);
  this.renderedPointer = pointerLine.replace(/^-\s*/, '').trim();
});

When('the intake guidance is read', function (this: ReadinessWorld) {
  assert.ok(this.safewordPath, 'SAFEWORD.md path was not set');
  this.safewordContent = readFileSync(this.safewordPath, 'utf8');
});

Then('it includes the five-dimension readiness pointer', function (this: ReadinessWorld) {
  assert.ok(
    (this.hookOutput ?? '').includes(POINTER_SIGNATURE),
    `expected the readiness pointer in:\n${this.hookOutput}`,
  );
});

Then('it shows the implement-phase TDD-step guidance', function (this: ReadinessWorld) {
  assert.match(this.hookOutput ?? '', /TDD:/);
});

Then('it does not include the readiness pointer', function (this: ReadinessWorld) {
  assert.ok(
    !(this.hookOutput ?? '').includes(POINTER_SIGNATURE),
    `did not expect the readiness pointer in:\n${this.hookOutput}`,
  );
});

Then(
  'it names intent, done, constraints, riskiest assumption, and request shape',
  function (this: ReadinessWorld) {
    const pointer = (this.renderedPointer ?? '').toLowerCase();
    for (const token of [
      'intent',
      'done',
      'must not break',
      'riskiest assumption',
      'problem or guess',
    ]) {
      assert.ok(pointer.includes(token), `pointer is missing "${token}": ${this.renderedPointer}`);
    }
  },
);

Then('the pointer text stays within the length cap', function (this: ReadinessWorld) {
  const words = (this.renderedPointer ?? '').split(/\s+/).filter(Boolean).length;
  assert.ok(
    words <= POINTER_WORD_CAP,
    `pointer has ${words} words, cap is ${POINTER_WORD_CAP}: ${this.renderedPointer}`,
  );
});

Then(
  'the constraint dimension reads as {string} rather than a general quality-attributes survey',
  function (this: ReadinessWorld, phrasing: string) {
    const pointer = (this.renderedPointer ?? '').toLowerCase();
    assert.ok(
      pointer.includes(phrasing.toLowerCase()),
      `pointer missing constraint phrasing "${phrasing}": ${this.renderedPointer}`,
    );
    assert.ok(pointer.includes('revers'), 'constraint dimension should mention reversibility');
    assert.ok(
      !pointer.includes('quality attribute'),
      'constraint dimension should not be a quality-attributes survey',
    );
  },
);

Then(
  'it states the triage that reversible work proceeds and irreversible work resolves unknowns first',
  function (this: ReadinessWorld) {
    const content = (this.safewordContent ?? '').toLowerCase();
    assert.ok(content.includes('reversible'), 'SAFEWORD.md should mention reversible work');
    assert.ok(content.includes('irreversible'), 'SAFEWORD.md should mention irreversible work');
  },
);

Then(
  'it defines readiness as remaining questions being edge-cases, not basics',
  function (this: ReadinessWorld) {
    const content = (this.safewordContent ?? '').toLowerCase();
    assert.ok(content.includes('edge-case'), 'SAFEWORD.md should frame readiness as edge-cases');
    assert.ok(content.includes('not basics'), 'SAFEWORD.md should say "not basics"');
  },
);
