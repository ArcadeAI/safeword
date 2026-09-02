import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { invocationCatalog, publicCommands } from '../../src/cli-protocol/catalog.js';
import { createTemporaryDirectory, runCliWithLiteralArguments } from '../helpers.js';

interface FixtureExecution {
  readonly route: string;
  readonly result: {
    readonly exitCode: number;
    readonly stderr: string;
    readonly stdout: string;
    readonly timedOut: boolean;
  };
}

function fixtureFailures(executions: readonly FixtureExecution[]): string[] {
  return executions
    .toSorted((left, right) => left.route.localeCompare(right.route))
    .flatMap(({ route, result }) => {
      const failures: string[] = [];
      if (result.timedOut) failures.push(`${route}: timed out`);
      if (result.stderr !== '') failures.push(`${route}: unexpected stderr: ${result.stderr}`);
      if (![0, 1, 2].includes(result.exitCode)) {
        failures.push(`${route}: unexpected exit ${String(result.exitCode)}`);
      }
      try {
        JSON.parse(result.stdout);
      } catch {
        failures.push(`${route}: malformed machine output`);
      }
      return failures;
    });
}

async function mapWithConcurrency<Input, Output>(
  inputs: readonly Input[],
  concurrency: number,
  operation: (input: Input) => Promise<Output>,
): Promise<Output[]> {
  const results: Output[] = [];
  const indexedInputs = inputs.map((input, index) => ({ index, input }));
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, inputs.length) }, async () => {
    while (next < indexedInputs.length) {
      const indexedInput = indexedInputs[next++];
      if (indexedInput === undefined) break;
      results[indexedInput.index] = await operation(indexedInput.input);
    }
  });
  await Promise.all(workers);
  return results;
}

describe('public command machine contract', () => {
  it('executes every catalog fixture as deterministic JSON without prompting', async () => {
    const executions = await mapWithConcurrency(publicCommands, 2, async definition => {
      const directory = createTemporaryDirectory();
      const invoke = async () =>
        runCliWithLiteralArguments(
          [...definition.fixture.argv, '--json', '--no-input', '--offline', '--cwd', directory],
          {
            cwd: directory,
            env: { ...definition.fixture.environment, XDG_CONFIG_HOME: directory },
            timeout: 30_000,
          },
        );
      const first = await invoke();
      rmSync(directory, { force: true, recursive: true });
      mkdirSync(directory, { recursive: true });
      const second = await invoke();
      return { definition, first, second };
    });

    expect(
      fixtureFailures(
        executions.map(({ definition, first }) => ({ route: definition.name, result: first })),
      ),
    ).toEqual([]);

    for (const { definition, first, second } of executions) {
      expect(first.stdout, definition.name).toBe(second.stdout);
      const envelope = JSON.parse(first.stdout) as {
        findings: { code: string }[];
      };
      expect(
        envelope.findings.some(finding => finding.code === 'CLI_ADAPTER_REQUIRED'),
        `${definition.name} used a synthetic adapter instead of its real handler`,
      ).toBe(false);
    }
  }, 180_000);

  it('aggregates timeout, malformed output, and contract failures once in stable route order', () => {
    expect(
      fixtureFailures([
        {
          route: 'zeta',
          result: { exitCode: 0, stderr: '', stdout: 'not json', timedOut: true },
        },
        {
          route: 'alpha',
          result: { exitCode: 9, stderr: 'bad', stdout: '{}', timedOut: false },
        },
      ]),
    ).toEqual([
      'alpha: unexpected stderr: bad',
      'alpha: unexpected exit 9',
      'zeta: timed out',
      'zeta: malformed machine output',
    ]);
  });

  it('executes every argv rewrite and bare default through the built CLI', async () => {
    const compatibilityInvocations = invocationCatalog.filter(
      invocation => invocation.kind === 'argv-rewrite' || invocation.kind === 'default',
    );
    expect(compatibilityInvocations.length).toBeGreaterThan(0);
    const executions = await mapWithConcurrency(compatibilityInvocations, 2, async invocation => {
      assert.ok(invocation.fixture, invocation.route);
      const fixture = invocation.fixture;
      const directory = createTemporaryDirectory();
      const result = await runCliWithLiteralArguments(
        [...fixture.argv, '--json', '--no-input', '--offline', '--cwd', directory],
        {
          cwd: directory,
          env: { ...fixture.environment, XDG_CONFIG_HOME: directory },
          timeout: 30_000,
        },
      );
      return { invocation, result };
    });

    for (const { invocation, result } of executions) {
      expect(result.stderr, invocation.route).toBe('');
      expect([0, 1, 2], invocation.route).toContain(result.exitCode);
      expect(() => JSON.parse(result.stdout), invocation.route).not.toThrow();
    }
  }, 60_000);
});
