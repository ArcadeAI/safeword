import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { gatePhaseAdvance, type ReviewStamp } from '../../templates/hooks/lib/review-ledger.js';
import { verifiedStamps } from '../../templates/hooks/lib/verify-stamp-claims.js';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));

const scope = 'BUDGET-reader:phase@plan-execution';
const stamp = (reviewId: string): ReviewStamp => ({
  scope,
  reviewId,
  independence: 'cross-agent',
  author: 'codex',
  reviewer: 'claude',
});

describe('stamp verification checks recent receipts first within the shared budget', () => {
  let project: string;
  let plugin: string;
  let target: string;
  let responses: Record<string, { delay?: number; status?: string; id?: string; target?: string }>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    project = mkdtempSync(nodePath.join(tmpdir(), 'stamp-project-'));
    plugin = mkdtempSync(nodePath.join(tmpdir(), 'stamp-plugin-'));
    target = nodePath.join(project, '.project/tickets/BUDGET-reader/execution-plan.md');
    mkdirSync(nodePath.dirname(target), { recursive: true });
    writeFileSync(target, '# Current execution plan\n');
    mkdirSync(nodePath.join(plugin, 'runtime'));
    writeFileSync(nodePath.join(plugin, 'runtime/cli.js'), '// external coordinator boundary\n');
    vi.stubEnv('SAFEWORD_PLUGIN_CLI', nodePath.join(plugin, 'runtime/cli.js'));
    vi.stubEnv('CLAUDE_PLUGIN_ROOT', plugin);
    vi.stubEnv('CODEX_HOME', plugin);
    responses = {};
    vi.mocked(spawnSync).mockImplementation((program, args, options) => {
      if (program === 'git') return { status: 1, stdout: '', stderr: '' } as never;
      const arguments_ = args as string[];
      const id = arguments_[arguments_.indexOf('status') + 1] ?? '';
      const response = responses[id] ?? {};
      const delay = response.delay ?? 100;
      const timeout = (options as { timeout: number }).timeout;
      vi.setSystemTime(Date.now() + Math.min(delay, timeout));
      if (delay > timeout) return { stdout: '', error: new Error('ETIMEDOUT') } as never;
      return {
        status: 0,
        stdout: JSON.stringify({
          data: {
            review_id: response.id ?? id,
            status: response.status ?? 'approved',
            review_kind: 'plan-execution',
            review_targets: [response.target ?? target],
            independence: 'cross-agent',
            author_agent: 'codex',
            actual_reviewer: 'claude',
          },
        }),
      } as never;
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.clearAllMocks();
    rmSync(project, { recursive: true, force: true });
    rmSync(plugin, { recursive: true, force: true });
  });

  it('keeps the current approval reachable when historical lookups exhaust twelve seconds', () => {
    const history = ['old-one', 'old-two', 'old-three'];
    for (const id of history) responses[id] = { delay: 4500, status: 'stale' };
    const stamps = [...history.map(stamp), stamp('current')];
    const before = structuredClone(stamps);
    const started = Date.now();
    const verified = verifiedStamps(stamps, project, scope);
    expect(verified).toEqual([stamp('current')]);
    expect(gatePhaseAdvance(scope, verified)).toEqual({ ok: true });
    expect(Date.now() - started).toBe(12_000);
    expect(stamps).toEqual(before);
  });

  it('returns verified stamps in their original ledger order', () => {
    const stamps = [stamp('old'), stamp('new')];
    expect(verifiedStamps(stamps, project, scope)).toEqual(stamps);
  });

  it('falls through an invalid latest entry to an older valid approval within budget', () => {
    responses.latest = { status: 'stale' };
    expect(verifiedStamps([stamp('valid'), stamp('latest')], project, scope)).toEqual([
      stamp('valid'),
    ]);
  });

  it.each([
    ['stale', { status: 'stale' }],
    ['forged', { id: 'different-review' }],
    ['wrong-target', { target: 'foreign/execution-plan.md' }],
  ])('refuses %s coordinator evidence', (id, response) => {
    responses[id] = response;
    const verified = verifiedStamps([stamp(id)], project, scope);
    expect(verified).toEqual([]);
    expect(gatePhaseAdvance(scope, verified).ok).toBe(false);
  });

  it('does not spend receipt budget on another stamped scope', () => {
    const started = Date.now();
    expect(
      verifiedStamps([{ ...stamp('foreign'), scope: 'OTHER:phase:intake@x' }], project, scope),
    ).toEqual([]);
    expect(Date.now()).toBe(started);
  });
});
