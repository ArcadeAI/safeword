import { globSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const CUSTOMER_GUIDANCE_SURFACES = [
  ['README.md', ''],
  ['ARCHITECTURE.md', ''],
  ['AGENTS.md', ''],
  ['features/safeword-lane.feature', ''],
  ['plugin', '**/*.{md,mdx}'],
  ['packages/website/src/content/docs', '**/*.{md,mdx}'],
  ['packages/cli/templates', '**/*.{md,mdx,feature,ts,sh,json,yml,yaml}'],
  ['packages/cli/codex-plugin/skills', '**/*.{md,mdx}'],
  ['packages/cli/src/health.ts', ''],
  ['packages/cli/src/commands/architecture.ts', ''],
  ['packages/cli/src/learning-sync/index.ts', ''],
  ['packages/cli/src/ticket-sync/index.ts', ''],
  ['packages/cli/src/tracker-sync/clients.ts', ''],
  ['packages/cli/src/retro/finding.ts', ''],
  ['packages/cli/src/utils/architecture-document.ts', ''],
  ['packages/cli/src/utils/test-skeleton.ts', ''],
  ['packages/cli/src/utils/ticket-index-warnings.ts', ''],
  ['packages/cli/src/packs', '**/files.ts'],
  ['packages/cli/src/templates/config.ts', ''],
  ['.claude/skills', '**/*.{md,mdx}'],
  ['.safeword/guides', '**/*.{md,mdx}'],
  ['.safeword/templates', '**/*.{md,mdx}'],
  ['.safeword/hooks', '**/*.{ts,sh}'],
] as const;

const DEPRECATED_INVOCATIONS = [
  /\b(?:bunx[ \t]+)?safeword(?:@latest)?[ \t]+(?:check|upgrade|diff|reset|sync-config)(?=$|[^\w-])/g,
  /\b(?:bunx[ \t]+)?safeword(?:@latest)?[ \t]+(?:architecture|sync-learnings|sync-tickets|codify|test-plan)(?=$|[^\w-])/g,
  /\b(?:bunx[ \t]+)?safeword(?:@latest)?[ \t]+(?:lint-gherkin|sync-tracker|connect|self-report|retro-reconcile)(?=$|[^\w-])/g,
  /\b(?:bunx[ \t]+)?safeword(?:@latest)?[ \t]+retro(?=[ \t]+--|`)/g,
] as const;

function surfaceFiles(path: string, pattern: string): string[] {
  const absolute = nodePath.join(REPO_ROOT, path);
  if (pattern === '') return [absolute];
  return globSync(pattern, { cwd: absolute }).map(file => nodePath.join(absolute, file));
}

describe('public CLI documentation', () => {
  it('teaches canonical v0.70 command names instead of retained aliases', () => {
    const generatedIndexHeaders = [
      '.project/learnings/INDEX.md',
      '.project/tickets/INDEX.md',
      '.project/tickets/INDEX-completed.md',
    ].map(file => readFileSync(nodePath.join(REPO_ROOT, file), 'utf8').split('\n').slice(0, 4));
    expect(generatedIndexHeaders).toEqual([
      expect.arrayContaining([expect.stringContaining('safeword project sync-learnings')]),
      expect.arrayContaining([expect.stringContaining('safeword project sync-tickets')]),
      expect.arrayContaining([expect.stringContaining('safeword project sync-tickets')]),
    ]);

    const staleInvocations = CUSTOMER_GUIDANCE_SURFACES.flatMap(([path, pattern]) =>
      surfaceFiles(path, pattern),
    ).flatMap(file => {
      const content = readFileSync(file, 'utf8');
      const matches = DEPRECATED_INVOCATIONS.flatMap(pattern =>
        content.matchAll(pattern).toArray(),
      );
      return matches.map(match => ({
        file: nodePath.relative(REPO_ROOT, file),
        invocation: match[0],
      }));
    });

    expect(staleInvocations).toEqual([]);
  });
});
