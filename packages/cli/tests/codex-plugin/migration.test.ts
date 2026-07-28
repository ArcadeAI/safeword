/* eslint-disable unicorn/no-null -- migration JSON models unavailable profile facts with null */

import { describe, expect, it } from 'vitest';

import {
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
      next: 'restart Codex and review /hooks',
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

    expect(result).toMatchObject({ state, protected: protection });
    expect(renderCodexMigrationHuman(result)).toBe(
      `Codex migration: ${state}\nProtection: ${protection}\nNext: ${next}\n`,
    );
  });
});
