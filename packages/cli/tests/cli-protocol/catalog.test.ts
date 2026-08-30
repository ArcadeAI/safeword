import { describe, expect, it } from 'vitest';

import {
  commandCatalog,
  compatibilityRoutes,
  createCapabilitiesResult,
  publicCommands,
} from '../../src/cli-protocol/catalog.js';
import { renderJsonResult } from '../../src/cli-protocol/result.js';

function publishedOptions(definition: (typeof publicCommands)[number]): Record<string, unknown>[] {
  return definition.registration.options.map(
    ({ flags, description, defaultValue, valueKind, compatibilityReplacement }) => ({
      flags,
      description,
      ...(defaultValue !== undefined && { default_value: defaultValue }),
      ...(valueKind !== undefined && { value_kind: valueKind }),
      ...(compatibilityReplacement !== undefined && {
        compatibility: {
          replacement: compatibilityReplacement,
          retention: 'indefinite',
        },
      }),
    }),
  );
}

function expectPublishedCommandShape(command: Record<string, unknown> | undefined): void {
  expect(command).toEqual(
    expect.objectContaining({
      name: expect.any(String),
      aliases: expect.any(Array),
      effect_class: expect.any(String),
      prompt_policy: expect.any(String),
      network_policy: expect.any(String),
      schema_versions: [1],
    }),
  );
  expect(command?.fixture).toEqual(expect.objectContaining({ argv: expect.any(Array) }));
}

