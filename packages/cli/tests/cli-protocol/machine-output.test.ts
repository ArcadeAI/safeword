import { describe, expect, it } from 'vitest';

import { machineOutputRequested } from '../../src/cli-protocol/machine-output.js';

describe('machine output detection', () => {
  it('recognizes a literal global flag but not an attached option value with the same bytes', () => {
    expect(machineOutputRequested(['ticket', 'new', 'x', '--json'])).toBe(true);
    expect(machineOutputRequested(['ticket', 'new', 'x', '--title', '--json'])).toBe(true);
    expect(machineOutputRequested(['ticket', 'new', 'x', '--title=--json'])).toBe(false);
  });

  it('does not inspect operands after the option boundary', () => {
    expect(machineOutputRequested(['project', 'lint-gherkin', '--', '--json'])).toBe(false);
  });

  it('recognizes machine output after both boolean and value-taking options', () => {
    expect(machineOutputRequested(['tracker', 'sync', '--plan', '--json'])).toBe(true);
    expect(machineOutputRequested(['remove', '--plan', '--json'])).toBe(true);
  });
});
