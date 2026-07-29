import { describe, expect, it } from 'vitest';

import { commandCatalog } from '../../src/cli-protocol/catalog.js';
import { machineOutputRequested } from '../../src/cli-protocol/machine-output.js';

describe('machine output detection', () => {
  it('recognizes the global flag but not an option value with the same bytes', () => {
    expect(machineOutputRequested(['ticket', 'new', 'x', '--json'], commandCatalog)).toBe(true);
    expect(
      machineOutputRequested(['ticket', 'new', 'x', '--title', '--json'], commandCatalog),
    ).toBe(false);
  });

  it('does not inspect operands after the option boundary', () => {
    expect(
      machineOutputRequested(['project', 'lint-gherkin', '--', '--json'], commandCatalog),
    ).toBe(false);
  });

  it('scopes value-taking options to the selected command', () => {
    expect(machineOutputRequested(['tracker', 'sync', '--plan', '--json'], commandCatalog)).toBe(
      true,
    );
    expect(machineOutputRequested(['remove', '--plan', '--json'], commandCatalog)).toBe(false);
  });
});
