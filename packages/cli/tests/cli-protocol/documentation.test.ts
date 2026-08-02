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

  it('keeps Claude context guidance aligned with current Claude Code behavior', () => {
    const templateGuide = readFileSync(
      nodePath.join(REPO_ROOT, 'packages/cli/templates/guides/context-files-guide.md'),
      'utf8',
    );
    const installedGuide = readFileSync(
      nodePath.join(REPO_ROOT, '.safeword/guides/context-files-guide.md'),
      'utf8',
    );
    const claudeContext = readFileSync(nodePath.join(REPO_ROOT, 'CLAUDE.md'), 'utf8');

    expect(installedGuide).toBe(templateGuide);
    expect(templateGuide).toContain('Claude Code supports `CLAUDE.local.md`');
    expect(templateGuide).toContain('`@~/.claude/my-project-instructions.md`');
    expect(templateGuide).toContain('max depth: 4 hops');
    expect(templateGuide).not.toContain('`*.local.md` is no longer recommended');
    expect(templateGuide).not.toContain('max depth: 5 hops');
    expect(claudeContext).toContain('@./AGENTS.md');
    expect(claudeContext).not.toContain('---@./AGENTS.md');
  });

  it('keeps generated architecture prose ready for human architecture review', () => {
    const generatedArchitectureFiles = [
      '.project/architecture.generated.md',
      'packages/cli/architecture.generated.md',
      'packages/website/architecture.generated.md',
    ];

    for (const file of generatedArchitectureFiles) {
      const content = readFileSync(nodePath.join(REPO_ROOT, file), 'utf8');
      expect(content, file).not.toContain('No description yet');
      expect(content, file).not.toContain('⚠ stale');
      expect(content, file).not.toContain('⚠ orphaned');
    }
  });
});
