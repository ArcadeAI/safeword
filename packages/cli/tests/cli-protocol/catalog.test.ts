import { describe, expect, it } from 'vitest';

import {
  commandCatalog,
  createCapabilitiesResult,
  publicCommands,
} from '../../src/cli-protocol/catalog.js';
import { renderJsonResult } from '../../src/cli-protocol/result.js';

describe('CLI command catalog', () => {
  it('describes every public command with executable policy and a fixture', () => {
    expect(publicCommands.length).toBeGreaterThan(0);
    for (const command of publicCommands) {
      expect(command).toMatchObject({
        public: true,
        effectClass: expect.stringMatching(/^(observe|plan|mutate|destructive)$/),
        promptPolicy: expect.stringMatching(/^(never|confirm)$/),
        networkPolicy: expect.stringMatching(/^(never|declared)$/),
        schemaVersions: [1],
        fixture: {
          argv: expect.any(Array),
          environment: expect.any(Object),
        },
      });
    }
  });

  it('uses unique executable leaves for canonical commands and compatibility aliases', () => {
    const names = commandCatalog.map(definition => definition.name);
    expect(new Set(names).size).toBe(names.length);

    const canonicalNames = commandCatalog
      .filter(definition => definition.public && definition.aliasFor === undefined)
      .map(definition => definition.name);
    expect(canonicalNames).toEqual([
      'status',
      'setup',
      'plan',
      'doctor',
      'remove',
      'project sync-config',
      'project architecture',
      'project sync-learnings',
      'project sync-tickets',
      'project codify',
      'project test-plan',
      'project lint-gherkin',
      'tracker sync',
      'tracker connect',
      'codex migrate',
      'codex install',
      'codex status',
      'codex recover',
      'ticket list',
      'ticket new',
      'retro run',
      'retro signals',
      'retro reconcile',
      'capabilities',
    ]);

    const aliasDefinitions = commandCatalog.filter(entry => entry.aliasFor !== undefined);
    for (const definition of aliasDefinitions) {
      expect(canonicalNames).toContain(definition.aliasFor);
    }
  });

  it('contains the complete compatibility and hidden-helper inventory', () => {
    const aliases = commandCatalog.filter(command => command.aliasFor !== undefined);
    expect(aliases.map(alias => alias.name)).toEqual([
      'check',
      'upgrade',
      'diff',
      'reset',
      'sync-config',
      'architecture',
      'sync-learnings',
      'sync-tickets',
      'codify',
      'test-plan',
      'lint-gherkin',
      'sync-tracker',
      'connect',
      'self-report',
      'retro',
      'retro-reconcile',
      'migrate codex-plugin',
    ]);
    for (const alias of aliases) {
      expect(alias.compatibility).toEqual({
        introducedIn: '0.70',
        retainedThrough: '0.71',
        removalEligibleAfter: '0.71',
      });
    }

    const hidden = commandCatalog.filter(command => !command.public);
    expect(hidden.map(command => command.name)).toEqual([
      'boundary',
      'hook codex',
      'codex-hook',
      'feature-directories',
    ]);
  });

  it('publishes complete capabilities without hidden helpers', () => {
    const envelope = JSON.parse(renderJsonResult(createCapabilitiesResult())) as Record<
      string,
      unknown
    >;
    const data = envelope.data as { commands: Record<string, unknown>[] };

    expect(data.commands).toHaveLength(publicCommands.length);
    expect(data.commands.some(command => command.name === 'boundary')).toBe(false);
    const firstCommand = data.commands[0];
    expect(firstCommand).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        aliases: expect.any(Array),
        effect_class: expect.any(String),
        prompt_policy: expect.any(String),
        network_policy: expect.any(String),
        schema_versions: [1],
      }),
    );
    expect(firstCommand?.fixture).toEqual(expect.objectContaining({ argv: expect.any(Array) }));
  });
});
