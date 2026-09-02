import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ReviewAuthor } from '../../src/review/contract.js';
import { readConfiguredReviewRoutes, reviewRoutePlan } from '../../src/review/policy.js';

describe('review route policy', () => {
  function project(config: unknown): string {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-routes-'));
    mkdirSync(nodePath.join(directory, '.safeword'));
    writeFileSync(nodePath.join(directory, '.safeword', 'config.json'), JSON.stringify(config));
    return directory;
  }

  it('keeps preferred pairs and adds one independent OpenCode fallback', () => {
    expect(reviewRoutePlan('claude')).toEqual({
      author: 'claude',
      preferred: 'codex',
      independentFallback: 'opencode',
      degradedFallback: 'claude',
    });
    expect(reviewRoutePlan('codex')).toEqual({
      author: 'codex',
      preferred: 'claude',
      independentFallback: 'opencode',
      degradedFallback: 'codex',
    });
    expect(reviewRoutePlan('opencode')).toEqual({
      author: 'opencode',
      preferred: 'claude',
      independentFallback: 'codex',
      degradedFallback: 'opencode',
    });
  });

  it.each<ReviewAuthor>(['cursor', 'unknown'])(
    'keeps unsupported author %s outside review routing',
    author => {
      expect(reviewRoutePlan(author)).toBeUndefined();
    },
  );

  it('uses an ordered reviewer and model list as the complete route authority', () => {
    const cwd = project({
      crossAgentReviewRoutes: {
        claude: [
          { reviewer: 'opencode', model: 'vendor/model-b' },
          { reviewer: 'codex', model: 'model-a' },
          { reviewer: 'claude' },
        ],
      },
      crossAgentReviewPrimaryModel: { codex: 'legacy-primary' },
    });

    expect(readConfiguredReviewRoutes(cwd, 'claude')).toEqual([
      { reviewer: 'opencode', model: 'vendor/model-b', independence: 'cross-agent' },
      { reviewer: 'codex', model: 'model-a', independence: 'cross-agent' },
      { reviewer: 'claude', independence: 'degraded' },
    ]);
  });

  it.each([
    { crossAgentReviewRoutes: { claude: [] } },
    { crossAgentReviewRoutes: { claude: [{ reviewer: 'codex', model: '--quiet' }] } },
    { crossAgentReviewRoutes: { claude: [{ reviewer: 'cursor' }] } },
  ])('rejects invalid ordered route configuration %#', config => {
    expect(() => readConfiguredReviewRoutes(project(config), 'claude')).toThrow(
      'crossAgentReviewRoutes',
    );
  });

  it('ignores routes for unknown future authors', () => {
    const cwd = project({
      crossAgentReviewRoutes: {
        claude: [{ reviewer: 'codex' }],
        future: [{ reviewer: 'opencode' }],
      },
    });

    expect(readConfiguredReviewRoutes(cwd, 'claude')).toEqual([
      { reviewer: 'codex', independence: 'cross-agent' },
    ]);
  });

  it('leaves the existing plan in authority when ordered routes are absent', () => {
    const cwd = project({ crossAgentReviewAlternateModel: { codex: 'alternate' } });
    expect(readConfiguredReviewRoutes(cwd, 'claude')).toBeUndefined();
  });

  it('rejects malformed project configuration instead of silently falling back', () => {
    const cwd = project({});
    writeFileSync(nodePath.join(cwd, '.safeword', 'config.json'), '{ malformed');

    expect(() => readConfiguredReviewRoutes(cwd, 'claude')).toThrow('expected valid JSON');
  });
});
