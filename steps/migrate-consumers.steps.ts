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
 * Shared repository/toolchain fixtures live in test-plan-resolver.steps.ts; Cucumber loads
 * both files into the same SafewordWorld for this feature.
 */

import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { runTests, type TestResult } from '../packages/cli/templates/hooks/lib/test-runner.js';
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

const repoRoot = nodePath.resolve(import.meta.dirname, '..');

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
  const cliPath = nodePath.join(repoRoot, 'packages/cli/src/cli.ts');
  const target = ensureRoot(world);
  return execFileSync(
    'bun',
    [cliPath, 'project', 'test-plan', target, '--kind', kind, '--format', 'sh'],
    {
      cwd: repoRoot,
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
  let fenceMarker: string | undefined;
  let sectionHeadingDepth: number | undefined;
  const sectionLines: string[] = [];
  for (const line of lines) {
    const fence = /^\s*(`{3,}|~{3,})/u.exec(line)?.[1];
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
    else {
      const markerCharacter = fenceMarker[0];
      const closingFence = new RegExp(`^\\s*${markerCharacter}{${fenceMarker.length},}\\s*$`, 'u');
      if (closingFence.test(line)) fenceMarker = undefined;
    }
  }
  return sectionLines.join('\n');
}

function verifySection(world: MigrateConsumersWorld, sectionNumber: number): string {
  const section = extractSection(world.verifySkillContent ?? '', sectionNumber);
  assert.notEqual(section, '', `verify section ${sectionNumber} was not found`);
  assert.match(section, new RegExp(`^#{1,6}\\s+${sectionNumber}[.\\s]`, 'u'));
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
  assert.ok(
    !this.fakeTools?.startsWith('none:'),
    'cannot combine installed and not-installed toolchain fixtures in one scenario',
  );
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
    write(this, 'package-lock.json', '{}\n');
    write(this, 'package.json', JSON.stringify({ scripts: { [scriptName]: `echo ${output}` } }));
  },
);

Given(
  'a repo with a root {string} script that exits non-zero',
  function (this: MigrateConsumersWorld, scriptName: string) {
    write(this, 'package-lock.json', '{}\n');
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
    const runnableLines = plan
      .split('\n')
      .map(line => line.replace(/'[^']*'/gu, ''))
      .filter(line => line.includes(cmd));
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

Then('the rendered plan is empty', function (this: MigrateConsumersWorld) {
  assert.equal(this.shellPlan, '');
});

// ============================================================================
// SM1.AC1 — test-runner.ts structural check
// ============================================================================

When(/^I read templates\/hooks\/lib\/test-runner\.ts$/, function (this: MigrateConsumersWorld) {
  const path = nodePath.join(repoRoot, 'packages/cli/templates/hooks/lib/test-runner.ts');
  this.fileContent = readFileSync(path, 'utf8');
  const dogfoodPath = nodePath.join(repoRoot, '.safeword/hooks/lib/test-runner.ts');
  assert.equal(
    readFileSync(dogfoodPath, 'utf8'),
    this.fileContent,
    'dogfood and template test runners differ',
  );
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
    ensureRoot(this);
  },
);

When('the stop-hook test runner runs', function (this: MigrateConsumersWorld) {
  const previousCli = process.env.SAFEWORD_CLI;
  const previousFakeTools = process.env.SAFEWORD_FAKE_TOOLS;
  const previousNodeEnvironment = process.env.NODE_ENV;
  process.env.SAFEWORD_CLI = nodePath.join(repoRoot, 'packages/cli/src/cli.ts');
  process.env.SAFEWORD_FAKE_TOOLS = this.fakeTools ?? 'all';
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

Then('the stop-hook reports the failing suite and blocks', function (this: MigrateConsumersWorld) {
  assert.equal(this.stopHookResult?.passed, false, this.stopHookResult?.output);
  assert.equal(this.stopHookResult?.skipped, false);
  assert.notEqual(this.stopHookResult?.resolutionFailed, true, this.stopHookResult?.output);
  assert.match(this.stopHookResult?.output ?? '', /\$ (?:bun|npm|pnpm|yarn).*test/iu);
});

Then('the stop-hook reports the missing runner and blocks', function (this: MigrateConsumersWorld) {
  assert.equal(this.stopHookResult?.passed, false, this.stopHookResult?.output);
  assert.equal(this.stopHookResult?.skipped, false);
  assert.notEqual(this.stopHookResult?.resolutionFailed, true, this.stopHookResult?.output);
  assert.equal(this.stopHookResult?.toolchainMissing, true, this.stopHookResult?.output);
  assert.match(this.stopHookResult?.output ?? '', /Go test lane skipped: go is not installed\./u);
});

Then('it reports skipped and does not block', function (this: MigrateConsumersWorld) {
  assert.deepEqual(this.stopHookResult, { passed: true, output: '', skipped: true });
});

// ============================================================================
// SM1.AC2 — /verify skill structural check
// ============================================================================

When('I read the verify source surfaces', function (this: MigrateConsumersWorld) {
  const skillPath = nodePath.join(repoRoot, 'packages/cli/templates/skills/verify/SKILL.md');
  const commandPath = nodePath.join(repoRoot, 'packages/cli/templates/commands/verify.md');
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
    // This scenario pins ownership and structure. packages/cli/tests/verify-skill.test.ts
    // separately executes the extracted shell blocks and proves exit-code propagation.
    const [namespace, command, formatFlag, format] = expected.split(' ');
    assert.ok(
      namespace && command && formatFlag && format,
      `invalid expected command: ${expected}`,
    );
    const sectionText = verifySection(this, section);
    assert.ok(
      sectionText.includes(
        `plan="$(run_safeword ${namespace} ${command} --kind "$plan_kind" ${formatFlag} ${format})"`,
      ),
      `section ${section} does not resolve "${expected}"\n---\n${sectionText.slice(0, 300)}`,
    );
    assert.match(sectionText, /\n {2}bash -c "\$plan"\n\}/u);
    assert.match(sectionText, /if \[ "\$rc" -ne 0 \]; then[\s\S]*return "\$rc"/u);
    assert.match(sectionText, /exit "\$verification_status"/u);
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
