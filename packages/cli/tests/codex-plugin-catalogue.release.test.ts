import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertCodexPluginCatalogue,
  assertCodexSkillMetadataBudget,
  CODEX_SKILL_METADATA_LIMIT,
  codexSkillMetadataCharacters,
  generateCodexPluginAssets,
} from '../src/codex-plugin/catalogue.js';
import { VERSION as CLI_VERSION } from '../src/version.js';

const CLI_ROOT = nodePath.resolve(import.meta.dirname, '..');
const CANONICAL_SKILLS = nodePath.join(CLI_ROOT, 'templates/skills');
const PLUGIN_SKILLS = nodePath.join(CLI_ROOT, 'codex-plugin/skills');

function markdownFiles(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => {
      const relativePath = nodePath.join(prefix, entry.name);
      const absolutePath = nodePath.join(directory, entry.name);
      if (entry.isDirectory()) return markdownFiles(absolutePath, relativePath);
      return entry.isFile() && entry.name.endsWith('.md') ? [relativePath] : [];
    })
    .toSorted((left, right) => left.localeCompare(right));
}

function expectedPluginAssets(): string[] {
  return markdownFiles(CANONICAL_SKILLS)
    .map(relativePath => {
      const [skill, filename, ...rest] = relativePath.split(nodePath.sep);
      if (skill === undefined || filename === undefined) {
        throw new Error(`unexpected canonical skill path: ${relativePath}`);
      }
      if (filename === 'SKILL.md') return nodePath.join(skill, filename, ...rest);
      return nodePath.join(skill, 'references', filename, ...rest);
    })
    .toSorted((left, right) => left.localeCompare(right));
}

