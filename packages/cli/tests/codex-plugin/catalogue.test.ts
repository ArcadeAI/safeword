import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertCodexPluginCatalogue,
  generateCodexPluginAssets,
  writeCodexPluginCatalogue,
} from '../../src/codex-plugin/catalogue.js';
import { assertNativePluginRuntimeAuthority } from '../../src/plugin-runtime-authority.js';

function generatedSkill(source: string): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-catalogue-'));
  try {
    mkdirSync(nodePath.join(root, 'audit'), { recursive: true });
    writeFileSync(
      nodePath.join(root, 'audit/SKILL.md'),
      ['---', 'name: audit', 'description: Audit changes', '---', '', source, ''].join('\n'),
    );
    return generateCodexPluginAssets(root, '1.2.3')[0]?.content ?? '';
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('Codex plugin catalogue runtime authority', () => {
  it.each(['complete', 'partially missing'])(
    'keeps the pinned plugin authoritative beside %s legacy project runtime',
    legacyRuntime => {
      const content = generatedSkill(
        [
          '```bash',
          'source "$PROJECT_DIR/.safeword/hooks/lib/audit-scope.sh"',
          'audit_scope_initialize "$PROJECT_DIR"',
          '```',
          `Legacy fixture: ${legacyRuntime}`,
        ].join('\n'),
      );

      expect(content).toContain('source <(bunx --bun safeword@1.2.3 project audit-scope)');
      expect(content).not.toContain('.safeword/hooks/lib/audit-scope.sh');
    },
  );

  it('keeps an unavailable pinned package fail-closed without project-runtime fallback', () => {
    const content = generatedSkill(
      'Run `bun .safeword/hooks/run-review.ts review run audit changed-file --agent-handoff --json`.',
    );

    expect(content).toContain('bunx --bun safeword@1.2.3 review run audit');
    expect(content).not.toContain('.safeword/hooks/run-review.ts');
    expect(content).not.toMatch(/(?:fallback|safeword install|bun install)/iu);
  });

  it('accepts a pinned self-contained Codex catalogue', () => {
    const content = generatedSkill(
      'Run `bun .safeword/hooks/run-review.ts review run audit changed-file --agent-handoff --json`.',
    );

    expect(() => {
      assertNativePluginRuntimeAuthority([{ relativePath: 'skills/audit/SKILL.md', content }]);
    }).not.toThrow();
  });

  it('rejects an unpinned Codex helper invocation', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-unpinned-'));
    const canonical = nodePath.join(root, 'canonical');
    const plugin = nodePath.join(root, 'plugin');
    try {
      mkdirSync(nodePath.join(canonical, 'audit'), { recursive: true });
      writeFileSync(
        nodePath.join(canonical, 'audit/SKILL.md'),
        [
          '---',
          'name: audit',
          'description: Audit changes',
          '---',
          '',
          'Run `bun .safeword/hooks/run-review.ts review run audit changed-file --agent-handoff --json`.',
          '',
        ].join('\n'),
      );
      writeCodexPluginCatalogue(canonical, plugin, '1.2.3');
      const generatedPath = nodePath.join(plugin, 'skills/audit/SKILL.md');
      writeFileSync(
        generatedPath,
        generatedSkill(
          'Run `bun .safeword/hooks/run-review.ts review run audit changed-file --agent-handoff --json`.',
        ).replaceAll('safeword@1.2.3', 'safeword'),
      );

      expect(() => {
        assertCodexPluginCatalogue(canonical, plugin, '1.2.3');
      }).toThrow('skills/audit/SKILL.md');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a project-local executable reference from a native catalogue', () => {
    expect(() => {
      assertNativePluginRuntimeAuthority([
        {
          relativePath: 'skills/audit/SKILL.md',
          content: 'Run `bun .safeword/hooks/run-review.ts review run audit`.',
        },
      ]);
    }).toThrow('skills/audit/SKILL.md');
  });
});
