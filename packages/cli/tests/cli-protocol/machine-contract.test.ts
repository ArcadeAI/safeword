import assert from 'node:assert/strict';

import { describe, expect, it } from 'vitest';

import { invocationCatalog, publicCommands } from '../../src/cli-protocol/catalog.js';
import { createTemporaryDirectory, runCliWithLiteralArguments } from '../helpers.js';

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
      const invoke = async () => {
        const directory = createTemporaryDirectory();
        return runCliWithLiteralArguments(
          [...definition.fixture.argv, '--json', '--no-input', '--offline', '--cwd', directory],
          {
            cwd: directory,
            env: definition.fixture.environment,
            timeout: 30_000,
          },
        );
      };
      const first = await invoke();
      const second = await invoke();
      return { definition, first, second };
    });

    for (const { definition, first, second } of executions) {
      expect(first.stderr, definition.name).toBe('');
      expect([0, 1, 2], definition.name).toContain(first.exitCode);
      expect(() => JSON.parse(first.stdout), definition.name).not.toThrow();
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
          env: fixture.environment,
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
