import { describe, expect, it } from 'vitest';

import { createPlan, isPlanCurrent } from '../../src/cli-protocol/plan.js';
import { effectsForReconciliation } from '../../src/cli-protocol/reconciliation.js';

describe('CLI plan protocol', () => {
  it('binds plan identity to command, effects, and preconditions', () => {
    const plan = createPlan({
      command: 'remove',
      preconditionDigest: 'tree-a',
      effects: {
        destructive: [{ kind: 'remove', target: '.safeword' }],
      },
      requiresConfirmation: true,
    });

    expect(plan).toMatchObject({
      schemaVersion: 1,
      command: 'remove',
      preconditionDigest: 'tree-a',
      requiresConfirmation: true,
    });
    expect(plan.id).toMatch(/^[a-f\d]{64}$/);
    expect(isPlanCurrent(plan, 'tree-a')).toBe(true);
    expect(isPlanCurrent(plan, 'tree-b')).toBe(false);
  });

  it('normalizes every effect category even when empty', () => {
    expect(createPlan({ command: 'status', preconditionDigest: 'tree' }).effects).toEqual({
      files: [],
      packages: [],
      configuration: [],
      network: [],
      destructive: [],
    });
  });

  it('declares registry access whenever setup may install packages', () => {
    const effects = effectsForReconciliation(
      {
        actions: [],
        applied: false,
        created: [],
        updated: [],
        removed: [],
        packagesToInstall: ['eslint'],
        packagesToRemove: [],
        warnings: [],
      },
      'upgrade',
    );

    expect(effects.network).toEqual([
      { kind: 'package-registry', target: 'eslint', operation: 'install' },
    ]);
  });

  it('uses predicted changes instead of executor actions that may be no-ops', () => {
    const effects = effectsForReconciliation(
      {
        actions: [
          { type: 'chmod', paths: ['.safeword/hooks'] },
          {
            type: 'text-patch',
            path: 'AGENTS.md',
            definition: {
              marker: '<!-- already-present -->',
              content: '<!-- already-present -->\n',
              operation: 'append',
            },
          },
        ],
        applied: false,
        created: [],
        updated: [],
        removed: [],
        packagesToInstall: [],
        packagesToRemove: [],
        warnings: [],
      },
      'upgrade',
    );

    expect(effects.files).toEqual([]);
  });

  it('reports every observed file change from an applied uninstall', () => {
    const effects = effectsForReconciliation(
      {
        actions: [],
        applied: true,
        created: ['created-during-cleanup.json'],
        updated: ['customer-config.json'],
        removed: ['.safeword/version'],
        packagesToInstall: [],
        packagesToRemove: ['eslint'],
        warnings: [],
      },
      'uninstall',
    );

    expect(effects.files).toEqual([
      { kind: 'create', target: 'created-during-cleanup.json' },
      { kind: 'update', target: 'customer-config.json' },
    ]);
    expect(effects.destructive).toEqual([{ kind: 'remove', target: '.safeword/version' }]);
    expect(effects.packages).toEqual([]);
  });
});
