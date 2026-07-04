import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { CliResult, SafewordWorld } from './world.js';

const execFileAsync = promisify(execFile);
const CLI_PATH = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const HEALTH_CHECK_DEVELOPMENT_DEPS = {
  '@cucumber/cucumber': '^13.0.0',
  '@types/node': '^24.0.0',
  'dependency-cruiser': '^17.0.0',
  eslint: '^9.22.0',
  jiti: '^2.2.0',
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

interface CliSpawnFailure {
  code?: number | string;
  signal?: string;
  killed?: boolean;
  message?: string;
}

interface CliRun {
  stdout: string;
  stderr: string;
  exitCode: number;
  /**
   * True only for the transient infra signature: the subprocess was KILLED
   * (timeout → SIGTERM, or OOM) AND produced no output at all. A real non-zero
   * exit prints diagnostics (`stderr` non-empty), so this never matches a
   * genuine "check found problems" or an assertion-relevant result.
   */
  killedWithNoOutput: boolean;
  failure?: CliSpawnFailure;
}

async function runCliOnce(argumentLine: string, cwd: string): Promise<CliRun> {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [CLI_PATH, ...argumentLine.split(' ')],
      { cwd, timeout: 30_000, maxBuffer: 16 * 1024 * 1024 },
    );
    return { stdout, stderr, exitCode: 0, killedWithNoOutput: false };
  } catch (error: unknown) {
    const failure = error as CliSpawnFailure & { stdout?: string; stderr?: string };
    const stdout = failure.stdout ?? '';
    const stderr = failure.stderr ?? '';
    const killedWithNoOutput =
      stdout === '' && stderr === '' && (failure.killed === true || Boolean(failure.signal));
    return {
      stdout,
      stderr,
      exitCode: typeof failure.code === 'number' ? failure.code : 1,
      killedWithNoOutput,
      failure,
    };
  }
}

/**
 * Run the CLI with the single-retry infra-kill policy and fold the no-output
 * diagnostic into the returned result — the world-facing outcome the step records.
 *
 * A ~1s CLI command that is SIGTERM-killed with NO output is the infra-contention
 * signature — starved past its 30s timeout under concurrent test load
 * (deterministic locally, flaky on a shared CI runner), not a product failure.
 * Retry that one signature exactly once; a content mismatch (output present but
 * wrong) and a genuine hang (the retry times out too) both still fail. Scoped to
 * empty output as a cold-start proxy: a command killed before its first byte of
 * output almost certainly died before any side effect. That proxy holds for the
 * commands this step drives today (read-only `check`, stdout-printing `codify`);
 * a future command that mutates the temp dir before printing anything would need
 * a tighter guard before it could be retried. Chosen via /figure-it-out
 * (2026-07-04) over a blanket timeout bump / cucumber --retry, both of which
 * would mask real failures rather than only the transient infra-kill.
 */
async function runCli(argumentLine: string, cwd: string): Promise<CliResult> {
  let run = await runCliOnce(argumentLine, cwd);
  const retried = run.killedWithNoOutput;
  if (retried) {
    run = await runCliOnce(argumentLine, cwd);
  }

  // On a FAILED run with no output, the subprocess never reported — killed
  // (OOM/timeout → signal), crashed, or failed to spawn (missing dist → ENOENT).
  // Preserve that diagnostic instead of a blank, so a rare failure is debuggable
  // rather than a confusing "output does not contain X" with nothing to go on.
  // Gated on `run.failure` (set only on the catch path) so a silently-succeeding
  // command doesn't get a spurious "[no subprocess output] code=undefined" tag.
  const retrySuffix = retried ? ' after 1 retry' : '';
  const noOutputDiagnostic =
    run.failure !== undefined && run.stdout === '' && run.stderr === ''
      ? `[no subprocess output${retrySuffix}] code=${String(run.failure.code)} signal=${String(run.failure.signal)} killed=${String(run.failure.killed)} cli=${CLI_PATH}: ${run.failure.message ?? ''}`
      : '';
  return {
    stdout: run.stdout,
    stderr: `${run.stderr}${noOutputDiagnostic}`,
    exitCode: run.exitCode,
  };
}

When('I run {string}', async function (this: SafewordWorld, argumentLine: string) {
  this.result = await runCli(argumentLine, this.temporaryDirectory);
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
