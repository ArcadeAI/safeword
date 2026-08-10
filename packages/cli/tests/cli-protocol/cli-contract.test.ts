import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { invocationCatalog, type InvocationContract } from '../../src/cli-protocol/catalog.js';
import { commanderOwnedOptions, reconcileCliProgram } from '../../src/cli-protocol/contract.js';
import { createCliProgram } from '../../src/cli-protocol/program.js';

const firstInvocation = invocationCatalog[0];
if (firstInvocation === undefined) throw new Error('CLI invocation catalog cannot be empty');

describe('production CLI contract reconciliation', () => {
  it('reconciles the exhaustive catalog with the assembled production program', () => {
    expect(reconcileCliProgram(createCliProgram())).toEqual([]);
  });

  it('rejects a production route registered outside the catalog', () => {
    const program = createCliProgram();
    program.command('outside-contract');

    expect(reconcileCliProgram(program)).toContainEqual(
      expect.objectContaining({
        code: 'CLI_CONTRACT_UNCLASSIFIED_INVOCATION',
        route: 'outside-contract',
      }),
    );
  });

  it('rejects a catalogued retained alias missing from the runtime tree', () => {
    const program = createCliProgram();
    const setup = program.commands.find(command => command.name() === 'setup');
    assert.ok(setup);
    (
      program.commands as typeof program.commands extends readonly (infer Item)[] ? Item[] : never
    ).splice(program.commands.indexOf(setup), 1);

    expect(reconcileCliProgram(program)).toContainEqual(
      expect.objectContaining({
        code: 'CLI_CONTRACT_MISSING_REGISTRATION',
        route: 'setup',
      }),
    );
  });

  it('rejects one runtime option shape change with the exact route and flag', () => {
    const program = createCliProgram();
    const install = program.commands.find(command => command.name() === 'install');
    const agents = install?.options.find(option => option.long === '--agents');
    assert.ok(agents);
    agents.optional = true;
    agents.required = false;

    expect(reconcileCliProgram(program)).toContainEqual(
      expect.objectContaining({
        code: 'CLI_CONTRACT_OPTION_MISMATCH',
        route: 'install',
        flag: '--agents',
        field: 'required',
      }),
    );
  });

  it.each([
    {
      field: 'conflicts',
      mutate: (option: NonNullable<ReturnType<typeof installAgentsOption>>) =>
        option.conflicts('scope'),
    },
    {
      field: 'implies',
      mutate: (option: NonNullable<ReturnType<typeof installAgentsOption>>) =>
        option.implies({ scope: 'user' }),
    },
  ])('pins Commander option relation inspection: $field', ({ field, mutate }) => {
    const program = createCliProgram();
    const agents = installAgentsOption(program);
    assert.ok(agents);
    mutate(agents);

    expect(reconcileCliProgram(program)).toContainEqual(
      expect.objectContaining({
        code: 'CLI_CONTRACT_OPTION_MISMATCH',
        route: 'install',
        flag: '--agents',
        field,
      }),
    );
  });

  it.each([
    {
      defect: [...invocationCatalog, firstInvocation],
      code: 'CLI_CONTRACT_DUPLICATE_CLASSIFICATION',
      route: firstInvocation.route,
    },
    {
      defect: invocationCatalog.map((contract, index) =>
        index === 0 ? { ...contract, classification: 'future' } : contract,
      ),
      code: 'CLI_CONTRACT_UNKNOWN_CLASSIFICATION',
      route: firstInvocation.route,
    },
    {
      defect: invocationCatalog.map(contract =>
        contract.kind === 'default' ? { ...contract, target: 'not-a-command' } : contract,
      ),
      code: 'CLI_CONTRACT_MISSING_TARGET',
      route: 'bare safeword',
    },
    {
      defect: invocationCatalog.map(contract =>
        contract.kind === 'default'
          ? { ...contract, target: 'status nonexistent-subcommand' }
          : contract,
      ),
      code: 'CLI_CONTRACT_MISSING_TARGET',
      route: 'bare safeword',
    },
  ])('rejects invalid catalog ownership: $code', ({ defect, code, route }) => {
    expect(
      reconcileCliProgram(createCliProgram(), defect as readonly InvocationContract[]),
    ).toContainEqual(expect.objectContaining({ code, route }));
  });

  it('pins the repaired high-risk lifecycle and compatibility contracts independently', () => {
    const baseline = JSON.parse(
      readFileSync(new URL('../fixtures/cli-contract-baseline.json', import.meta.url), 'utf8'),
    ) as {
      commands: Record<string, { syntax: string; options: string[] }>;
      rewrites: Record<string, string>;
    };
    const actualCommands = Object.fromEntries(
      Object.keys(baseline.commands).map(route => {
        const contract = invocationCatalog.find(invocation => invocation.route === route);
        assert.ok(contract?.command, route);
        return [
          route,
          {
            syntax: contract.command.registration.syntax,
            options: contract.command.registration.options.map(option => option.flags),
          },
        ];
      }),
    );
    const actualRewrites = Object.fromEntries(
      Object.keys(baseline.rewrites).map(route => {
        const contract = invocationCatalog.find(invocation => invocation.route === route);
        assert.ok(contract, route);
        return [route, contract.target];
      }),
    );

    expect(actualCommands).toEqual(baseline.commands);
    expect(actualRewrites).toEqual(baseline.rewrites);
  });

  it('derives only help and root version as Commander-owned options', () => {
    const owned = commanderOwnedOptions(createCliProgram());

    expect(new Set(owned.map(option => option.flags))).toEqual(
      new Set(['-V, --version', '-h, --help']),
    );
    expect(owned.filter(option => option.flags === '-V, --version')).toEqual([
      { route: 'safeword', flags: '-V, --version' },
    ]);
    expect(owned).toContainEqual({ route: 'install', flags: '-h, --help' });
  });
});

function installAgentsOption(program: ReturnType<typeof createCliProgram>) {
  return program.commands
    .find(command => command.name() === 'install')
    ?.options.find(option => option.long === '--agents');
}
