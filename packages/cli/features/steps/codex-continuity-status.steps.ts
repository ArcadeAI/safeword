/* eslint-disable complexity, sonarjs/no-alphabetical-sort, unicorn/no-null, unicorn/require-array-sort-compare -- the acceptance table mirrors the explicit migration state matrix */

import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import {
  codexMigrationExitCode,
  type CodexMigrationFacts,
  type CodexMigrationResultV2,
  deriveCodexMigrationResult,
  renderCodexMigrationHuman,
} from '../../src/codex-plugin/migration.ts';
import { SAFEWORD_SCHEMA } from '../../src/schema.ts';
import type { SafewordWorld } from './world.js';

interface ContinuityStatusWorld extends SafewordWorld {
  codexFacts?: CodexMigrationFacts;
  codexStatus?: CodexMigrationResultV2;
  codexStatusOutput?: string;
  codexStatusExitCode?: number;
  codexProtocolOutput?: string;
  codexProtocolStderr?: string;
  runCodexStatus?: () => { stdout: string; stderr: string; exitCode: number };
}

const missingProof: CodexMigrationFacts['proof'] = {
  status: 'missing',
  plugin_version: null,
  manifest_sha256: null,
  recorded_at: null,
  activation_id: null,
  events: [],
  missing_events: ['session-start', 'pre-tool-use', 'post-tool-use', 'user-prompt-submit', 'stop'],
};

const currentProof: CodexMigrationFacts['proof'] = {
  status: 'current',
  plugin_version: SAFEWORD_SCHEMA.version,
  manifest_sha256: 'a'.repeat(64),
  recorded_at: '2026-07-28T00:00:00.000Z',
  activation_id: null,
  events: ['session-start', 'pre-tool-use', 'post-tool-use', 'user-prompt-submit', 'stop'],
  missing_events: [],
};

const partialProof: CodexMigrationFacts['proof'] = {
  ...currentProof,
  status: 'partial',
  events: ['session-start'],
  missing_events: ['pre-tool-use', 'post-tool-use', 'user-prompt-submit', 'stop'],
};

const absentPlugin: CodexMigrationFacts['plugin'] = {
  installed: false,
  enabled: false,
  version: null,
  observation: 'observed',
};

const enabledPlugin: CodexMigrationFacts['plugin'] = {
  installed: true,
  enabled: true,
  version: SAFEWORD_SCHEMA.version,
  observation: 'observed',
};

function facts(overrides: Partial<CodexMigrationFacts> = {}): CodexMigrationFacts {
  return {
    plugin: absentPlugin,
    proof: missingProof,
    legacyAssets: [],
    legacyEvents: [],
    viableLegacyEvents: [],
    finalized: false,
    recoveryRequired: false,
    activationPending: false,
    activationRestartObserved: false,
    activationRestartProven: false,
    ...overrides,
  };
}

function completeLegacy(overrides: Partial<CodexMigrationFacts> = {}): CodexMigrationFacts {
  return facts({
    legacyAssets: ['.safeword/hooks/codex/pre-tool-quality.ts'],
    legacyEvents: ['PreToolUse'],
    viableLegacyEvents: ['PreToolUse'],
    ...overrides,
  });
}

function parseProtocolStatus(stdout: string): CodexMigrationResultV2 {
  const envelope = JSON.parse(stdout) as {
    changed: boolean;
    errors: CodexMigrationResultV2['errors'];
    next_actions: CodexMigrationResultV2['next_actions'];
    data: {
      migration: {
        schema_version: '2';
        state: CodexMigrationResultV2['state'];
      };
      protected: CodexMigrationResultV2['protected'];
      plugin: CodexMigrationResultV2['plugin'];
      proof: CodexMigrationResultV2['proof'];
      legacy: CodexMigrationResultV2['legacy'];
    };
  };
  return {
    schema_version: '2',
    ok: envelope.errors.length === 0,
    state: envelope.data.migration.state,
    protected: envelope.data.protected,
    changed: envelope.changed,
    plugin: envelope.data.plugin,
    proof: envelope.data.proof,
    legacy: envelope.data.legacy,
    effects: { files: [] },
    errors: envelope.errors,
    next_actions: envelope.next_actions,
  };
}

function partialLegacy(overrides: Partial<CodexMigrationFacts> = {}): CodexMigrationFacts {
  return facts({
    legacyAssets: ['.safeword/hooks/codex/pre-tool-quality.ts'],
    legacyEvents: ['PreToolUse', 'PostToolUse'],
    viableLegacyEvents: ['PreToolUse'],
    ...overrides,
  });
}

