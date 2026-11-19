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
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-model-defaults-'));
  projects.push(directory);
  mkdirSync(nodePath.join(directory, '.safeword'));
  writeFileSync(nodePath.join(directory, '.safeword/config.json'), JSON.stringify(config));
  return directory;
}

it.each(['quality-review', 'scenario-gate', 'plan-implementation', 'plan-execution'] as const)(
  'uses the latest Opus then Sonnet for a Codex-authored %s review',
  () => {
    expect(builtInReviewRoutes(project(), 'codex')).toEqual([
      { reviewer: 'claude', model: 'opus', independence: 'cross-agent' },
      { reviewer: 'claude', model: 'sonnet', independence: 'cross-agent' },
      { reviewer: 'opencode', independence: 'cross-agent' },
      { reviewer: 'codex', model: 'gpt-6.1-sol', independence: 'degraded' },
      { reviewer: 'codex', model: 'gpt-6.1-terra', independence: 'degraded' },
    ]);
  },
);

it('uses the latest Sol then Terra for Claude-authored reviews', () => {
  expect(builtInReviewRoutes(project(), 'claude')).toEqual([
    { reviewer: 'codex', model: 'gpt-6.1-sol', independence: 'cross-agent' },
    { reviewer: 'codex', model: 'gpt-6.1-terra', independence: 'cross-agent' },
    { reviewer: 'opencode', independence: 'cross-agent' },
    { reviewer: 'claude', model: 'opus', independence: 'degraded' },
    { reviewer: 'claude', model: 'sonnet', independence: 'degraded' },
  ]);
});

it('gives the Codex fallback its Sol then Terra chain for Cursor-authored reviews', () => {
  expect(builtInReviewRoutes(project(), 'cursor')).toEqual([
    { reviewer: 'claude', model: 'opus', independence: 'cross-agent' },
    { reviewer: 'claude', model: 'sonnet', independence: 'cross-agent' },
    { reviewer: 'codex', model: 'gpt-6.1-sol', independence: 'cross-agent' },
    { reviewer: 'codex', model: 'gpt-6.1-terra', independence: 'cross-agent' },
  ]);
});

it('preserves configured primary and alternate models', () => {
  const directory = project({
    crossAgentReviewPrimaryModel: { claude: 'custom-primary', codex: 'custom-fallback' },
    crossAgentReviewAlternateModel: { claude: 'custom-alternate' },
  });
  expect(builtInReviewRoutes(directory, 'codex')).toEqual([
    { reviewer: 'claude', model: 'custom-primary', independence: 'cross-agent' },
    { reviewer: 'claude', model: 'custom-alternate', independence: 'cross-agent' },
    { reviewer: 'opencode', independence: 'cross-agent' },
    { reviewer: 'codex', model: 'custom-fallback', independence: 'degraded' },
    { reviewer: 'codex', model: 'gpt-6.1-terra', independence: 'degraded' },
  ]);
});

it('keeps environment model overrides ahead of project settings', () => {
  vi.stubEnv('SAFEWORD_REVIEW_PRIMARY_MODEL_CLAUDE', 'environment-primary');
  const directory = project({ crossAgentReviewPrimaryModel: { claude: 'project-primary' } });
  expect(builtInReviewRoutes(directory, 'codex')[0]?.model).toBe('environment-primary');
});
