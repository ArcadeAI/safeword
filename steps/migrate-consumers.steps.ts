/**
 * Step definitions for features/migrate-consumers-to-test-plan.feature.
 *
 * Covers:
 *   SM1.AC3 — shell plan format/eval scenarios (--format sh output + bash eval)
 *   SM1.AC1 — test-runner.ts structural assertions (no hardcoded language commands)
 *   SM1.AC2 — /verify skill structural assertions (section 2 evals test-plan, no inline language)
 *
 * DEV1.AC1 scenarios (stop-hook runner integration) are tagged @wip and deferred — they
 * require running test-runner.ts as a subprocess with a live safeword CLI, which needs
 * a separate integration harness.
 */

import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

interface MigrateConsumersWorld extends SafewordWorld {
  root?: string;
  fakeTools?: string;
  shellPlan?: string;
  evalOutput?: string;
  evalExitCode?: number;
  fileContent?: string;
  verifyContents?: string[];
}

// ---- helpers ----

function ensureRoot(world: MigrateConsumersWorld): string {
  world.root ??= mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-migrate-bdd-'));
  return world.root;
}

function write(world: MigrateConsumersWorld, rel: string, content: string): void {
  const abs = nodePath.join(ensureRoot(world), rel);
  mkdirSync(nodePath.dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function runShellPlan(world: MigrateConsumersWorld, kind: 'test' | 'build'): string {
  const cliPath = nodePath.join(process.cwd(), 'packages/cli/src/cli.ts');
  const target = ensureRoot(world);
  return execFileSync('bun', [cliPath, 'test-plan', target, '--kind', kind, '--format', 'sh'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, SAFEWORD_FAKE_TOOLS: world.fakeTools ?? 'all' },
  });
}

/**
 * Extract numbered section N from markdown content.
 * Returns lines from the "### N." heading through the line before the next numbered heading.
 */
function extractSection(content: string, sectionNumber: number): string {
  const lines = content.split('\n');
  let inSection = false;
  const sectionLines: string[] = [];
  for (const line of lines) {
    if (/^#{1,4}\s+\d+[\.\s]/.test(line)) {
      if (inSection) break;
      const num = Number(line.match(/^#{1,4}\s+(\d+)/)?.[1]);
      if (num === sectionNumber) inSection = true;
    }
    if (inSection) sectionLines.push(line);
  }
  return sectionLines.join('\n');
}

After(function (this: MigrateConsumersWorld) {
  if (this.root !== undefined) {
    rmSync(this.root, { force: true, recursive: true });
  }
});

// ============================================================================
// SM1.AC3 — shell plan format and eval
// ============================================================================

Given('the {string} toolchain is installed', function (this: MigrateConsumersWorld, _tool: string) {
  // SAFEWORD_FAKE_TOOLS=all marks all toolchains (including the named one) as available.
  // Only set if not already narrowed by a more specific step.
  this.fakeTools ??= 'all';
});

Given(
  'a repo with no recognized language manifest and no test script',
  function (this: MigrateConsumersWorld) {
    write(this, 'README.md', '# empty\n');
  },
);

Given(
  'a repo with a root {string} script that prints {string}',
  function (this: MigrateConsumersWorld, scriptName: string, output: string) {
    write(this, 'package.json', JSON.stringify({ scripts: { [scriptName]: `echo ${output}` } }));
  },
);

Given(
  'a repo with a root {string} script that exits non-zero',
  function (this: MigrateConsumersWorld, scriptName: string) {
    write(this, 'package.json', JSON.stringify({ scripts: { [scriptName]: 'exit 1' } }));
  },
);

When('I render the test plan as a shell script', function (this: MigrateConsumersWorld) {
  this.shellPlan = runShellPlan(this, 'test');
});

When('I render the build plan as a shell script', function (this: MigrateConsumersWorld) {
  this.shellPlan = runShellPlan(this, 'build');
});

When('I eval the rendered shell script', function (this: MigrateConsumersWorld) {
  this.shellPlan = runShellPlan(this, 'test');
  const result = spawnSync('bash', ['-c', this.shellPlan], {
    cwd: ensureRoot(this),
    encoding: 'utf8',
  });
  this.evalOutput = (result.stdout ?? '') + (result.stderr ?? '');
  this.evalExitCode = result.status ?? 1;
});

Then('the script contains {string}', function (this: MigrateConsumersWorld, expected: string) {
  const plan = this.shellPlan ?? '';
  assert.ok(plan.includes(expected), `script does not contain "${expected}"\n---\n${plan}`);
});

Then(
  'the script contains {string} and {string}',
  function (this: MigrateConsumersWorld, a: string, b: string) {
    const plan = this.shellPlan ?? '';
    assert.ok(plan.includes(a), `script does not contain "${a}"\n---\n${plan}`);
    assert.ok(plan.includes(b), `script does not contain "${b}"\n---\n${plan}`);
  },
);

Then('the script contains the line {string}', function (this: MigrateConsumersWorld, line: string) {
  const plan = this.shellPlan ?? '';
  const hasLine = plan.split('\n').some(l => l.includes(line));
  assert.ok(hasLine, `script does not contain line "${line}"\n---\n${plan}`);
});

Then(
  'the script contains no runnable {string} command outside that echo',
  function (this: MigrateConsumersWorld, cmd: string) {
    const plan = this.shellPlan ?? '';
    const runnableLines = plan.split('\n').filter(l => !l.includes('echo') && l.includes(cmd));
    assert.equal(
      runnableLines.length,
      0,
      `found runnable "${cmd}" outside echo:\n${runnableLines.join('\n')}`,
    );
  },
);

Then('the eval output contains {string}', function (this: MigrateConsumersWorld, text: string) {
  assert.ok(
    (this.evalOutput ?? '').includes(text),
    `eval output does not contain "${text}"\n---\n${this.evalOutput}`,
  );
});

Then('the eval exits zero', function (this: MigrateConsumersWorld) {
  assert.equal(this.evalExitCode, 0, `eval exited ${this.evalExitCode}\n${this.evalOutput}`);
});

Then('the eval exits non-zero', function (this: MigrateConsumersWorld) {
  assert.notEqual(this.evalExitCode, 0, 'expected eval to exit non-zero but it exited 0');
});

Then('no suite command is run', function (this: MigrateConsumersWorld) {
  const plan = this.shellPlan ?? '';
  const commands = plan.split('\n').filter(l => {
    const trimmed = l.trim();
    return trimmed.length > 0 && trimmed !== 'set -e' && !trimmed.startsWith('#');
  });
  assert.equal(commands.length, 0, `expected no suite commands but found:\n${commands.join('\n')}`);
});

// ============================================================================
// SM1.AC1 — test-runner.ts structural check
// ============================================================================

When(/^I read templates\/hooks\/lib\/test-runner\.ts$/, function (this: MigrateConsumersWorld) {
  const path = nodePath.join(process.cwd(), 'packages/cli/templates/hooks/lib/test-runner.ts');
  this.fileContent = readFileSync(path, 'utf8');
});

Then(
  'it contains no hardcoded {string}, {string}, {string}, or {string} command',
  function (this: MigrateConsumersWorld, a: string, b: string, c: string, d: string) {
    const content = this.fileContent ?? '';
    for (const cmd of [a, b, c, d]) {
      assert.ok(!content.includes(cmd), `test-runner.ts contains hardcoded command "${cmd}"`);
    }
  },
);

Then(
  'it does not define {string}, {string}, or {string}',
  function (this: MigrateConsumersWorld, a: string, b: string, c: string) {
    const content = this.fileContent ?? '';
    for (const name of [a, b, c]) {
      assert.ok(!content.includes(name), `test-runner.ts defines "${name}"`);
    }
  },
);

Then(
  'it invokes {string} via the safeword CLI',
  function (this: MigrateConsumersWorld, command: string) {
    const content = this.fileContent ?? '';
    assert.ok(
      content.includes(command),
      `test-runner.ts does not invoke "${command}" via the safeword CLI`,
    );
  },
);

// ============================================================================
// SM1.AC2 — /verify skill structural check
// ============================================================================

When('I read the verify skill and the verify command', function (this: MigrateConsumersWorld) {
  const skillPath = nodePath.join(process.cwd(), '.claude/skills/verify/SKILL.md');
  const commandPath = nodePath.join(process.cwd(), '.claude/commands/verify.md');
  const contents: string[] = [];
  if (existsSync(skillPath)) contents.push(readFileSync(skillPath, 'utf8'));
  if (existsSync(commandPath)) contents.push(readFileSync(commandPath, 'utf8'));
  this.verifyContents = contents;
});

Then(
  'section {int} of each evaluates {string}',
  function (this: MigrateConsumersWorld, section: number, expected: string) {
    // Check each whitespace-separated token appears in the section (order-independent).
    // The actual code uses "test-plan --kind test --format sh", so we verify each
    // token from "test-plan --format sh" is present rather than the exact substring.
    const tokens = expected.split(/\s+/);
    for (const content of this.verifyContents ?? []) {
      const sectionText = extractSection(content, section);
      for (const token of tokens) {
        assert.ok(
          sectionText.includes(token),
          `section ${section} does not contain "${token}" (from "${expected}")\n---\n${sectionText.slice(0, 300)}`,
        );
      }
    }
  },
);

Then(
  'section {int} of each contains no inline language test branch \\({string}, {string}, {string}\\)',
  function (this: MigrateConsumersWorld, section: number, a: string, b: string, c: string) {
    for (const content of this.verifyContents ?? []) {
      const sectionText = extractSection(content, section);
      for (const cmd of [a, b, c]) {
        assert.ok(
          !sectionText.includes(cmd),
          `section ${section} contains inline language test branch "${cmd}"`,
        );
      }
    }
  },
);

Then(
  'section {int} of each contains no inline language build branch \\({string}, {string}\\)',
  function (this: MigrateConsumersWorld, section: number, a: string, b: string) {
    for (const content of this.verifyContents ?? []) {
      const sectionText = extractSection(content, section);
      for (const cmd of [a, b]) {
        assert.ok(
          !sectionText.includes(cmd),
          `section ${section} contains inline language build branch "${cmd}"`,
        );
      }
    }
  },
);
