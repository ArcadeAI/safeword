import { globSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { compatibilityRoutes } from '../../src/cli-protocol/catalog.js';

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
  it('documents user-scoped Claude activation as the default', () => {
    const scopeGuides = [
      'README.md',
      'plugin/README.md',
      'packages/website/src/content/docs/getting-started/faq.mdx',
      'packages/website/src/content/docs/getting-started/quick-start.mdx',
      'packages/website/src/content/docs/reference/cli.mdx',
      'packages/website/src/content/docs/reference/configuration.mdx',
      'packages/website/src/content/docs/reference/hooks-and-skills.mdx',
    ];

    for (const file of scopeGuides) {
      const content = readFileSync(nodePath.join(REPO_ROOT, file), 'utf8');
      expect(content, file).toMatch(/user[- ]scope|user profile|profile-wide/iu);
      expect(content, file).toContain('--scope project');
      expect(content, file).not.toMatch(
        /project[- ]scoped? (?:[ia]s )?the default|defaults? to project scope/iu,
      );
    }
  });

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

    const canonicalLifecycleProse = [
      'README.md',
      'AGENTS.md',
      'ARCHITECTURE.md',
      '.claude/skills/versioning/SKILL.md',
      'packages/website/src/content/docs/getting-started/faq.mdx',
      'packages/website/src/content/docs/getting-started/quick-start.mdx',
      'packages/website/src/content/docs/reference/configuration.mdx',
      'packages/website/src/content/docs/reference/hooks-and-skills.mdx',
      'packages/cli/src/lifecycle/project-install.ts',
    ].map(file => ({ file, content: readFileSync(nodePath.join(REPO_ROOT, file), 'utf8') }));
    const staleLifecycleProse = canonicalLifecycleProse.flatMap(({ file, content }) =>
      [
        /safeword(?:@latest)?[ \t]+setup(?=$|[^\w-])/gimu,
        /safeword(?:@latest)?[ \t]+remove(?=$|[^\w-])/gimu,
        /\bSetup (writes|commits|scaffolds|creates|may remove)/gu,
        /(?:before running|retrying|converge) setup/giu,
        /Project setup/gu,
        /### Setup Convergence Flow/gu,
      ].flatMap(pattern =>
        content
          .matchAll(pattern)
          .filter(match => {
            const matchIndex = match.index ?? 0;
            const start = content.lastIndexOf('\n', matchIndex) + 1;
            const end = content.indexOf('\n', matchIndex);
            const line = end === -1 ? content.slice(start) : content.slice(start, end);
            return !/compatib|deprecated|historical|retained/iu.test(line);
          })
          .map(match => ({ file, phrase: match[0] }))
          .toArray(),
      ),
    );

    expect(staleLifecycleProse).toEqual([]);
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
    const sharedContext = readFileSync(nodePath.join(REPO_ROOT, 'AGENTS.md'), 'utf8');

    expect(installedGuide).toBe(templateGuide);
    expect(templateGuide).toContain('Claude Code supports `CLAUDE.local.md`');
    expect(templateGuide).toContain('`@~/.claude/my-project-instructions.md`');
    expect(templateGuide).toContain('max depth: 4 hops');
    expect(templateGuide).not.toContain('`*.local.md` is no longer recommended');
    expect(templateGuide).not.toContain('max depth: 5 hops');
    expect(claudeContext).toBe('@./AGENTS.md\n');
    expect(sharedContext).toContain('## Development and Release');
    expect(sharedContext).toContain('### Version Management');
    expect(sharedContext).toContain('### Test Execution');
    expect(sharedContext).toContain('Publish is CI-driven via OIDC trusted publishing');
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

  it('publishes the exhaustive lifecycle and compatibility reference', () => {
    const reference = readFileSync(
      nodePath.join(REPO_ROOT, 'packages/website/src/content/docs/reference/cli.mdx'),
      'utf8',
    );
    const compatibilitySection = reference
      .split('## Compatibility routes', 2)[1]
      ?.split('\n## ', 1)[0];

    expect(compatibilitySection).toBeDefined();
    for (const { route, replacement } of compatibilityRoutes) {
      const displayedRoute = route === 'bare safeword' ? 'bare `safeword`' : `\`${route}\``;
      expect(compatibilitySection, route).toContain(`| ${displayedRoute}`);
      expect(compatibilitySection, replacement).toContain(`\`${replacement}\``);
    }
    expect(reference).toContain('safeword review run <kind> <targets...>');
    expect(reference).toContain('safeword retro-relay-retry [request-id]');
    expect(reference).toContain('safeword retro-relay-discard <request-id> [--confirm]');
    expect(reference).toContain('### safeword codex clean-guidance');
    expect(reference).toContain('destructive deactivation');
    expect(reference).toContain('Creates or merges only with `--agents=cursor`');
  });
});
