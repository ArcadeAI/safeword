import { describe, expect, it, vi } from 'vitest';

import { createResult } from '../../src/cli-protocol/result.js';
import {
  coordinateSelectedIntegrations,
  createIntegrationRegistry,
  defineIntegrationAdapter,
  type IntegrationAdapter,
  PRODUCTION_INTEGRATIONS,
} from '../../src/lifecycle/integrations.js';

function adapter(overrides: Partial<IntegrationAdapter> = {}): IntegrationAdapter {
  return {
    id: 'claude',
    defaultSelected: true,
    project: { owned: ['claude'], shared: ['skills'] },
    profile: { available: true, observePrecondition: vi.fn() },
    capabilities: {
      lifecycle: {
        session_start: 'observe',
        prompt_submit: 'observe',
        pre_tool: 'block',
        post_tool: 'observe',
        stop: 'block',
      },
      blockableHooks: ['pre_tool', 'stop'],
      activation: { availability: 'available', proof: 'observe' },
      conformance: { availability: 'unavailable' },
    },
    observe: vi.fn(),
    install: vi.fn(),
    uninstall: vi.fn(),
    effects: vi.fn(),
    ...overrides,
  };
}

describe('integration registry contracts', () => {
  it('SWM1.R3.S02 declares OpenCode profile effects and keeps checks read-only', async () => {
    const opencode = PRODUCTION_INTEGRATIONS.find(entry => entry.id === 'opencode');
    if (opencode === undefined) throw new Error('Expected the OpenCode integration adapter.');
    const context = {
      cwd: '/project',
      agents: ['opencode'],
      scope: 'project',
      observation: createResult({
        state: 'action_required',
        data: { installed: false },
      }),
    } as const;

    const install = await opencode.effects({ ...context, operation: 'install' });
    const check = await opencode.effects({ ...context, operation: 'check' });
    const uninstall = await opencode.effects({
      ...context,
      operation: 'uninstall',
      observation: createResult({
        state: 'healthy',
        data: { installed: true, profile_removable: true },
      }),
    });

    expect(install.files.map(effect => effect.target)).toEqual([
      'OpenCode profile plugin',
      'OpenCode Safeword identity',
      'OpenCode Safeword dispatcher',
    ]);
    expect(check).toEqual({
      files: [],
      packages: [],
      configuration: [],
      network: [],
      destructive: [],
    });
    expect(uninstall.destructive).toHaveLength(3);

    const partialUninstall = await opencode.effects({
      ...context,
      operation: 'uninstall',
      observation: createResult({
        state: 'action_required',
        data: { installed: false, profile_removable: true },
      }),
    });
    expect(partialUninstall.destructive).toHaveLength(3);

    for (const id of ['claude', 'codex']) {
      const integration = PRODUCTION_INTEGRATIONS.find(entry => entry.id === id);
      if (integration === undefined) throw new Error(`Expected the ${id} integration adapter.`);
      expect(await integration.effects({ ...context, operation: 'check' })).toEqual(check);
    }
  });

  it('SWM1.R1.S02 rejects an adapter without ownership declarations', () => {
    expect(() =>
      defineIntegrationAdapter({
        ...adapter(),
        project: undefined,
      } as unknown as IntegrationAdapter),
    ).toThrow(/ownership/i);
  });

  it('SWM1.R1.S03 rejects a capability claim its lifecycle declaration cannot honor', () => {
    expect(() =>
      defineIntegrationAdapter(
        adapter({
          capabilities: {
            ...adapter().capabilities,
            activation: { availability: 'available' },
          },
        } as unknown as IntegrationAdapter),
      ),
    ).toThrow(/activation|proof/i);
  });

  it.each([
    ['an observational hook', ['stop']],
    ['an unknown hook', ['before_everything']],
  ])('SWM1.R3 rejects blockableHooks containing %s', (_name, blockableHooks) => {
    expect(() =>
      defineIntegrationAdapter(
        adapter({
          capabilities: {
            ...adapter().capabilities,
            blockableHooks,
          } as unknown as IntegrationAdapter['capabilities'],
        }),
      ),
    ).toThrow(/blockable hook/i);
  });

  it('SWM1.R3.S07 coordinates every selected registered integration exactly once', async () => {
    const claude = adapter();
    const codex = adapter({ id: 'codex' });
    const cursor = adapter({
      id: 'cursor',
      defaultSelected: false,
      project: { owned: ['cursor'], shared: ['skills'] },
      profile: { available: false },
      capabilities: {
        lifecycle: {
          session_start: 'unavailable',
          prompt_submit: 'unavailable',
          pre_tool: 'block',
          post_tool: 'observe',
          stop: 'observe',
        },
        blockableHooks: ['pre_tool'],
        activation: { availability: 'unavailable' },
        conformance: { availability: 'unavailable' },
      },
    });
    const registry = createIntegrationRegistry([claude, codex, cursor]);
    const visit = vi.fn((entry: IntegrationAdapter) => Promise.resolve(entry.id));

    await expect(
      coordinateSelectedIntegrations(registry, ['cursor', 'claude', 'codex'], visit),
    ).resolves.toEqual(['claude', 'codex', 'cursor']);
    expect(visit).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['duplicate id', [adapter(), adapter()]],
    [
      'unknown lifecycle strength',
      [
        adapter({
          capabilities: {
            ...adapter().capabilities,
            lifecycle: { ...adapter().capabilities.lifecycle, pre_tool: 'absolute' },
          } as unknown as IntegrationAdapter['capabilities'],
        }),
      ],
    ],
  ])('SWM1.R3.S08 rejects %s', (_name, entries) => {
    expect(() => createIntegrationRegistry(entries)).toThrow();
  });
});
