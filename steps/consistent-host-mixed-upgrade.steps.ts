import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';

import { CLAUDE_HISTORICAL_CATALOGUE } from '../packages/cli/src/claude-plugin/historical-catalogue.generated.js';
import { historicalHookEntry } from '../packages/cli/src/claude-plugin/historical-ownership.js';
import { ClaudeNativeContractActor } from '../packages/cli/tests/helpers/claude-native-contract.js';
import { readHistoricalTemplate } from '../packages/cli/tests/helpers/git-history.js';
import type { SafewordWorld } from './world.js';

const legacySkill = '.claude/skills/bdd/DISCOVERY.md';
const customerFiles = {
  '.project/tickets/customer/ticket.md': '# Customer ticket\n',
  '.project/learnings/customer.md': '# Customer learning\n',
  '.cursor/rules/customer.mdc': 'Customer Cursor rule.\n',
};
const customerSettings = { env: { CUSTOM_SETTING: 'keep' } };
interface MixedWorld extends SafewordWorld {
  migration?: ClaudeNativeContractActor;
  profile?: string;
  transaction?: string;
}

async function prepareActor(world: MixedWorld) {
  const descriptor = process.env.SAFEWORD_CLAUDE_TEST_CONFIG;
  assert.ok(descriptor, 'The mixed-host upgrade requires a prepared native Claude fixture');
  const fixture = JSON.parse(readFileSync(descriptor, 'utf8'));
  const actor = new ClaudeNativeContractActor(fixture);
  await actor.prepare();
  world.migration = actor;
  world.profile = fixture.profile;
  return actor;
}

function seedMixedProject(actor: ClaudeNativeContractActor) {
  const fingerprint = CLAUDE_HISTORICAL_CATALOGUE.releases['0.72.0'].hooks.SessionStart[0];
  assert.ok(fingerprint);
  for (const [file, contents] of Object.entries({
    ...customerFiles,
    [legacySkill]: readHistoricalTemplate('0.72.0', legacySkill),
    '.claude/settings.json': JSON.stringify({
      ...customerSettings,
      hooks: { SessionStart: [historicalHookEntry(fingerprint)] },
    }),
  })) {
    const target = path.join(actor.project, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }
}

Given(
  'a mixed-host project contains authored tickets, learnings, modified settings, and unrelated host assets',
  { timeout: 120_000 },
  async function (this: MixedWorld) {
    seedMixedProject(await prepareActor(this));
  },
);

When(
  'Safeword upgrades proven-owned framework delivery',
  { timeout: 300_000 },
  async function (this: MixedWorld) {
    assert.ok(this.migration);
    await this.migration.turn('Reply with OK.', '', 'mixed-upgrade');
  },
);

Then(
  'those user-owned contents remain unchanged while the proven-owned legacy delivery is inactive and exactly one replacement framework authority remains',
  function (this: MixedWorld) {
    const actor = this.migration;
    assert.ok(actor);
    assertMigratedProject(actor);
    assertNativeAuthority(actor, 'mixed-upgrade');
  },
);

function assertNativeAuthority(actor: ClaudeNativeContractActor, capture: string) {
  const init = actor.events(capture).find(row => row.type === 'system' && row.subtype === 'init');
  assert.ok(init?.session_id);
  assert.equal(init.plugins?.filter(plugin => plugin.name === 'safeword').length, 1);
  assert.ok(
    actor
      .observations()
      .some(
        row =>
          row.input.session_id === init.session_id &&
          row.input.hook_event_name === 'UserPromptSubmit' &&
          row.status === 0,
      ),
  );
}

function assertMigratedProject(actor: ClaudeNativeContractActor) {
  for (const [relative, contents] of Object.entries(customerFiles)) {
    assert.equal(readFileSync(path.join(actor.project, relative), 'utf8'), contents);
  }
  assert.deepEqual(
    JSON.parse(readFileSync(path.join(actor.project, '.claude/settings.json'), 'utf8')),
    { ...customerSettings, hooks: { SessionStart: [] } },
  );
  assert.equal(existsSync(path.join(actor.project, legacySkill)), false);
}

Given(
  'migration stopped after a usable replacement was installed but before legacy cleanup completed',
  { timeout: 300_000 },
  async function (this: MixedWorld) {
    const actor = await prepareActor(this);
    await actor.proveWrite('denied');
    seedMixedProject(actor);
    const script = path.resolve(
      import.meta.dirname,
      '../packages/cli/tests/fixtures/host-contract/interrupt-claude-cleanup.ts',
    );
    const stopped = spawnSync('bun', [script], {
      cwd: actor.project,
      encoding: 'utf8',
      timeout: 65_000,
      env: {
        PATH: process.env.PATH,
        HOME: actor.directory,
        CLAUDE_CONFIG_DIR: this.profile,
        CLAUDE_PROJECT_DIR: actor.project,
      },
    });
    assert.equal(stopped.signal, 'SIGKILL', stopped.stderr);
    this.transaction = stopped.stdout.trim();
    const journal = JSON.parse(readFileSync(this.transaction, 'utf8'));
    assert.equal(journal.owner_pid, stopped.pid);
    assert.equal(journal.state, 'active');
    assert.ok(existsSync(path.join(actor.project, legacySkill)));
    await actor.prepare();
  },
);
When('the supported recovery operation runs', function (this: MixedWorld) {
  const actor = this.migration;
  assert.ok(actor && this.profile && this.transaction);
  const cli = path.resolve(import.meta.dirname, '../packages/cli/src/cli.ts');
  const output = execFileSync('bun', [cli, 'claude', 'recover', '--json'], {
    cwd: actor.project,
    encoding: 'utf8',
    timeout: 30_000,
    env: {
      PATH: process.env.PATH,
      HOME: actor.directory,
      CLAUDE_CONFIG_DIR: this.profile,
      CLAUDE_PROJECT_DIR: actor.project,
    },
  });
  const result = JSON.parse(output);
  assert.deepEqual(result.errors, []);
  assert.equal(result.state, 'changed');
  assert.equal(existsSync(this.transaction), false);
});
Then(
  'it converges on one verified authority while preserving user-owned content',
  { timeout: 300_000 },
  async function (this: MixedWorld) {
    const actor = this.migration;
    assert.ok(actor);
    assertMigratedProject(actor);
    await actor.proveWrite('allowed');
    assertNativeAuthority(actor, 'allowed');
    assertMigratedProject(actor);
  },
);
