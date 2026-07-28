/* eslint-disable unicorn/no-null -- migration JSON models unavailable profile facts with null */

import { describe, expect, it } from 'vitest';

import {
  codexMigrationExitCode,
  type CodexMigrationFacts,
  deriveCodexMigrationResult,
  renderCodexMigrationHuman,
} from '../../src/codex-plugin/migration.js';

const missingProof: CodexMigrationFacts['proof'] = {
  status: 'missing',
  plugin_version: null,
  manifest_sha256: null,
  recorded_at: null,
};

const currentProof: CodexMigrationFacts['proof'] = {
  status: 'current',
  plugin_version: '1.0.0',
  manifest_sha256: 'digest',
  recorded_at: '2026-07-28T00:00:00.000Z',
};

const enabledPlugin: CodexMigrationFacts['plugin'] = {
  installed: true,
  enabled: true,
  version: '1.0.0',
  observation: 'observed',
};

function facts(overrides: Partial<CodexMigrationFacts> = {}): CodexMigrationFacts {
  return {
    plugin: {
      installed: false,
      enabled: false,
      version: null,
      observation: 'observed',
    },
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

describe('Codex migration result', () => {
  it.each([
    {
      name: 'complete legacy',
      input: facts({ legacyEvents: ['PreToolUse'], viableLegacyEvents: ['PreToolUse'] }),
      state: 'legacy',
      protection: 'protected',
      next: 'safeword codex migrate',
    },
    {
      name: 'partial legacy',
      input: facts({
        legacyEvents: ['PreToolUse', 'PostToolUse'],
        viableLegacyEvents: ['PreToolUse'],
      }),
      state: 'legacy',
      protection: 'partial',
      next: 'safeword codex migrate',
    },
    {
      name: 'disabled plugin without legacy',
      input: facts({
        plugin: {
          installed: true,
          enabled: false,
          version: '1.0.0',
          observation: 'observed',
        },
      }),
      state: 'plugin_disabled',
      protection: 'unprotected',
      next: 'safeword codex migrate',
    },
    {
      name: 'restart pending with complete legacy',
      input: facts({
        plugin: {
          installed: true,
          enabled: true,
          version: '1.0.0',
          observation: 'observed',
        },
        legacyEvents: ['PreToolUse'],
        viableLegacyEvents: ['PreToolUse'],
        restartPending: true,
      }),
      state: 'plugin_installed_restart_required',
      protection: 'protected',
      next: 'safeword codex status',
    },
    {
      name: 'compatibility',
      input: facts({
        plugin: {
          installed: true,
          enabled: true,
          version: '1.0.0',
          observation: 'observed',
        },
        proof: {
          status: 'current',
          plugin_version: '1.0.0',
          manifest_sha256: 'digest',
          recorded_at: '2026-07-28T00:00:00.000Z',
        },
        legacyEvents: ['PreToolUse'],
        viableLegacyEvents: ['PreToolUse'],
      }),
      state: 'compatibility',
      protection: 'protected',
      next: 'safeword codex migrate --finalize',
    },
    {
      name: 'no configuration',
      input: facts(),
      state: 'not_configured',
      protection: 'unprotected',
      next: 'safeword codex migrate',
    },
    {
      name: 'finalized without plugin',
      input: facts({ finalized: true }),
      state: 'plugin_setup_required',
      protection: 'unprotected',
      next: 'safeword codex migrate',
    },
  ])('renders one safe next action for $name', ({ input, state, protection, next }) => {
    const result = deriveCodexMigrationResult(input);
    const lines = [`Codex migration: ${state}`, `Protection: ${protection}`];
    if (state === 'plugin_setup_required') {
      lines.push('Setup: .agents/skills/safeword-plugin-setup/SKILL.md');
    } else if (
      state === 'plugin_installed_restart_required' ||
      state === 'plugin_enabled_hook_unproven'
    ) {
      lines.push('Start a new Codex session, then review the Safe Word plugin hooks with /hooks.');
    }
    lines.push(`Next: ${next}`, '');

    expect(result).toMatchObject({ state, protected: protection });
    expect(renderCodexMigrationHuman(result)).toBe(lines.join('\n'));
  });

  it.each([
    ['recovery_required', facts({ recoveryRequired: true }), 2],
    ['plugin_setup_required', facts({ finalized: true }), 2],
    [
      'plugin_disabled',
      facts({
        plugin: { ...enabledPlugin, enabled: false },
      }),
      2,
    ],
    [
      'plugin_installed_restart_required',
      facts({ plugin: enabledPlugin, restartPending: true }),
      2,
    ],
    ['plugin_enabled_hook_unproven', facts({ plugin: enabledPlugin }), 2],
    [
      'compatibility',
      facts({
        plugin: enabledPlugin,
        proof: currentProof,
        legacyEvents: ['PreToolUse'],
        viableLegacyEvents: ['PreToolUse'],
      }),
      2,
    ],
    ['plugin', facts({ plugin: enabledPlugin, proof: currentProof }), 0],
    ['legacy', facts({ legacyEvents: ['PreToolUse'], viableLegacyEvents: ['PreToolUse'] }), 2],
    ['not_configured', facts(), 2],
  ] as const)('returns a complete schema-1 object for %s', (state, input, exitCode) => {
    const result = deriveCodexMigrationResult(input);

    expect(result.state).toBe(state);
    expect(codexMigrationExitCode(result)).toBe(exitCode);
    expect(Object.keys(result).toSorted((left, right) => left.localeCompare(right))).toEqual(
      [
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
      ].toSorted((left, right) => left.localeCompare(right)),
    );
    expect(result).toMatchObject({
      schema_version: '1',
      changed: false,
      plugin: {
        installed: expect.any(Boolean),
        version: expect.toSatisfy((value: unknown) => typeof value === 'string' || value === null),
        observation: expect.stringMatching(/^(observed|unknown)$/u),
      },
      proof: {
        status: expect.stringMatching(/^(current|missing|stale|malformed)$/u),
      },
      legacy: {
        events: expect.any(Array),
        viable_events: expect.any(Array),
        assets: expect.any(Array),
      },
      effects: { files: expect.any(Array) },
      errors: expect.any(Array),
      next_actions: expect.any(Array),
    });
  });

  it('prioritizes finalized project setup over a disabled profile plugin', () => {
    const result = deriveCodexMigrationResult(
      facts({
        finalized: true,
        plugin: { ...enabledPlugin, enabled: false },
      }),
    );

    expect(result).toMatchObject({
      state: 'plugin_setup_required',
      protected: 'unprotected',
      next_actions: [{ command: 'safeword codex migrate' }],
    });
  });

  it('does not treat a restart marker as actionable when the plugin is absent', () => {
    const result = deriveCodexMigrationResult(facts({ restartPending: true }));

    expect(result).toMatchObject({
      state: 'not_configured',
      next_actions: [{ command: 'safeword codex migrate' }],
    });
  });

  it('points an unconfigured teammate to the finalized repository bootstrap', () => {
    const result = deriveCodexMigrationResult(facts({ finalized: true }));

    expect(renderCodexMigrationHuman(result)).toBe(
      [
        'Codex migration: plugin_setup_required',
        'Protection: unprotected',
        'Setup: .agents/skills/safeword-plugin-setup/SKILL.md',
        'Next: safeword codex migrate',
        '',
      ].join('\n'),
    );
  });
});
