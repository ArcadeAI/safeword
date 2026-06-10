import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const execFileAsync = promisify(execFile);
const CLI_PATH = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');

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

Given('a ticket {string} with one scenario', function (this: SafewordWorld, id: string) {
  this.temporaryDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-bdd-'));
  const ticketDirectory = nodePath.join(
    this.temporaryDirectory,
    '.safeword-project',
    'tickets',
    id,
  );
  mkdirSync(ticketDirectory, { recursive: true });
  writeFileSync(nodePath.join(ticketDirectory, 'test-definitions.md'), DEMO_DEFINITIONS);
});

When('I run {string}', async function (this: SafewordWorld, argumentLine: string) {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [CLI_PATH, ...argumentLine.split(' ')],
      { cwd: this.temporaryDirectory },
    );
    this.result = { stdout, stderr, exitCode: 0 };
  } catch (error: unknown) {
    const failure = error as { stdout?: string; stderr?: string; code?: number };
    this.result = {
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? '',
      exitCode: failure.code ?? 1,
    };
  }
});

Then('the output contains {string}', function (this: SafewordWorld, text: string) {
  assert.ok(
    this.result.stdout.includes(text),
    `expected stdout to contain "${text}"\n--- stdout ---\n${this.result.stdout}\n--- stderr ---\n${this.result.stderr}`,
  );
});

After(function (this: SafewordWorld) {
  if (this.temporaryDirectory !== '') {
    rmSync(this.temporaryDirectory, { recursive: true, force: true });
  }
});
