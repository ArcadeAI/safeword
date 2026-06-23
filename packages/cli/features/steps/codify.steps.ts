import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const execFileAsync = promisify(execFile);
const CLI_PATH = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const HEALTH_CHECK_DEVELOPMENT_DEPS = {
  '@cucumber/cucumber': '^13.0.0',
  '@types/node': '^24.0.0',
  'dependency-cruiser': '^17.0.0',
  eslint: '^9.22.0',
  knip: '^6.0.0',
  prettier: '^3.0.0',
  safeword: '0.0.0',
  tsx: '^4.0.0',
};

const DEMO_DEFINITIONS = [
  '# Demo',
  '',
  '## Rule: demo',
  '',
  '### Scenario: demo.DEV1.AC1.one',
  '',
  'Given a',
  'When b',
  'Then c',
  '',
  '- [ ] RED',
  '',
].join('\n');

/** A fresh, isolated temp project directory for one scenario. */
function freshTemporaryDirectory(): string {
  return mkdtempSync(nodePath.join(tmpdir(), 'safeword-bdd-'));
}

/** Write `features/demo.feature` with the given Gherkin content. */
function writeFeatureFile(world: SafewordWorld, content: string): void {
  const featuresDirectory = nodePath.join(world.temporaryDirectory, 'features');
  mkdirSync(featuresDirectory, { recursive: true });
  writeFileSync(nodePath.join(featuresDirectory, 'demo.feature'), content);
}

Given('a ticket {string} with one scenario', function (this: SafewordWorld, id: string) {
  this.temporaryDirectory = freshTemporaryDirectory();
  const ticketDirectory = nodePath.join(
    this.temporaryDirectory,
    '.safeword-project',
    'tickets',
    id,
  );
  mkdirSync(ticketDirectory, { recursive: true });
  writeFileSync(nodePath.join(ticketDirectory, 'test-definitions.md'), DEMO_DEFINITIONS);
});

Given('a ticket {string} with two acceptance criteria', function (this: SafewordWorld, id: string) {
  this.temporaryDirectory = freshTemporaryDirectory();
  const ticketDirectory = nodePath.join(
    this.temporaryDirectory,
    '.project',
    'tickets',
    `${id}-demo`,
  );
  mkdirSync(ticketDirectory, { recursive: true });
  mkdirSync(nodePath.join(this.temporaryDirectory, '.safeword'), { recursive: true });
  mkdirSync(nodePath.join(this.temporaryDirectory, '.claude'), { recursive: true });
  writeFileSync(
    nodePath.join(this.temporaryDirectory, 'package.json'),
    JSON.stringify({ devDependencies: HEALTH_CHECK_DEVELOPMENT_DEPS }, undefined, 2),
  );
  writeFileSync(nodePath.join(this.temporaryDirectory, '.safeword', 'version'), '0.0.0');
  writeFileSync(
    nodePath.join(this.temporaryDirectory, '.safeword', 'config.json'),
    JSON.stringify({ installedPacks: ['typescript'] }, undefined, 2),
  );
  writeFileSync(nodePath.join(this.temporaryDirectory, '.claude', 'settings.json'), '{}');
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    ['---', `id: ${id}`, 'type: feature', 'status: in_progress', '---', ''].join('\n'),
  );
  writeFileSync(
    nodePath.join(ticketDirectory, 'spec.md'),
    [
      '# Spec',
      '',
      '## Jobs To Be Done',
      '',
      '### demo.SM1 - Trace',
      '',
      '**Persona:** SM',
      '',
      '#### demo.SM1.AC1 - capability one',
      '',
      '#### demo.SM1.AC2 - capability two',
      '',
    ].join('\n'),
  );
});

Given(
  'a feature source for {string} that covers {string}',
  function (this: SafewordWorld, _id: string, acReference: string) {
    writeFeatureFile(
      this,
      [
        'Feature: Demo',
        '',
        '  Rule: r',
        '',
        `    @${acReference}`,
        '    Scenario: feature source coverage',
        '      Given a',
        '      When b',
        '      Then c',
        '',
      ].join('\n'),
    );
  },
);

Given(
  'a ticket {string} with a feature source containing two scenarios',
  function (this: SafewordWorld, id: string) {
    this.temporaryDirectory = freshTemporaryDirectory();
    const ticketDirectory = nodePath.join(
      this.temporaryDirectory,
      '.safeword-project',
      'tickets',
      `${id}-demo`,
    );
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(nodePath.join(ticketDirectory, 'ticket.md'), '# demo');
    writeFeatureFile(
      this,
      [
        'Feature: Demo feature source',
        '',
        '  Rule: source rule',
        '',
        '    @demo.SM1.AC1',
        '    Scenario: demo.SM1.AC1.feature_source_one',
        '      Given a feature file',
        '      When codify runs',
        '      Then a Vitest test is emitted',
        '',
        '    @demo.SM1.AC1',
        '    Scenario: demo.SM1.AC1.feature_source_two',
        '      Given a second scenario',
        '      When codify runs',
        '      Then another Vitest test is emitted',
        '',
      ].join('\n'),
    );
  },
);

