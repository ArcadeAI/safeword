import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { builtInReviewRoutes } from '../../src/review/policy.js';

const projects: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of projects) rmSync(directory, { recursive: true, force: true });
  projects.length = 0;
});

function project(config: unknown = {}): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-execution-defaults-'));
  projects.push(directory);
  mkdirSync(nodePath.join(directory, '.safeword'));
  writeFileSync(nodePath.join(directory, '.safeword/config.json'), JSON.stringify(config));
  return directory;
}

it('selects exact Execution reviewer defaults in the existing route order', () => {
  expect(builtInReviewRoutes(project(), 'codex', 'plan-execution')).toEqual([
    { reviewer: 'claude', model: 'claude-opus-5', independence: 'cross-agent' },
    { reviewer: 'opencode', independence: 'cross-agent' },
    { reviewer: 'codex', model: 'gpt-6.1-sol', independence: 'degraded' },
  ]);
});

it('pins the independent Codex fallback for Cursor Execution reviews', () => {
  expect(builtInReviewRoutes(project(), 'cursor', 'plan-execution')).toEqual([
    { reviewer: 'claude', model: 'claude-opus-5', independence: 'cross-agent' },
    { reviewer: 'codex', model: 'gpt-6.1-sol', independence: 'cross-agent' },
  ]);
});

it('preserves configured primary and alternate models for Execution reviews', () => {
  const directory = project({
    crossAgentReviewPrimaryModel: { claude: 'custom-primary', codex: 'custom-fallback' },
    crossAgentReviewAlternateModel: { claude: 'custom-alternate' },
  });
  expect(builtInReviewRoutes(directory, 'codex', 'plan-execution')).toEqual([
    { reviewer: 'claude', model: 'custom-primary', independence: 'cross-agent' },
    { reviewer: 'claude', model: 'custom-alternate', independence: 'cross-agent' },
    { reviewer: 'opencode', independence: 'cross-agent' },
    { reviewer: 'codex', model: 'custom-fallback', independence: 'degraded' },
  ]);
});

it('keeps environment model overrides ahead of project settings', () => {
  vi.stubEnv('SAFEWORD_REVIEW_PRIMARY_MODEL_CLAUDE', 'environment-primary');
  const directory = project({ crossAgentReviewPrimaryModel: { claude: 'project-primary' } });
  expect(builtInReviewRoutes(directory, 'codex', 'plan-execution')[0]?.model).toBe(
    'environment-primary',
  );
});

it.each(['quality-review', 'plan-implementation'] as const)(
  'preserves existing model defaults for %s',
  kind => {
    expect(builtInReviewRoutes(project(), 'codex', kind)).toEqual([
      { reviewer: 'claude', model: 'opus', independence: 'cross-agent' },
      { reviewer: 'claude', model: 'sonnet', independence: 'cross-agent' },
      { reviewer: 'opencode', independence: 'cross-agent' },
      { reviewer: 'codex', independence: 'degraded' },
    ]);
  },
);