describe('CLI command catalog', () => {
  it('describes every public command with executable policy and a fixture', () => {
    expect(publicCommands.length).toBeGreaterThan(0);
    for (const command of publicCommands) {
      expect(command).toMatchObject({
        classification: expect.stringMatching(/^(public|retained-alias)$/),
        visibility: expect.stringMatching(/^(public|hidden)$/),
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

  it('pins potentially mutating contract fixtures to offline execution', () => {
    for (const name of [
      'install',
      'uninstall',
      'project test',
      'tracker sync',
      'codex bootstrap',
      'review-pr invalidate',
      'migrate codex-plugin',
    ]) {
      const definition = commandCatalog.find(command => command.name === name);
      expect(definition?.fixture.argv, name).toContain('--offline');
    }
  });

  it('uses unique executable leaves for canonical commands and compatibility aliases', () => {
    const names = commandCatalog.map(definition => definition.name);
    expect(new Set(names).size).toBe(names.length);

    const canonicalNames = commandCatalog
      .filter(
        definition => definition.classification === 'public' && definition.aliasFor === undefined,
      )
      .map(definition => definition.name);
    expect(canonicalNames).toEqual([
      'status',
      'conformance',
      'install',
      'plan',
      'doctor',
      'uninstall',
      'project sync-config',
      'project architecture',
      'project sync-learnings',
      'project sync-tickets',
      'project codify',
      'project test-plan',
      'project test',
      'project test-execution status',
      'project test-execution remote status',
      'project test-execution remote setup',
      'project test-execution remote disable',
      'project lint-gherkin',
      'project audit-scope',
      'project record-skill-invocation',
      'project runtime',
      'project retro-drain',
      'project review-knowledge',
      'project public-retros',
      'project namespace-root',
      'tracker sync',
      'tracker connect',
      'codex migrate',
      'codex bootstrap',
      'codex status',
      'claude status',
      'claude cleanup',
      'claude recover',
      'codex clean-guidance',
      'codex recover',
      'ticket list',
      'ticket new',
      'ticket reconcile-parent',
      'review run',
      'review status',
      'review cancel',
      'review-pr inspect',
      'review-pr invalidate',
      'review-pr publish',
      'retro run',
      'retro signals',
      'retro reconcile',
      'retro-relay-retry',
      'retro-relay-discard',
      'capabilities',
    ]);

    const aliasDefinitions = commandCatalog.filter(entry => entry.aliasFor !== undefined);
    for (const definition of aliasDefinitions) {
      expect(canonicalNames).toContain(definition.aliasFor);
      const canonical = commandCatalog.find(entry => entry.name === definition.aliasFor);
      expect(definition.effectClass).toBe(canonical?.effectClass);
      expect(definition.promptPolicy).toBe(canonical?.promptPolicy);
      expect(definition.networkPolicy).toBe(canonical?.networkPolicy);
    }
  });

  it('contains the complete compatibility and hidden-helper inventory', () => {
    const aliases = commandCatalog.filter(command => command.aliasFor !== undefined);
    expect(aliases.map(alias => alias.name)).toEqual([
      'check',
      'claude install',
      'codex install',
      'setup',
      'upgrade',
      'diff',
      'remove',
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
      expect(alias.compatibility).toEqual(
        expect.objectContaining({ introducedIn: expect.any(String), retention: 'indefinite' }),
      );
      expect(alias.compatibility).not.toHaveProperty('retainedThrough');
      expect(alias.compatibility).not.toHaveProperty('removalEligibleAfter');
    }
    expect(aliases.find(alias => alias.name === 'setup')?.compatibility?.introducedIn).toBe('0.72');

    const hidden = commandCatalog.filter(command => command.classification === 'internal');
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
    const data = envelope.data as {
      commands: Record<string, unknown>[];
      machine_output: { canonical_option: string; schema_version: number };
    };

    expect(data.machine_output).toEqual(
      expect.objectContaining({ canonical_option: '--json', schema_version: 1 }),
    );

    expect(data.commands).toHaveLength(publicCommands.length);
    expect(data.commands.some(command => command.name === 'boundary')).toBe(false);
    expectPublishedCommandShape(data.commands[0]);

    for (const definition of publicCommands) {
      const published = data.commands.find(command => command.name === definition.name);
      expect(published?.options).toEqual(publishedOptions(definition));
    }

    expect(compatibilityRoutes).toEqual(
      expect.arrayContaining([
        { route: 'bare safeword', replacement: 'status', retention: 'indefinite' },
        {
          route: 'claude install',
          replacement: 'install --agents=claude (also reconciles the project)',
          retention: 'indefinite',
        },
        {
          route: 'codex install',
          replacement: 'install --agents=codex (also reconciles the project)',
          retention: 'indefinite',
        },
        {
          route: 'project architecture --stage',
          replacement: 'project architecture --from-index --stage-output',
          retention: 'indefinite',
        },
      ]),
    );

    const setup = data.commands.find(command => command.name === 'setup');
    expect(setup?.compatibility).toEqual(
      expect.objectContaining({
        introduced_in: '0.72',
        retention: 'indefinite',
        redundant_options: [{ flag: '--yes', replacement: 'install' }],
      }),
    );
    expect(setup?.compatibility).not.toHaveProperty('removal_eligible_after');

    const claudeInstall = data.commands.find(command => command.name === 'claude install');
    const codexInstall = data.commands.find(command => command.name === 'codex install');
    expect(claudeInstall?.options).toEqual([
      expect.objectContaining({ flags: '--scope <scope>', default_value: 'project' }),
    ]);
    expect(codexInstall?.options).toEqual([]);

    const remove = data.commands.find(command => command.name === 'remove');
    expect(remove?.options).toEqual(
      expect.arrayContaining([
        {
          flags: '--plan <id>',
          description: 'Identity of the exact plan being confirmed',
          value_kind: 'plan-identity',
        },
      ]),
    );
    const projectOnlyOptions = remove?.options as { flags: string }[];
    const projectOnlyFlags = projectOnlyOptions.map(option => option.flags);
    expect(projectOnlyFlags).not.toContain('--agents <agents>');
    expect(projectOnlyFlags).not.toContain('--scope <scope>');
    const trackerSync = data.commands.find(command => command.name === 'tracker sync');
    expect(trackerSync?.options).toEqual(
      expect.arrayContaining([
        {
          flags: '--plan',
          description: 'Compute an offline tracker plan',
        },
      ]),
    );
  });

  it('describes destructive operations as deactivation with preservation and recovery', () => {
    const destructiveDescriptions = Object.fromEntries(
      publicCommands
        .filter(definition => definition.effectClass === 'destructive')
        .map(definition => [definition.name, definition.description]),
    );
    expect(destructiveDescriptions.uninstall).toMatch(/Deactivate.*preserve.*recover/iu);
    expect(destructiveDescriptions['codex clean-guidance']).toMatch(
      /Deactivate.*preserve.*recovery backup/iu,
    );
    expect(destructiveDescriptions['claude cleanup']).toMatch(/Deactivate.*recoverable backup/iu);
  });
});
