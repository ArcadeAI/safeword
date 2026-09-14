/**
 * Step definitions for features/migrate-consumers-to-test-plan.feature.
 *
 * Covers:
 *   SM1.AC3 — shell plan format/eval scenarios (--format sh output + bash eval)
 *   SM1.AC1 — test-runner.ts structural assertions (no hardcoded language commands)
 *   SM1.AC2 — /verify skill structural assertions (section 2 evals project test-plan, no inline language)
 *
 * TB1.AC1 exercises the real stop-hook runner against temporary projects while pointing
 * its resolver at the local Safeword CLI source.
 */

import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { runTests, type TestResult } from '../.safeword/hooks/lib/test-runner.js';
import type { SafewordWorld } from './world.js';

interface MigrateConsumersWorld extends SafewordWorld {
  root?: string;
  fakeTools?: string;
  shellPlan?: string;
  evalOutput?: string;
  evalExitCode?: number;
  fileContent?: string;
  stopHookResult?: TestResult;
  verifyCommandContent?: string;
  verifySkillContent?: string;
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
  return execFileSync(
    'bun',
    [cliPath, 'project', 'test-plan', target, '--kind', kind, '--format', 'sh'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        SAFEWORD_FAKE_TOOLS: world.fakeTools ?? 'all',
      },
    },
  );
}

/**
 * Extract numbered section N from markdown content.
 * Returns lines from the "### N." heading through the line before the next numbered heading.
 */