describe('generated Codex plugin catalogue', () => {
  it('ships every canonical workflow and its supporting phase material', () => {
    const expectedAssets = expectedPluginAssets();
    const actualAssets = markdownFiles(PLUGIN_SKILLS);

    expect(actualAssets).toEqual(expectedAssets);

    const bddSkill = readFileSync(nodePath.join(PLUGIN_SKILLS, 'bdd/SKILL.md'), 'utf8');
    expect(bddSkill).toContain('references/DISCOVERY.md');
    expect(existsSync(nodePath.join(PLUGIN_SKILLS, 'bdd/references/DISCOVERY.md'))).toBe(true);
  });

  it('rejects missing phase material and unexpected generated workflow drift', () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-plugin-catalogue-'));
    const pluginDirectory = nodePath.join(fixture, 'codex-plugin');
    try {
      cpSync(nodePath.dirname(PLUGIN_SKILLS), pluginDirectory, { recursive: true });
      assertCodexPluginCatalogue(CANONICAL_SKILLS, pluginDirectory, CLI_VERSION);

      rmSync(nodePath.join(pluginDirectory, 'skills/bdd/references/DISCOVERY.md'));
      expect(() => {
        assertCodexPluginCatalogue(CANONICAL_SKILLS, pluginDirectory, CLI_VERSION);
      }).toThrow('missing expected asset');

      writeFileSync(
        nodePath.join(pluginDirectory, 'skills/bdd/references/DISCOVERY.md'),
        '# restored\n',
      );
      mkdirSync(nodePath.join(pluginDirectory, 'skills/unexpected'), { recursive: true });
      writeFileSync(nodePath.join(pluginDirectory, 'skills/unexpected/SKILL.md'), '# unexpected\n');
      expect(() => {
        assertCodexPluginCatalogue(CANONICAL_SKILLS, pluginDirectory, CLI_VERSION);
      }).toThrow('unexpected asset');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('allows only the documented source-to-Codex skill transformations', () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-plugin-transform-'));
    const canonicalSkillsDirectory = nodePath.join(fixture, 'skills');
    try {
      mkdirSync(nodePath.join(canonicalSkillsDirectory, 'alpha'), { recursive: true });
      mkdirSync(nodePath.join(canonicalSkillsDirectory, 'beta'), { recursive: true });
      writeFileSync(
        nodePath.join(canonicalSkillsDirectory, 'alpha/SKILL.md'),
        [
          '---',
          'name: alpha',
          'description: Invoke /beta and retain /beta.md, /beta/README.md, and /beta/_draft.md',
          'allowed-tools: Bash',
          '---',
          '',
          'Run /beta, preserve /outside, /beta/README.md, and /beta/_draft.md.',
          'Consult [TDD](TDD.md), [its loop](./TDD.md#loop), and [X-TDD](X-TDD.md).',
          'Leave [prefixed](references/TDD.md), [remote](https://example.com/TDD.md), and prose TDD.md unchanged.',
          '',
        ].join('\n'),
      );
      writeFileSync(
        nodePath.join(canonicalSkillsDirectory, 'alpha/TDD.md'),
        '# TDD detail\n\nRun /beta before writing /beta.md.\n',
      );
      writeFileSync(
        nodePath.join(canonicalSkillsDirectory, 'alpha/X-TDD.md'),
        '# Extended TDD detail\n',
      );
      writeFileSync(
        nodePath.join(canonicalSkillsDirectory, 'beta/SKILL.md'),
        ['---', 'name: beta', 'description: Referenced skill', '---', '', '# Beta', ''].join('\n'),
      );

      expect(generateCodexPluginAssets(canonicalSkillsDirectory, CLI_VERSION)).toEqual([
        {
          relativePath: nodePath.join('skills', 'alpha', 'SKILL.md'),
          content:
            '---\nname: alpha\ndescription: Invoke $safeword:beta and retain /beta.md, /beta/README.md, and /beta/_draft.md\n---\n\nRun $safeword:beta, preserve /outside, /beta/README.md, and /beta/_draft.md.\nConsult [TDD](references/TDD.md), [its loop](references/TDD.md#loop), and [X-TDD](references/X-TDD.md).\nLeave [prefixed](references/TDD.md), [remote](https://example.com/TDD.md), and prose TDD.md unchanged.\n',
        },
        {
          relativePath: nodePath.join('skills', 'alpha', 'references', 'TDD.md'),
          content: '# TDD detail\n\nRun $safeword:beta before writing /beta.md.\n',
        },
        {
          relativePath: nodePath.join('skills', 'alpha', 'references', 'X-TDD.md'),
          content: '# Extended TDD detail\n',
        },
        {
          relativePath: nodePath.join('skills', 'beta', 'SKILL.md'),
          content: '---\nname: beta\ndescription: Referenced skill\n---\n\n# Beta\n',
        },
      ]);

      mkdirSync(nodePath.join(canonicalSkillsDirectory, 'unsupported'));
      writeFileSync(
        nodePath.join(canonicalSkillsDirectory, 'unsupported/SKILL.md'),
        [
          '---',
          'name: unsupported',
          'description: Unsupported metadata',
          'not-supported: true',
          '---',
          '',
          '# Unsupported',
          '',
        ].join('\n'),
      );
      expect(() => generateCodexPluginAssets(canonicalSkillsDirectory, CLI_VERSION)).toThrow(
        'unsupported metadata',
      );
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('rewrites run-review.ts invocations to the bundled Codex plugin CLI', () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-plugin-run-review-'));
    const canonicalSkillsDirectory = nodePath.join(fixture, 'skills');
    try {
      mkdirSync(nodePath.join(canonicalSkillsDirectory, 'quality-review'), { recursive: true });
      writeFileSync(
        nodePath.join(canonicalSkillsDirectory, 'quality-review/SKILL.md'),
        [
          '---',
          'name: quality-review',
          'description: Review changes',
          '---',
          '',
          'Run:',
          '',
          '```bash',
          'bun .safeword/hooks/run-review.ts review run quality-review changed-file [more-changed-files...] --agent-handoff --json',
          '```',
          '',
        ].join('\n'),
      );

      // The managed-progress prefix carries what the run-review.ts wrapper set
      // in the child environment: without it a multi-minute review runs silent.
      const generated = generateCodexPluginAssets(canonicalSkillsDirectory, '1.2.3');
      expect(generated[0]?.content).toContain(
        'SAFEWORD_REVIEW_PROGRESS=1 bun "${CODEX_HOME:-$HOME/.codex}/plugins/cache/safeword/safeword/1.2.3/runtime/cli.js" review run quality-review changed-file [more-changed-files...] --agent-handoff --json',
      );
      expect(generated[0]?.content).not.toContain('.safeword/hooks/run-review.ts');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('sources audit scope from the pinned package instead of a project runtime', () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-plugin-audit-scope-'));
    const canonicalSkillsDirectory = nodePath.join(fixture, 'skills');
    try {
      mkdirSync(nodePath.join(canonicalSkillsDirectory, 'audit'), { recursive: true });
      writeFileSync(
        nodePath.join(canonicalSkillsDirectory, 'audit/SKILL.md'),
        [
          '---',
          'name: audit',
          'description: Audit changes',
          '---',
          '',
          '```bash',
          'source "$PROJECT_DIR/.safeword/hooks/lib/audit-scope.sh"',
          'audit_scope_initialize "$PROJECT_DIR"',
          '```',
          '',
        ].join('\n'),
      );

      const content =
        generateCodexPluginAssets(canonicalSkillsDirectory, '1.2.3')[0]?.content ?? '';

      expect(content).toContain('source <(bunx --bun safeword@1.2.3 project audit-scope)');
      expect(content).not.toContain('.safeword/hooks/lib/audit-scope.sh');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('records skill invocation through the pinned package instead of a project helper', () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-plugin-invocation-'));
    const canonicalSkillsDirectory = nodePath.join(fixture, 'skills');
    try {
      mkdirSync(nodePath.join(canonicalSkillsDirectory, 'verify'), { recursive: true });
      writeFileSync(
        nodePath.join(canonicalSkillsDirectory, 'verify/SKILL.md'),
        [
          '---',
          'name: verify',
          'description: Verify work',
          '---',
          '',
          '```bash',
          'bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" verify "${CLAUDE_SESSION_ID:-}"',
          '```',
          '',
        ].join('\n'),
      );

      const content =
        generateCodexPluginAssets(canonicalSkillsDirectory, '1.2.3')[0]?.content ?? '';

      expect(content).toContain(
        'bunx --bun safeword@1.2.3 project record-skill-invocation verify "${CLAUDE_SESSION_ID:-}"',
      );
      expect(content).not.toContain('.safeword/hooks/record-skill-invocation.ts');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('rewrites resolve-namespace-root.ts invocations to the pinned namespace-root subcommand', () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-plugin-ns-root-'));
    const canonicalSkillsDirectory = nodePath.join(fixture, 'skills');
    try {
      mkdirSync(nodePath.join(canonicalSkillsDirectory, 'explain'), { recursive: true });
      writeFileSync(
        nodePath.join(canonicalSkillsDirectory, 'explain/SKILL.md'),
        [
          '---',
          'name: explain',
          'description: Explain state',
          '---',
          '',
          '```bash',
          'NS_ROOT="$(bun "$PROJECT_DIR/.safeword/hooks/resolve-namespace-root.ts" "$PROJECT_DIR")"',
          'PERSONAS="$(bun "$PROJECT_DIR/.safeword/hooks/resolve-namespace-root.ts" "$PROJECT_DIR" personas personas.md 2> /dev/null)"',
          'CUSTOM="$(bun "$PROJECT_DIR/.safeword/hooks/resolve-namespace-root.ts" "$PROJECT_DIR" personas other.md)"',
          'KEYONLY="$(bun "$PROJECT_DIR/.safeword/hooks/resolve-namespace-root.ts" "$PROJECT_DIR" personas)"',
          'OPAQUE="$(bun "$PROJECT_DIR/.safeword/hooks/resolve-namespace-root.ts" "$PROJECT_DIR" "$KEY")"',
          'KEYTHENOPAQUE="$(bun "$PROJECT_DIR/.safeword/hooks/resolve-namespace-root.ts" "$PROJECT_DIR" personas "$FILE")"',
          '```',
          '',
        ].join('\n'),
      );

      const content =
        generateCodexPluginAssets(canonicalSkillsDirectory, '1.2.3')[0]?.content ?? '';

      expect(content).toContain(
        'NS_ROOT="$(bun "${CODEX_HOME:-$HOME/.codex}/plugins/cache/safeword/safeword/1.2.3/runtime/cli.js" project namespace-root --cwd "$PROJECT_DIR")"',
      );
      expect(content).toContain(
        'PERSONAS="$(bun "${CODEX_HOME:-$HOME/.codex}/plugins/cache/safeword/safeword/1.2.3/runtime/cli.js" project namespace-root --cwd "$PROJECT_DIR" --key personas 2> /dev/null)"',
      );
      // A non-default basename has no flag to carry it, so it stays untouched
      // rather than silently resolving a different file.
      expect(content).toContain(
        'CUSTOM="$(bun "$PROJECT_DIR/.safeword/hooks/resolve-namespace-root.ts" "$PROJECT_DIR" personas other.md)"',
      );
      // The script defaults its third argument to `<key>.md`, which is also the
      // subcommand's default, so a key-only call maps cleanly onto --key.
      expect(content).toContain(
        'KEYONLY="$(bun "${CODEX_HOME:-$HOME/.codex}/plugins/cache/safeword/safeword/1.2.3/runtime/cli.js" project namespace-root --cwd "$PROJECT_DIR" --key personas)"',
      );
      // An operand the rewrite cannot map is preserved rather than emitted after
      // the new command: `namespace-root` takes no operands, so rewriting would
      // ship a command that exits 1 — and under `2> /dev/null` that failure
      // reads as an empty path instead of an error.
      expect(content).toContain(
        'OPAQUE="$(bun "$PROJECT_DIR/.safeword/hooks/resolve-namespace-root.ts" "$PROJECT_DIR" "$KEY")"',
      );
      // Same guard on the key-matched branch: mapping the key does not license
      // dropping an operand the rewrite could not map.
      expect(content).toContain(
        'KEYTHENOPAQUE="$(bun "$PROJECT_DIR/.safeword/hooks/resolve-namespace-root.ts" "$PROJECT_DIR" personas "$FILE")"',
      );
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('keeps table column alignment when normalizing generated Markdown tables', () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-plugin-tables-'));
    const canonicalSkillsDirectory = nodePath.join(fixture, 'skills');
    try {
      mkdirSync(nodePath.join(canonicalSkillsDirectory, 'aligned'), { recursive: true });
      writeFileSync(
        nodePath.join(canonicalSkillsDirectory, 'aligned/SKILL.md'),
        [
          '---',
          'name: aligned',
          'description: Aligned tables',
          '---',
          '',
          '| Left | Right | Centre |',
          '| :--- | ----: | :----: |',
          '| a | b | c |',
          '',
        ].join('\n'),
      );

      const content =
        generateCodexPluginAssets(canonicalSkillsDirectory, '1.2.3')[0]?.content ?? '';
      const delimiter =
        content.split('\n').find(line => line.startsWith('|') && line.includes('---')) ?? '';

      // Alignment is rendered meaning, not formatting: dropping the colons
      // silently re-aligns every right- and centre-aligned table in the corpus.
      expect(delimiter).toMatch(/\|\s:-+\s\|/u);
      expect(delimiter).toMatch(/\|\s-+:\s\|/u);
      expect(delimiter).toMatch(/\|\s:-+:\s\|/u);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('rewrites resolve-project-knowledge.ts invocations to the bundled review-knowledge subcommand', () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-plugin-knowledge-'));
    const canonicalSkillsDirectory = nodePath.join(fixture, 'skills');
    try {
      mkdirSync(nodePath.join(canonicalSkillsDirectory, 'self-review'), { recursive: true });
      writeFileSync(
        nodePath.join(canonicalSkillsDirectory, 'self-review/SKILL.md'),
        [
          '---',
          'name: self-review',
          'description: Review the spec',
          '---',
          '',
          'Run `bun .safeword/hooks/resolve-project-knowledge.ts` and use its sources.',
          '',
        ].join('\n'),
      );

      const content =
        generateCodexPluginAssets(canonicalSkillsDirectory, '1.2.3')[0]?.content ?? '';

      expect(content).toContain(
        'Run `bun "${CODEX_HOME:-$HOME/.codex}/plugins/cache/safeword/safeword/1.2.3/runtime/cli.js" project review-knowledge --json` and use its sources.',
      );
      expect(content).not.toContain('.safeword/hooks/resolve-project-knowledge.ts');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('enforces Codex metadata discovery budget from generated skill frontmatter', () => {
    const assets = generateCodexPluginAssets(CANONICAL_SKILLS, CLI_VERSION);
    expect(() => {
      assertCodexSkillMetadataBudget(assets);
    }).not.toThrow();

    const oversized = [
      ...assets,
      {
        relativePath: 'skills/oversized/SKILL.md',
        content: `---\nname: oversized\ndescription: ${'x'.repeat(CODEX_SKILL_METADATA_LIMIT)}\n---\n`,
      },
    ];
    expect(() => {
      assertCodexSkillMetadataBudget(oversized);
    }).toThrow('8000');
  });

  it('measures every field Codex places in its initial skill list', () => {
    const asset = {
      relativePath: nodePath.join('skills', 'alpha', 'SKILL.md'),
      content: '---\nname: alpha\ndescription: Describe alpha\n---\n',
    };

    expect(codexSkillMetadataCharacters([asset])).toBe(
      asset.relativePath.length + 'alpha'.length + 'Describe alpha'.length,
    );
  });

  it.each([
    {
      content: '# No frontmatter\n',
      message: 'generated skill skills/alpha/SKILL.md has no YAML frontmatter',
    },
    {
      content: '---\nnot-a-mapping\n---\n',
      message: 'generated skill skills/alpha/SKILL.md has invalid name or description metadata',
    },
    {
      content: '---\nname: alpha\n---\n',
      message: 'generated skill skills/alpha/SKILL.md has invalid name or description metadata',
    },
  ])('preserves generated skill validation for $message', ({ content, message }) => {
    expect(() => {
      codexSkillMetadataCharacters([{ relativePath: 'skills/alpha/SKILL.md', content }]);
    }).toThrow(message);
  });
});
