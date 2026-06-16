import { describe, expect, it } from 'vitest';

import { renderShellPlan } from '../../src/test-plan/render';
import type { PlanEntry } from '../../src/test-plan/resolve';

function entry(over: Partial<PlanEntry>): PlanEntry {
  return {
    language: 'go',
    cwd: '/repo',
    command: 'go test ./...',
    runner: 'go',
    available: true,
    ...over,
  };
}

describe('renderShellPlan', () => {
  it('renders an available entry as a cd-scoped command', () => {
    const sh = renderShellPlan([entry({ cwd: '/repo', command: 'go test ./...' })]);
    expect(sh).toContain('( cd "/repo" && go test ./... )');
  });

  it('starts a non-empty script with set -e (fails the eval on a failing suite)', () => {
    expect(renderShellPlan([entry({})]).startsWith('set -e\n')).toBe(true);
  });

  it('renders an unavailable entry as a visible skip echo, not a command', () => {
    const sh = renderShellPlan([entry({ available: false, runner: 'go' })]);
    expect(sh).toContain('echo "⏭️ Skipped — go not installed"');
    expect(sh).not.toContain('( cd');
  });

  it('renders an empty plan as an empty string (a no-op under eval)', () => {
    expect(renderShellPlan([])).toBe('');
  });

  it('renders every entry for a polyglot plan', () => {
    const sh = renderShellPlan([
      entry({ language: 'javascript', command: 'bun run test', runner: 'bun' }),
      entry({ language: 'python', command: 'pytest', runner: 'pytest' }),
    ]);
    expect(sh).toContain('bun run test');
    expect(sh).toContain('pytest');
  });
});