Given(
  'a ticket {string} with a Scenario Outline feature source',
  function (this: SafewordWorld, id: string) {
    this.temporaryDirectory = freshTemporaryDirectory();
    const ticketDirectory = nodePath.join(
      this.temporaryDirectory,
      '.safeword-project',
      'tickets',
      `${id}-demo`,
    );
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(nodePath.join(ticketDirectory, 'ticket.md'), '# demo');
    writeFeatureFile(
      this,
      [
        'Feature: Demo feature source',
        '',
        '  Rule: source rule',
        '',
        '    @demo.SM1.AC1',
        '    Scenario Outline: demo.SM1.AC1.outline_source',
        '      Given a <source> feature file',
        '      Then codify emits <result>',
        '',
        '      Examples: source rows',
        '        | source | result       |',
        '        | valid  | a test stub  |',
        '        | tagged | coverage tag |',
        '',
      ].join('\n'),
    );
  },
);

Given('an invalid feature source for {string}', function (this: SafewordWorld, _id: string) {
  writeFeatureFile(
    this,
    ['Feature: Broken', '  Rule: r', '    Scenario: bad', '      Given ok', '      nope', ''].join(
      '\n',
    ),
  );
});

Given('the safeword skill templates', function (this: SafewordWorld) {
  this.temporaryDirectory = '';
});

When('I run {string}', async function (this: SafewordWorld, argumentLine: string) {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [CLI_PATH, ...argumentLine.split(' ')],
      { cwd: this.temporaryDirectory, timeout: 30_000, maxBuffer: 16 * 1024 * 1024 },
    );
    this.result = { stdout, stderr, exitCode: 0 };
  } catch (error: unknown) {
    const failure = error as {
      stdout?: string;
      stderr?: string;
      code?: number | string;
      signal?: string;
      killed?: boolean;
      message?: string;
    };
    const stdout = failure.stdout ?? '';
    const stderr = failure.stderr ?? '';
    // A non-zero exit that still produced output is the normal "check found
    // problems" path. Empty output means the subprocess never reported — it
    // crashed, was killed (OOM/timeout → signal), or failed to spawn (missing
    // dist → ENOENT). Preserve that diagnostic instead of a blank, so a rare CI
    // flake is debuggable rather than a confusing "output does not contain X"
    // with nothing to go on.
    const noOutputDiagnostic =
      stdout === '' && stderr === ''
        ? `[no subprocess output] code=${String(failure.code)} signal=${String(failure.signal)} killed=${String(failure.killed)} cli=${CLI_PATH}: ${failure.message ?? ''}`
        : '';
    this.result = {
      stdout,
      stderr: `${stderr}${noOutputDiagnostic}`,
      exitCode: typeof failure.code === 'number' ? failure.code : 1,
    };
  }
});

Then('the output contains {string}', function (this: SafewordWorld, text: string) {
  const combined = `${this.result.stdout}${this.result.stderr}`;
  assert.ok(
    combined.includes(text),
    `expected output to contain "${text}"\n--- stdout ---\n${this.result.stdout}\n--- stderr ---\n${this.result.stderr}`,
  );
});

Then('the output does not contain {string}', function (this: SafewordWorld, text: string) {
  const combined = `${this.result.stdout}${this.result.stderr}`;
  assert.ok(
    !combined.includes(text),
    `expected output not to contain "${text}"\n--- stdout ---\n${this.result.stdout}\n--- stderr ---\n${this.result.stderr}`,
  );
});

When('I inspect the BDD scenario instructions', function (this: SafewordWorld) {
  const template = readFileSync(
    nodePath.join(REPO_ROOT, 'packages/cli/templates/skills/bdd/SCENARIOS.md'),
    'utf8',
  );
  const review = readFileSync(
    nodePath.join(REPO_ROOT, 'packages/cli/templates/skills/review-spec/SKILL.md'),
    'utf8',
  );
  this.result = { stdout: `${template}\n${review}`, stderr: '', exitCode: 0 };
});

After(function (this: SafewordWorld) {
  if (this.temporaryDirectory !== '') {
    rmSync(this.temporaryDirectory, { recursive: true, force: true });
  }
});
