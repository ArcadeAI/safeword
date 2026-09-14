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
    expect(sh).toContain("( cd '/repo' && go test ./... )");
  });

  it('single-quotes the cwd so a maliciously-named directory cannot inject commands', () => {
    const sh = renderShellPlan([entry({ cwd: '/repo/$(touch PWNED)', command: 'go test ./...' })]);
    // The cwd is single-quoted verbatim — the $(...) is literal, never expanded.
    expect(sh).toContain("cd '/repo/$(touch PWNED)'");
    expect(sh).not.toContain('cd "');
  });

  it('escapes an embedded single quote in the cwd', () => {
    const sh = renderShellPlan([entry({ cwd: "/re'po", command: 'go test ./...' })]);
    expect(sh).toContain(String.raw`cd '/re'\''po'`);
  });

  it('wraps a non-empty plan in a subshell that preserves the first failing lane', () => {
    const sh = renderShellPlan([entry({})]);
    expect(sh).toMatch(/^\(\n {2}safeword_plan_status=0\n/);
    expect(sh).toContain('exit "$safeword_plan_status"');
  });

  it('renders an unavailable entry as a visible failing lane, not a command', () => {
    const sh = renderShellPlan([entry({ available: false, runner: 'go' })]);
    expect(sh).toContain(
      String.raw`printf '%s\n' 'Go test lane skipped: go is not installed.' >&2; false`,
    );
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