function extractSection(content: string, sectionNumber: number): string {
  const lines = content.split('\n');
  let inSection = false;
  let fenceMarker: '```' | '~~~' | undefined;
  let sectionHeadingDepth: number | undefined;
  const sectionLines: string[] = [];
  for (const line of lines) {
    const fence = /^\s*(```|~~~)/u.exec(line)?.[1] as '```' | '~~~' | undefined;
    const heading = fenceMarker === undefined ? /^(#{1,6})\s+/u.exec(line) : null;
    if (inSection && heading !== null && heading[1]!.length <= (sectionHeadingDepth ?? 0)) break;
    const numberedHeading =
      fenceMarker === undefined ? /^(#{1,6})\s+(\d+)[\.\s]/u.exec(line) : null;
    if (!inSection && numberedHeading !== null) {
      const num = Number(numberedHeading[2]);
      if (num === sectionNumber) {
        inSection = true;
        sectionHeadingDepth = numberedHeading[1]!.length;
      }
    }
    if (inSection) sectionLines.push(line);
    if (fenceMarker === undefined) fenceMarker = fence;
    else if (line.trimStart().startsWith(fenceMarker)) fenceMarker = undefined;
  }
  return sectionLines.join('\n');
}

function verifySection(world: MigrateConsumersWorld, sectionNumber: number): string {
  const section = extractSection(world.verifySkillContent ?? '', sectionNumber);
  assert.notEqual(section, '', `verify section ${sectionNumber} was not found`);
  return section;
}

After(function (this: MigrateConsumersWorld) {
  if (this.root !== undefined) {
    rmSync(this.root, { force: true, recursive: true });
  }
});

// ============================================================================
// SM1.AC3 — shell plan format and eval
// ============================================================================

Given('the {string} toolchain is installed', function (this: MigrateConsumersWorld, tool: string) {
  const installed = this.fakeTools?.startsWith('only:')
    ? this.fakeTools.slice('only:'.length).split(',').filter(Boolean)
    : [];
  this.fakeTools = `only:${[...new Set([...installed, tool])].join(',')}`;
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
  'the script contains no runnable {string} command outside that diagnostic',
  function (this: MigrateConsumersWorld, cmd: string) {
    const plan = this.shellPlan ?? '';
    const escapedCommand = cmd.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const diagnostic = new RegExp(
      `'[^'\\n]*lane skipped: ${escapedCommand} is not installed\\.'`,
      'u',
    );
    const runnableLines = plan.split('\n').filter(line => {
      if (!line.includes(cmd)) return false;
      return line.replace(diagnostic, '').includes(cmd);
    });
    assert.equal(
      runnableLines.length,
      0,
      `found runnable "${cmd}" outside diagnostic:\n${runnableLines.join('\n')}`,
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
    return trimmed.length > 0 && !trimmed.startsWith('#');
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
  'it contains no hardcoded {string}, {string}, or {string} command',
  function (this: MigrateConsumersWorld, a: string, b: string, c: string) {
    const content = this.fileContent ?? '';
    for (const cmd of [a, b, c]) {
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
    const [namespace, subcommand] = command.split(' ');
    assert.ok(
      namespace !== undefined &&
        subcommand !== undefined &&
        content.includes(`'${namespace}', '${subcommand}'`),
      `test-runner.ts does not invoke "${command}" via the safeword CLI`,
    );
  },
);

Given(
  'a project whose package.json has a {string} and a {string} script',
  function (this: MigrateConsumersWorld, first: string, second: string) {
    const scripts = {
      [first]: "node -e \"require('fs').writeFileSync('primary.marker', 'ok')\"",
      [second]: "node -e \"require('fs').writeFileSync('bdd.marker', 'ok')\"",
    };
    write(this, 'package-lock.json', '{}\n');
    write(this, 'package.json', `${JSON.stringify({ scripts }, undefined, 2)}\n`);
  },
);

Given(
  'a project with no test script and no language manifest',
  function (this: MigrateConsumersWorld) {
    write(this, 'package-lock.json', '{}\n');
    write(this, 'package.json', `${JSON.stringify({ scripts: {} }, undefined, 2)}\n`);
  },
);

When('the stop-hook test runner runs', function (this: MigrateConsumersWorld) {
  const previousCli = process.env.SAFEWORD_CLI;
  const previousFakeTools = process.env.SAFEWORD_FAKE_TOOLS;
  const previousNodeEnvironment = process.env.NODE_ENV;
  process.env.SAFEWORD_CLI = nodePath.join(process.cwd(), 'packages/cli/src/cli.ts');
  process.env.SAFEWORD_FAKE_TOOLS = 'all';
  process.env.NODE_ENV = 'test';
  try {
    this.stopHookResult = runTests(ensureRoot(this));
  } finally {
    if (previousCli === undefined) delete process.env.SAFEWORD_CLI;
    else process.env.SAFEWORD_CLI = previousCli;
    if (previousFakeTools === undefined) delete process.env.SAFEWORD_FAKE_TOOLS;
    else process.env.SAFEWORD_FAKE_TOOLS = previousFakeTools;
    if (previousNodeEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnvironment;
  }
});

Then(
  'both the test script and the acceptance lane are executed',
  function (this: MigrateConsumersWorld) {
    const root = ensureRoot(this);
    assert.equal(this.stopHookResult?.passed, true, this.stopHookResult?.output);
    assert.equal(this.stopHookResult?.skipped, false);
    assert.ok(existsSync(nodePath.join(root, 'primary.marker')), 'primary test marker is missing');
    assert.ok(existsSync(nodePath.join(root, 'bdd.marker')), 'acceptance marker is missing');
  },
);

Then('it reports skipped and does not block', function (this: MigrateConsumersWorld) {
  assert.deepEqual(this.stopHookResult, { passed: true, output: '', skipped: true });
});

// ============================================================================
// SM1.AC2 — /verify skill structural check
// ============================================================================

When('I read the verify source surfaces', function (this: MigrateConsumersWorld) {
  const skillPath = nodePath.join(process.cwd(), 'packages/cli/templates/skills/verify/SKILL.md');
  const commandPath = nodePath.join(process.cwd(), 'packages/cli/templates/commands/verify.md');
  assert.ok(existsSync(skillPath), `verify skill is missing: ${skillPath}`);
  assert.ok(existsSync(commandPath), `verify command is missing: ${commandPath}`);
  this.verifySkillContent = readFileSync(skillPath, 'utf8');
  this.verifyCommandContent = readFileSync(commandPath, 'utf8');
});

Then('the verify command points to the verify skill', function (this: MigrateConsumersWorld) {
  assert.match(
    this.verifyCommandContent ?? '',
    /\.safeword\/skills\/verify\/SKILL\.md/u,
    'verify command does not point to the canonical verify skill',
  );
});

Then(
  'section {int} of the verify skill evaluates {string}',
  function (this: MigrateConsumersWorld, section: number, expected: string) {
    assert.equal(expected, 'project test-plan --format sh');
    const sectionText = verifySection(this, section);
    assert.ok(
      sectionText.includes(
        'plan="$(run_safeword project test-plan --kind "$plan_kind" --format sh)"',
      ),
      `section ${section} does not resolve "${expected}"\n---\n${sectionText.slice(0, 300)}`,
    );
    assert.match(sectionText, /bash -c "\$plan"/u);
  },
);

Then(
  'section {int} of the verify skill contains no inline language test branch \\({string}, {string}, {string}\\)',
  function (this: MigrateConsumersWorld, section: number, a: string, b: string, c: string) {
    const sectionText = verifySection(this, section);
    for (const cmd of [a, b, c]) {
      assert.ok(
        !sectionText.includes(cmd),
        `section ${section} contains inline language test branch "${cmd}"`,
      );
    }
  },
);

Then(
  'section {int} of the verify skill contains no inline language build branch \\({string}, {string}\\)',
  function (this: MigrateConsumersWorld, section: number, a: string, b: string) {
    const sectionText = verifySection(this, section);
    for (const cmd of [a, b]) {
      assert.ok(
        !sectionText.includes(cmd),
        `section ${section} contains inline language build branch "${cmd}"`,
      );
    }
  },
);
