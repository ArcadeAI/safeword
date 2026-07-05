/**
 * Acceptance steps for F9W3JP — `ticket new --parent` epic-child linker.
 * Black-box: drives the built CLI in a temp project (only the process boundary
 * is real). Internal contracts with no CLI surface — findNextWork navigation
 * and append idempotency — are proven in vitest (see the .feature comments).
 */

import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const execFileAsync = promisify(execFile);
const CLI_PATH = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');

// Before-image captured before a mutating step so a later Then can assert the
// target was untouched. Scenarios run serially, so a module object is safe.
const scenarioState = { taskBefore: '' };

function ticketsDirectoryOf(world: SafewordWorld): string {
  return nodePath.join(world.temporaryDirectory, '.project', 'tickets');
}

function folderBySlug(world: SafewordWorld, slug: string): string {
  const match = readdirSync(ticketsDirectoryOf(world)).find(entry => entry.endsWith(`-${slug}`));
  if (match === undefined) throw new Error(`no ticket folder for slug ${slug}`);
  return nodePath.join(ticketsDirectoryOf(world), match);
}

function idBySlug(world: SafewordWorld, slug: string): string {
  const [id] = nodePath.basename(folderBySlug(world, slug)).split('-');
  if (id === undefined) throw new Error(`no id for slug ${slug}`);
  return id;
}

function readTicket(world: SafewordWorld, slug: string): string {
  return readFileSync(nodePath.join(folderBySlug(world, slug), 'ticket.md'), 'utf8');
}

async function runCli(world: SafewordWorld, args: string[]): Promise<void> {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [CLI_PATH, ...args], {
      cwd: world.temporaryDirectory,
    });
    world.result = { stdout, stderr, exitCode: 0 };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; code?: number };
    world.result = {
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? '',
      exitCode: failure.code ?? 1,
    };
  }
}

function newTicket(world: SafewordWorld, args: string[]): Promise<void> {
  return runCli(world, ['ticket', 'new', ...args]);
}

function freshProject(world: SafewordWorld): void {
  world.temporaryDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-epic-link-'));
}

After(function (this: SafewordWorld) {
  if (this.temporaryDirectory) rmSync(this.temporaryDirectory, { recursive: true, force: true });
});

Given('an epic ticket with an empty children list', async function (this: SafewordWorld) {
  freshProject(this);
  await newTicket(this, ['the-epic', '--type', 'epic']);
});

Given('an epic and a child linked to it with --parent', async function (this: SafewordWorld) {
  freshProject(this);
  await newTicket(this, ['the-epic', '--type', 'epic']);
  await newTicket(this, ['the-child', '--parent', idBySlug(this, 'the-epic')]);
});

Given('no ticket exists with the id {string}', function (this: SafewordWorld, _missingId: string) {
  freshProject(this);
});

Given('a task ticket that is not an epic', async function (this: SafewordWorld) {
  freshProject(this);
  await newTicket(this, ['a-task', '--type', 'task']);
});

Given('an epic whose children list already names one child', async function (this: SafewordWorld) {
  freshProject(this);
  await newTicket(this, ['the-epic', '--type', 'epic']);
  await newTicket(this, ['first-child', '--parent', idBySlug(this, 'the-epic')]);
});

When(
  'I create a child ticket with --parent naming that epic',
  async function (this: SafewordWorld) {
    await newTicket(this, ['the-child', '--parent', idBySlug(this, 'the-epic')]);
  },
);

When(
  'I create a child ticket with --parent {string}',
  async function (this: SafewordWorld, epicId: string) {
    await newTicket(this, ['orphan', '--parent', epicId]);
  },
);

When(
  'I create a child ticket with --parent naming that task',
  async function (this: SafewordWorld) {
    scenarioState.taskBefore = readTicket(this, 'a-task');
    await newTicket(this, ['the-child', '--parent', idBySlug(this, 'a-task')]);
  },
);

When('I link a second child to that epic with --parent', async function (this: SafewordWorld) {
  await newTicket(this, ['second-child', '--parent', idBySlug(this, 'the-epic')]);
});

When('the ticket index is regenerated', async function (this: SafewordWorld) {
  await runCli(this, ['sync-tickets']);
});

Then("the child's parent field names the epic", function (this: SafewordWorld) {
  assert.ok(readTicket(this, 'the-child').includes(`parent: ${idBySlug(this, 'the-epic')}`));
});

Then("the epic's children list contains the new child's id", function (this: SafewordWorld) {
  assert.ok(readTicket(this, 'the-epic').includes(idBySlug(this, 'the-child')));
});

Then("the child is listed under the epic's heading", function (this: SafewordWorld) {
  const epicId = idBySlug(this, 'the-epic');
  const childId = idBySlug(this, 'the-child');
  const index = readFileSync(nodePath.join(ticketsDirectoryOf(this), 'INDEX.md'), 'utf8');
  const start = index.indexOf(`### ${epicId}`);
  assert.ok(start !== -1, 'epic heading present');
  const rest = index.slice(start + `### ${epicId}`.length);
  const next = rest.indexOf('\n### ');
  const block = next === -1 ? rest : rest.slice(0, next);
  assert.ok(block.includes(childId), 'child under epic heading');
});

Then('the command exits non-zero reporting the epic was not found', function (this: SafewordWorld) {
  assert.notEqual(this.result.exitCode, 0);
  assert.match(this.result.stderr, /not found|ZZZZZZ/);
});

Then(
  'the command exits non-zero reporting the parent is not an epic',
  function (this: SafewordWorld) {
    assert.notEqual(this.result.exitCode, 0);
    assert.match(this.result.stderr, /not an epic/);
  },
);

Then('no child ticket folder is created', function (this: SafewordWorld) {
  const directory = ticketsDirectoryOf(this);
  const entries = existsSync(directory) ? readdirSync(directory) : [];
  const orphan = entries.some(entry => entry.endsWith('-orphan'));
  const child = entries.some(entry => entry.endsWith('-the-child'));
  assert.ok(!orphan && !child, 'no child folder created');
});

Then("the target ticket's frontmatter is unchanged", function (this: SafewordWorld) {
  assert.equal(readTicket(this, 'a-task'), scenarioState.taskBefore);
});

Then("the epic's children list names both children", function (this: SafewordWorld) {
  const epic = readTicket(this, 'the-epic');
  assert.ok(epic.includes(idBySlug(this, 'first-child')), 'first child present');
  assert.ok(epic.includes(idBySlug(this, 'second-child')), 'second child present');
});