function fixtureFacts(name: string): CodexMigrationFacts {
  switch (name) {
    case 'complete legacy': {
      return completeLegacy();
    }
    case 'partial legacy': {
      return partialLegacy();
    }
    case 'disabled plugin without legacy':
    case 'disabled without legacy': {
      return facts({ plugin: { ...enabledPlugin, enabled: false } });
    }
    case 'disabled plugin with complete legacy':
    case 'disabled with complete legacy': {
      return completeLegacy({ plugin: { ...enabledPlugin, enabled: false } });
    }
    case 'disabled plugin with partial legacy':
    case 'disabled with partial legacy': {
      return partialLegacy({ plugin: { ...enabledPlugin, enabled: false } });
    }
    case 'outdated plugin without legacy': {
      return facts({ plugin: { ...enabledPlugin, version: '0.68.0' } });
    }
    case 'restart pending without legacy': {
      return facts({ plugin: enabledPlugin, activationPending: true });
    }
    case 'restart completed without hook activation': {
      return facts({
        plugin: enabledPlugin,
        activationPending: true,
        activationRestartObserved: true,
      });
    }
    case 'restart completed with partial hook activation': {
      return facts({
        plugin: enabledPlugin,
        proof: partialProof,
        activationRestartProven: true,
      });
    }
    case 'restart pending with complete legacy': {
      return completeLegacy({ plugin: enabledPlugin, activationPending: true });
    }
    case 'restart pending with partial legacy': {
      return partialLegacy({ plugin: enabledPlugin, activationPending: true });
    }
    case 'current proof and legacy':
    case 'current proof with legacy': {
      return completeLegacy({ plugin: enabledPlugin, proof: currentProof });
    }
    case 'current proof without legacy': {
      return facts({ plugin: enabledPlugin, proof: currentProof, finalized: true });
    }
    case 'no configuration': {
      return facts();
    }
    case 'finalized without plugin':
    case 'recovery required': {
      return facts({
        finalized: name === 'finalized without plugin',
        recoveryRequired: name === 'recovery required',
      });
    }
    case 'unproven without legacy': {
      return facts({ plugin: enabledPlugin });
    }
    case 'unproven with legacy': {
      return completeLegacy({ plugin: enabledPlugin });
    }
    default: {
      throw new Error(`Unknown Codex status fixture: ${name}`);
    }
  }
}

function requireStatus(world: ContinuityStatusWorld): CodexMigrationResultV2 {
  assert.ok(world.codexStatus, 'Codex status was not derived');
  return world.codexStatus;
}

function nextActionText(
  action: CodexMigrationResultV2['next_actions'][number] | undefined,
): string | undefined {
  if (action === undefined) return undefined;
  return 'command' in action ? action.command : action.instruction;
}

Given(
  /^the repository and active profile derive the (.+) fixture$/u,
  function (this: ContinuityStatusWorld, fixture: string) {
    this.codexFacts = fixtureFacts(fixture);
  },
);

Given(
  /^an enabled plugin without current proof and (recognized legacy protection|no recognized legacy protection)$/u,
  function (this: ContinuityStatusWorld, legacy: string) {
    this.codexFacts =
      legacy === 'recognized legacy protection'
        ? completeLegacy({ plugin: enabledPlugin })
        : facts({ plugin: enabledPlugin });
  },
);

Given('an enabled plugin with proof for only SessionStart', function (this: ContinuityStatusWorld) {
  this.codexFacts = facts({ plugin: enabledPlugin, proof: partialProof });
});

Given(
  'an enabled unknown-version plugin with current proof and legacy protection',
  function (this: ContinuityStatusWorld) {
    this.codexFacts = completeLegacy({
      plugin: { ...enabledPlugin, version: null, observation: 'unknown' },
      proof: currentProof,
    });
  },
);

Given(
  'an unresolved migration backup and recognized legacy protection',
  function (this: ContinuityStatusWorld) {
    this.codexFacts = completeLegacy({ recoveryRequired: true });
  },
);

Given(
  'current profile proof and a finalized project without legacy assets',
  function (this: ContinuityStatusWorld) {
    this.codexFacts = facts({ plugin: enabledPlugin, proof: currentProof, finalized: true });
  },
);

Given(
  /^a finalized repository whose profile plugin is (absent|disabled)$/u,
  function (this: ContinuityStatusWorld, pluginState: string) {
    this.codexFacts = facts({
      finalized: true,
      plugin: pluginState === 'disabled' ? { ...enabledPlugin, enabled: false } : absentPlugin,
    });
  },
);

