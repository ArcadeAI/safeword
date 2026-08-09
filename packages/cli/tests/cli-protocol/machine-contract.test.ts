import { describe, expect, it } from 'vitest';

import { publicCommands } from '../../src/cli-protocol/catalog.js';
import { createTemporaryDirectory, runCliWithLiteralArguments } from '../helpers.js';

describe('public command machine contract', () => {
  it('executes every catalog fixture as deterministic JSON without prompting', async () => {
    for (const definition of publicCommands) {
      const invoke = async () => {
        const directory = createTemporaryDirectory();
        return runCliWithLiteralArguments(
          [...definition.fixture.argv, '--json', '--no-input', '--offline', '--cwd', directory],
          {
            cwd: directory,
            env: definition.fixture.environment,
          },
        );
      };
      const first = await invoke();
      const second = await invoke();

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
});
