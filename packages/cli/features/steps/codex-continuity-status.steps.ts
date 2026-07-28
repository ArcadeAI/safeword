/* eslint-disable complexity, sonarjs/no-alphabetical-sort, unicorn/no-null, unicorn/require-array-sort-compare -- the acceptance table mirrors the explicit migration state matrix */

import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import {
  codexMigrationExitCode,
  type CodexMigrationFacts,
  type CodexMigrationResultV1,
  deriveCodexMigrationResult,
  renderCodexMigrationHuman,
} from '../../src/codex-plugin/migration.ts';
import type { SafewordWorld } from './world.js';

interface ContinuityStatusWorld extends SafewordWorld {
  codexFacts?: CodexMigrationFacts;
  codexStatus?: CodexMigrationResultV1;
  codexStatusOutput?: string;
  codexStatusExitCode?: number;
  runCodexStatus?: () => { stdout: string; stderr: string; exitCode: number };
}

const missingProof: CodexMigrationFacts['proof'] = {
  status: 'missing',
  plugin_version: null,
  manifest_sha256: null,
  recorded_at: null,
};

const currentProof: CodexMigrationFacts['proof'] = {
  status: 'current',
  plugin_version: '1.0.0',
  manifest_sha256: 'a'.repeat(64),
  recorded_at: '2026-07-28T00:00:00.000Z',
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
  version: '1.0.0',
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
    restartPending: false,
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
    case 'restart pending without legacy': {
      return facts({ plugin: enabledPlugin, restartPending: true });
    }
    case 'restart pending with complete legacy': {
      return completeLegacy({ plugin: enabledPlugin, restartPending: true });
    }
    case 'restart pending with partial legacy': {
      return partialLegacy({ plugin: enabledPlugin, restartPending: true });
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

function requireStatus(world: ContinuityStatusWorld): CodexMigrationResultV1 {
  assert.ok(world.codexStatus, 'Codex status was not derived');
  return world.codexStatus;
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

Given('a migration state that needs action', function (this: ContinuityStatusWorld) {
  this.codexFacts = facts();
});

Given('Codex profile status cannot be observed', function (this: ContinuityStatusWorld) {
  this.codexFacts = facts({
    plugin: {
      installed: false,
      enabled: null,
      version: null,
      observation: 'unknown',
    },
  });
  this.codexStatus = {
    ...deriveCodexMigrationResult(this.codexFacts),
    ok: false,
    errors: [
      {
        code: 'PLUGIN_OBSERVATION_FAILED',
        message: 'profile observation failed',
        retryable: true,
      },
    ],
  };
});

Given(
  /^a finalized repository whose profile plugin is (absent|disabled)$/u,
  function (this: ContinuityStatusWorld, pluginState: string) {
    this.codexFacts = facts({
      finalized: true,
      plugin: pluginState === 'disabled' ? { ...enabledPlugin, enabled: false } : absentPlugin,
    });
  },
);

Given(
  'the active Codex profile reports the Safe Word plugin enabled',
  function (this: ContinuityStatusWorld) {
    this.codexFacts = facts({ plugin: enabledPlugin });
  },
);

Given('no current profile hook proof exists', function (this: ContinuityStatusWorld) {
  assert.ok(this.codexFacts, 'plugin fixture was not initialized');
  this.codexFacts.proof = missingProof;
});

When('the builder checks Codex status', function (this: ContinuityStatusWorld) {
  if (!this.codexStatus) {
    if (this.codexFacts) {
      this.codexStatus = deriveCodexMigrationResult(this.codexFacts);
    } else {
      assert.ok(this.runCodexStatus, 'Codex facts or a status runner must be initialized');
      const result = this.runCodexStatus();
      this.codexStatus = JSON.parse(result.stdout) as CodexMigrationResultV1;
      this.codexStatusExitCode = result.exitCode;
    }
  }
  this.codexStatusOutput = renderCodexMigrationHuman(this.codexStatus);
  this.codexStatusExitCode = codexMigrationExitCode(this.codexStatus);
});

When('the teammate checks Codex status', function (this: ContinuityStatusWorld) {
  if (this.codexFacts) {
    this.codexStatus = deriveCodexMigrationResult(this.codexFacts);
  } else {
    assert.ok(this.runCodexStatus, 'Codex facts or a status runner must be initialized');
    const result = this.runCodexStatus();
    this.codexStatus = JSON.parse(result.stdout) as CodexMigrationResultV1;
    this.codexStatusExitCode = result.exitCode;
  }
  this.codexStatusOutput = renderCodexMigrationHuman(this.codexStatus);
  this.codexStatusExitCode = codexMigrationExitCode(this.codexStatus);
});

When('an agent checks Codex status with JSON output', function (this: ContinuityStatusWorld) {
  if (!this.codexStatus) {
    assert.ok(this.codexFacts, 'Codex facts were not initialized');
    this.codexStatus = deriveCodexMigrationResult(this.codexFacts);
  }
  this.codexStatusOutput = `${JSON.stringify(this.codexStatus)}\n`;
  this.codexStatusExitCode = codexMigrationExitCode(this.codexStatus);
});

Then(
  /^status reports ([a-z_]+), names protection as ([a-z]+), and ends with (.+)$/u,
  function (
    this: ContinuityStatusWorld,
    state: CodexMigrationResultV1['state'],
    protection: CodexMigrationResultV1['protected'],
    nextAction: string,
  ) {
    const status = requireStatus(this);
    assert.equal(status.state, state);
    assert.equal(status.protected, protection);
    assert.equal(status.next_actions.at(-1)?.command, nextAction);
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
  'status reports plugin_enabled_hook_unproven and recommends restarting and reviewing hooks',
  function (this: ContinuityStatusWorld) {
    const status = requireStatus(this);
    assert.equal(status.state, 'plugin_enabled_hook_unproven');
    assert.equal(status.next_actions[0]?.command, 'restart Codex and review /hooks');
  },
);

Then(
  'the output recommends restarting Codex and reviewing hooks',
  function (this: ContinuityStatusWorld) {
    assert.match(this.codexStatusOutput ?? '', /restart Codex and review \/hooks/u);
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
  /^stdout contains only the versioned(?: plugin)? status object and the command exits (\d+)$/u,
  function (this: ContinuityStatusWorld, exitCode: string) {
    const output = this.codexStatusOutput ?? '';
    const parsed = JSON.parse(output) as CodexMigrationResultV1;
    assert.equal(output, `${JSON.stringify(parsed)}\n`);
    assert.equal(parsed.schema_version, '1');
    assert.equal(this.codexStatusExitCode, Number(exitCode));
  },
);

Then(
  'stdout contains only the complete schema 1 object with a nonempty structured errors array',
  function (this: ContinuityStatusWorld) {
    const output = this.codexStatusOutput ?? '';
    const parsed = JSON.parse(output) as CodexMigrationResultV1;
    assert.equal(output, `${JSON.stringify(parsed)}\n`);
    assert.equal(parsed.schema_version, '1');
    assert.ok(parsed.errors.length > 0);
  },
);

Then(
  'the error code is PLUGIN_OBSERVATION_FAILED with message and retryable fields and the command exits 1',
  function (this: ContinuityStatusWorld) {
    assert.deepEqual(requireStatus(this).errors, [
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
  /^the complete schema 1 object reports state ([a-z_]+) and protection ([a-z]+)$/u,
  function (
    this: ContinuityStatusWorld,
    state: CodexMigrationResultV1['state'],
    protection: CodexMigrationResultV1['protected'],
  ) {
    const status = requireStatus(this);
    assert.equal(status.schema_version, '1');
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
      assert.equal(status.next_actions[0]?.command, nextCommand);
    }
    assert.equal(this.codexStatusExitCode, Number(exitCode));
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