function observeStatus(world: ContinuityStatusWorld): void {
  assert.equal(
    world.codexFacts,
    undefined,
    'Synthetic facts require an explicit status-derivation step',
  );
  assert.ok(world.runCodexStatus, 'A real Codex status runner must be initialized');
  const result = world.runCodexStatus();
  world.codexProtocolOutput = result.stdout;
  world.codexProtocolStderr = result.stderr;
  world.codexStatus = parseProtocolStatus(result.stdout);
  world.codexStatusOutput = renderCodexMigrationHuman(world.codexStatus);
  world.codexStatusExitCode = result.exitCode;
}

function derivePreparedStatus(world: ContinuityStatusWorld): CodexMigrationResultV2 {
  if (!world.codexStatus) {
    assert.ok(world.codexFacts, 'Codex facts were not initialized');
    world.codexStatus = deriveCodexMigrationResult(world.codexFacts);
  }
  return world.codexStatus;
}

When('the builder checks Codex status', function (this: ContinuityStatusWorld) {
  observeStatus(this);
});

When('the teammate checks Codex status', function (this: ContinuityStatusWorld) {
  observeStatus(this);
});

When('the builder requests Codex status as JSON', function (this: ContinuityStatusWorld) {
  assert.ok(this.runCodexStatus, 'A real Codex status runner must be initialized');
  const result = this.runCodexStatus();
  this.codexProtocolOutput = result.stdout;
  this.codexProtocolStderr = result.stderr;
  this.codexStatusExitCode = result.exitCode;
});

When(
  'Safeword derives human Codex status from the fixture',
  function (this: ContinuityStatusWorld) {
    this.codexStatus = derivePreparedStatus(this);
    this.codexStatusOutput = renderCodexMigrationHuman(this.codexStatus);
    this.codexStatusExitCode = codexMigrationExitCode(this.codexStatus);
  },
);

When('Safeword derives the prepared Codex domain status', function (this: ContinuityStatusWorld) {
  this.codexStatus = derivePreparedStatus(this);
  this.codexStatusExitCode = codexMigrationExitCode(this.codexStatus);
});

Then(
  /^status reports ([a-z_]+), names protection as ([a-z]+), and ends with (.+)$/u,
  function (
    this: ContinuityStatusWorld,
    state: CodexMigrationResultV2['state'],
    protection: CodexMigrationResultV2['protected'],
    nextAction: string,
  ) {
    const status = requireStatus(this);
    assert.equal(status.state, state);
    assert.equal(status.protected, protection);
    assert.equal(nextActionText(status.next_actions.at(-1)), nextAction);
    assert.ok(this.codexStatusOutput?.endsWith(`Next: ${nextAction}\n`));
  },
);

Then(
  /^status reports plugin_enabled_hook_unproven(?: with protection (protected|unprotected))?$/u,
  function (this: ContinuityStatusWorld, protection?: string) {
    const status = requireStatus(this);
    assert.equal(status.state, 'plugin_enabled_hook_unproven');
    if (protection != null) assert.equal(status.protected, protection);
  },
);

Then(
  'status reports plugin_enabled_hook_unproven and recommends hook review in the restarted app',
  function (this: ContinuityStatusWorld) {
    const status = requireStatus(this);
    assert.equal(status.state, 'plugin_enabled_hook_unproven');
    assert.deepEqual(status.next_actions[0], {
      kind: 'human',
      instruction:
        'Review the installed hooks in Codex Desktop under Settings > Hooks (or with /hooks in the terminal TUI). Fully restart Codex, then resume this task.',
      mutates: false,
      requires_human: true,
    });
  },
);

Then(
  'the public JSON envelope contains only the unproven migration status',
  function (this: ContinuityStatusWorld) {
    const output = this.codexProtocolOutput ?? '';
    const envelope = JSON.parse(output) as {
      schema_version: number;
      state: string;
      data: { migration: { schema_version: string; state: string } };
    };
    assert.equal(this.codexProtocolStderr, '');
    assert.equal(output, `${JSON.stringify(envelope)}\n`);
    assert.equal(envelope.schema_version, 1);
    assert.equal(envelope.state, 'action_required');
    assert.deepEqual(envelope.data.migration, {
      schema_version: '2',
      state: 'plugin_enabled_hook_unproven',
    });
  },
);

Then(
  'the public JSON envelope reports PLUGIN_OBSERVATION_FAILED and exits 1',
  function (this: ContinuityStatusWorld) {
    const output = this.codexProtocolOutput ?? '';
    const envelope = JSON.parse(output) as {
      schema_version: number;
      state: string;
      errors: { code: string; message: string; retryable: boolean }[];
    };
    assert.equal(this.codexProtocolStderr, '');
    assert.equal(output, `${JSON.stringify(envelope)}\n`);
    assert.equal(envelope.schema_version, 1);
    assert.equal(envelope.state, 'failed');
    assert.deepEqual(envelope.errors, [
      {
        code: 'PLUGIN_OBSERVATION_FAILED',
        message: 'profile observation failed',
        retryable: true,
      },
    ]);
    assert.equal(this.codexStatusExitCode, 1);
  },
);

