/* eslint-disable unicorn/no-null -- migration JSON models unavailable profile facts with null */

import { describe, expect, it } from 'vitest';

import {
  codexMigrationExitCode,
  type CodexMigrationFacts,
  deriveCodexMigrationResult,
  renderCodexMigrationHuman,
} from '../../src/codex-plugin/migration.js';
import { SAFEWORD_SCHEMA } from '../../src/schema.js';

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
  manifest_sha256: 'digest',
  recorded_at: '2026-07-28T00:00:00.000Z',
  activation_id: null,
  events: ['session-start', 'pre-tool-use', 'post-tool-use', 'user-prompt-submit', 'stop'],
  missing_events: [],
};

const enabledPlugin: CodexMigrationFacts['plugin'] = {
  installed: true,
  enabled: true,
  version: SAFEWORD_SCHEMA.version,
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
    activationPending: false,
    activationRestartObserved: false,
    activationRestartProven: false,
    ...overrides,
  };
}

describe('Codex migration result', () => {
  it('requires an update when the enabled plugin version differs from the package', () => {
    const result = deriveCodexMigrationResult(
      facts({
        plugin: { ...enabledPlugin, version: '0.68.0' },
        proof: currentProof,
        legacyEvents: ['PreToolUse'],
        viableLegacyEvents: ['PreToolUse'],
      }),
    );

    expect(result).toMatchObject({
      state: 'plugin_update_required',
      protected: 'protected',
      next_actions: [{ command: 'safeword codex migrate' }],
    });
  });

  it('does not accept proof whose version differs from the installed plugin', () => {
    const result = deriveCodexMigrationResult(
      facts({
        plugin: enabledPlugin,
        proof: { ...currentProof, plugin_version: '0.68.0' },
        legacyEvents: ['PreToolUse'],
        viableLegacyEvents: ['PreToolUse'],
      }),
    );

    expect(result).toMatchObject({
      state: 'plugin_enabled_hook_unproven',
      protected: 'protected',
    });
  });

  it('does not report pending same-host proof as active plugin protection', () => {
    const result = deriveCodexMigrationResult(
      facts({
        plugin: enabledPlugin,
        proof: { ...currentProof, activation_id: 'activation-rc2' },
        activationPending: true,
      }),
    );

    expect(result).toMatchObject({
      state: 'plugin_installed_app_restart_required',
      protected: 'unprotected',
    });
  });

  it('reports a completed restart whose hooks did not activate without requesting another restart', () => {
    const result = deriveCodexMigrationResult(
      facts({
        plugin: enabledPlugin,
        activationPending: true,
        activationRestartObserved: true,
      }),
    );

    expect(result).toMatchObject({
      state: 'plugin_installed_hook_activation_failed',
      protected: 'unprotected',
      next_actions: [
        {
          kind: 'human',
          instruction:
            'Review the installed hooks in Codex Desktop under Settings > Hooks (or with /hooks in the terminal TUI). If they are enabled and trusted, use a Codex surface that dispatches lifecycle hooks before relying on Safeword protection.',
        },
      ],
    });
    expect(renderCodexMigrationHuman(result)).toBe(
      'Codex migration: plugin_installed_hook_activation_failed\nProtection: unprotected\nCodex restarted, but Safeword received no current lifecycle hook proof.\nNext: Review the installed hooks in Codex Desktop under Settings > Hooks (or with /hooks in the terminal TUI). If they are enabled and trusted, use a Codex surface that dispatches lifecycle hooks before relying on Safeword protection.\n',
    );
  });

  it('does not request another restart while current hook proof is still partial', () => {
    const result = deriveCodexMigrationResult(
      facts({
        plugin: enabledPlugin,
        proof: {
          ...missingProof,
          status: 'partial',
          activation_id: 'activation-rc2',
          events: ['session-start'],
          missing_events: ['pre-tool-use', 'post-tool-use', 'user-prompt-submit', 'stop'],
        },
        activationRestartProven: true,
      }),
    );

    expect(result).toMatchObject({
      state: 'plugin_enabled_hook_unproven',
      protected: 'unprotected',
      next_actions: [
        {
          kind: 'human',
          instruction:
            'Continue in this Codex session. Safeword will confirm protection after the remaining lifecycle hooks run.',
        },
      ],
    });
    expect(renderCodexMigrationHuman(result)).toBe(
      'Codex migration: plugin_enabled_hook_unproven\nProtection: unprotected\nCodex restarted and Safeword has partial current lifecycle hook proof.\nNext: Continue in this Codex session. Safeword will confirm protection after the remaining lifecycle hooks run.\n',
    );
  });

  it.each([
    { name: 'restart receipt without partial proof', activationRestartProven: true },
    { name: 'restart observation after the marker was retired', activationRestartObserved: true },
  ])('keeps restart guidance for $name', overrides => {
    const result = deriveCodexMigrationResult(facts({ plugin: enabledPlugin, ...overrides }));

    expect(result).toMatchObject({
      state: 'plugin_enabled_hook_unproven',
      next_actions: [
        {
          instruction:
            'Review the installed hooks in Codex Desktop under Settings > Hooks (or with /hooks in the terminal TUI). Fully restart Codex, then resume this task.',
        },
      ],
    });
  });

  it('falls back to manifest-bound proof when an older Codex omits plugin version metadata', () => {
    const result = deriveCodexMigrationResult(
      facts({
        plugin: { ...enabledPlugin, version: null },
        proof: currentProof,
        legacyEvents: ['PreToolUse'],
        viableLegacyEvents: ['PreToolUse'],
      }),
    );

    expect(result).toMatchObject({
      state: 'compatibility',
      protected: 'protected',
      next_actions: [{ command: 'safeword codex migrate --finalize' }],
    });
  });

  it.each([
    {
      name: 'complete legacy',
      input: facts({ legacyEvents: ['PreToolUse'], viableLegacyEvents: ['PreToolUse'] }),
      state: 'legacy',
      protection: 'protected',
      output: 'Codex migration: legacy\nProtection: protected\nNext: safeword codex migrate\n',
    },
    {
      name: 'partial legacy',
      input: facts({
        legacyEvents: ['PreToolUse', 'PostToolUse'],
        viableLegacyEvents: ['PreToolUse'],
      }),
      state: 'legacy',
      protection: 'partial',
      output: 'Codex migration: legacy\nProtection: partial\nNext: safeword codex migrate\n',
    },
    {
      name: 'disabled plugin without legacy',
      input: facts({
        plugin: {
          installed: true,
          enabled: false,
          version: SAFEWORD_SCHEMA.version,
          observation: 'observed',
        },
      }),
      state: 'plugin_disabled',
      protection: 'unprotected',
      output:
        'Codex migration: plugin_disabled\nProtection: unprotected\nNext: safeword codex migrate\n',
    },
    {
      name: 'app restart pending with complete legacy',
      input: facts({
        plugin: {
          installed: true,
          enabled: true,
          version: SAFEWORD_SCHEMA.version,
          observation: 'observed',
        },
        legacyEvents: ['PreToolUse'],
        viableLegacyEvents: ['PreToolUse'],
        activationPending: true,
      }),
      state: 'plugin_installed_app_restart_required',
      protection: 'protected',
      output:
        'Codex migration: plugin_installed_app_restart_required\nProtection: protected\nThis Codex app may keep its loaded Safeword catalogue.\nNext: Review the installed hooks in Codex Desktop under Settings > Hooks (or with /hooks in the terminal TUI). Fully restart Codex, then resume this task.\n',
    },
    {
      name: 'enabled plugin without hook proof',
      input: facts({ plugin: enabledPlugin }),
      state: 'plugin_enabled_hook_unproven',
      protection: 'unprotected',
      output:
        'Codex migration: plugin_enabled_hook_unproven\nProtection: unprotected\nThis Codex app may keep its loaded Safeword catalogue.\nNext: Review the installed hooks in Codex Desktop under Settings > Hooks (or with /hooks in the terminal TUI). Fully restart Codex, then resume this task.\n',
    },
    {
      name: 'compatibility',
      input: facts({
        plugin: {
          installed: true,
          enabled: true,
          version: SAFEWORD_SCHEMA.version,
          observation: 'observed',
        },
        proof: {
          status: 'current',
          plugin_version: SAFEWORD_SCHEMA.version,
          manifest_sha256: 'digest',
          recorded_at: '2026-07-28T00:00:00.000Z',
          activation_id: null,
          events: ['session-start', 'pre-tool-use', 'post-tool-use', 'user-prompt-submit', 'stop'],
          missing_events: [],
        },
        legacyEvents: ['PreToolUse'],
        viableLegacyEvents: ['PreToolUse'],
      }),
      state: 'compatibility',
      protection: 'protected',
      output:
        'Codex migration: compatibility\nProtection: protected\nNext: safeword codex migrate --finalize\n',
    },
    {
      name: 'no configuration',
      input: facts(),
      state: 'not_configured',
      protection: 'unprotected',
      output:
        'Codex migration: not_configured\nProtection: unprotected\nNext: safeword codex migrate\n',
    },
    {
      name: 'finalized without plugin',
      input: facts({ finalized: true }),
      state: 'plugin_setup_required',
      protection: 'unprotected',
      output:
        'Codex migration: plugin_setup_required\nProtection: unprotected\nSetup: .agents/skills/safeword-plugin-setup/SKILL.md\nNext: safeword codex migrate\n',
    },
  ])('renders one safe next action for $name', ({ input, state, protection, output }) => {
    const result = deriveCodexMigrationResult(input);

    expect(result).toMatchObject({ state, protected: protection });
    expect(renderCodexMigrationHuman(result)).toBe(output);
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
      'plugin_installed_app_restart_required',
      facts({ plugin: enabledPlugin, activationPending: true }),
      2,
    ],
    [
      'plugin_installed_hook_activation_failed',
      facts({
        plugin: enabledPlugin,
        activationPending: true,
        activationRestartObserved: true,
      }),
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
  ] as const)('returns a complete schema-2 object for %s', (state, input, exitCode) => {
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
      schema_version: '2',
      changed: false,
      plugin: {
        installed: expect.any(Boolean),
        version: expect.toSatisfy((value: unknown) => typeof value === 'string' || value === null),
        observation: expect.stringMatching(/^(observed|unknown)$/u),
      },
      proof: {
        status: expect.stringMatching(/^(current|missing|partial|stale|malformed)$/u),
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

  it('does not treat an activation marker as actionable when the plugin is absent', () => {
    const result = deriveCodexMigrationResult(facts({ activationPending: true }));

    expect(result).toMatchObject({
      state: 'not_configured',
      next_actions: [{ command: 'safeword codex migrate' }],
    });
  });

  it.each([
    [
      'plugin_installed_app_restart_required',
      facts({ plugin: enabledPlugin, activationPending: true }),
    ],
    ['plugin_enabled_hook_unproven', facts({ plugin: enabledPlugin })],
  ] as const)(
    'represents the restart prerequisite as a human action rather than a status-command loop for %s',
    (_state, input) => {
      expect(deriveCodexMigrationResult(input).next_actions).toEqual([
        {
          kind: 'human',
          instruction:
            'Review the installed hooks in Codex Desktop under Settings > Hooks (or with /hooks in the terminal TUI). Fully restart Codex, then resume this task.',
          mutates: false,
          requires_human: true,
        },
      ]);
    },
  );
});