Then(
  'status reports plugin_update_required and recommends updating the plugin',
  function (this: ContinuityStatusWorld) {
    const status = requireStatus(this);
    assert.equal(status.state, 'plugin_update_required');
    assert.equal(nextActionText(status.next_actions[0]), 'safeword codex migrate');
  },
);

Then(
  'the output recommends restarting Codex and reviewing hooks',
  function (this: ContinuityStatusWorld) {
    assert.match(this.codexStatusOutput ?? '', /review.+\/hooks.+Fully restart Codex.+resume/isu);
  },
);

Then(
  'structured status reports plugin_enabled_hook_unproven with partial proof and names the four missing hook events',
  function (this: ContinuityStatusWorld) {
    const status = requireStatus(this);
    assert.equal(status.state, 'plugin_enabled_hook_unproven');
    assert.equal(status.proof.status, 'partial');
    assert.deepEqual(status.proof.missing_events, [
      'pre-tool-use',
      'post-tool-use',
      'user-prompt-submit',
      'stop',
    ]);
  },
);

Then(
  'status reports compatibility with protected coverage and unknown plugin observation',
  function (this: ContinuityStatusWorld) {
    const status = requireStatus(this);
    assert.equal(status.state, 'compatibility');
    assert.equal(status.protected, 'protected');
    assert.equal(status.plugin.observation, 'unknown');
    assert.equal(status.plugin.version, null);
  },
);

Then(
  'status reports plugin, names protection as protected, and contains no Next line',
  function (this: ContinuityStatusWorld) {
    const status = requireStatus(this);
    assert.equal(status.state, 'plugin');
    assert.equal(status.protected, 'protected');
    assert.equal(status.next_actions.length, 0);
    assert.doesNotMatch(this.codexStatusOutput ?? '', /^Next:/mu);
  },
);

Then(
  /^the complete migration schema 2 object reports state ([a-z_]+) and protection ([a-z]+)$/u,
  function (
    this: ContinuityStatusWorld,
    state: CodexMigrationResultV2['state'],
    protection: CodexMigrationResultV2['protected'],
  ) {
    const status = requireStatus(this);
    assert.equal(status.schema_version, '2');
    assert.equal(status.state, state);
    assert.equal(status.protected, protection);
    assert.deepEqual(Object.keys(status).toSorted(), [
      'changed',
      'effects',
      'errors',
      'legacy',
      'next_actions',
      'ok',
      'plugin',
      'proof',
      'protected',
      'schema_version',
      'state',
    ]);
  },
);

Then(
  /^it has (\d+) next actions naming (.+) and the command exits (\d+)$/u,
  function (
    this: ContinuityStatusWorld,
    actionCount: string,
    nextCommand: string,
    exitCode: string,
  ) {
    const status = requireStatus(this);
    assert.equal(status.next_actions.length, Number(actionCount));
    if (nextCommand === 'none') {
      assert.equal(status.next_actions.length, 0);
    } else {
      assert.equal(nextActionText(status.next_actions[0]), nextCommand);
    }
    assert.equal(this.codexStatusExitCode, Number(exitCode));
  },
);

Then(
  /^the single next action is shaped as an? (command|human) action$/u,
  function (this: ContinuityStatusWorld, shape: string) {
    const status = requireStatus(this);
    assert.equal(status.next_actions.length, 1);
    const action = status.next_actions[0];
    assert.ok(action !== undefined);
    // A restart is prose a person performs; a migrate is a command a runner can
    // execute. Asserting only the text lets prose ship in the `command` field,
    // where an automated caller would try to run an English sentence.
    const isCommand = 'command' in action;
    assert.equal(isCommand ? 'command' : 'human', shape);
  },
);

Then(
  'status reports plugin_setup_required and protection unprotected',
  function (this: ContinuityStatusWorld) {
    const status = requireStatus(this);
    assert.equal(status.state, 'plugin_setup_required');
    assert.equal(status.protected, 'unprotected');
  },
);

Then(
  'status reports plugin_setup_required and points to the repository bootstrap',
  function (this: ContinuityStatusWorld) {
    const status = requireStatus(this);
    assert.equal(status.state, 'plugin_setup_required');
    assert.match(
      this.codexStatusOutput ?? '',
      /Setup: \.agents\/skills\/safeword-plugin-setup\/SKILL\.md/u,
    );
  },
);
