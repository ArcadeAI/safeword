import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  it('gives feature intake the ticket command from the selected Codex plugin version', () => {
    const skills = nodePath.resolve(import.meta.dirname, '../../templates/skills');
    const guide = generateCodexPluginAssets(skills, '1.2.3').find(
      asset => asset.relativePath === 'skills/bdd/references/DISCOVERY.md',
    );
    expect(guide?.content).toContain(
      'bun "$SAFEWORD_PLUGIN_RUNTIME" ticket new <slug> --type feature',
    );
  });

  it('keeps the containing plugin authoritative beside legacy project runtime', () => {
    const content = generatedSkill(
      [
        '```bash',
        'source "$PROJECT_DIR/.safeword/hooks/lib/audit-scope.sh"',
        'audit_scope_initialize "$PROJECT_DIR"',
        '```',
      ].join('\n'),
    );

    expect(content).toContain(
      'source /dev/stdin <<< "$(bun "$SAFEWORD_PLUGIN_RUNTIME" project audit-scope)"',
    );
    expect(content).not.toContain('.safeword/hooks/lib/audit-scope.sh');
  });

  it('keeps an unavailable containing package fail-closed without project-runtime fallback', () => {
    const content = generatedSkill(
      'Run `bun .safeword/hooks/run-review.ts review run audit changed-file --agent-handoff --json`.',
    );

    expect(content).toContain('bun "$SAFEWORD_PLUGIN_RUNTIME" review run audit');
    expect(content).not.toContain('.safeword/hooks/run-review.ts');
    expect(content).not.toMatch(/(?:fallback|safeword install|bun install|bunx)/iu);
  });

  it('accepts a pinned self-contained Codex catalogue', () => {
    const content = generatedSkill(
      'Run `bun .safeword/hooks/run-review.ts review run audit changed-file --agent-handoff --json`.',
    );

    expect(() => {
      assertNativePluginRuntimeAuthority([{ relativePath: 'skills/audit/SKILL.md', content }]);
    }).not.toThrow();
  });

  it('rejects a generated catalogue that retains any project-runtime path', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-residual-runtime-'));
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
          'Read `.safeword/templates/unmapped.md`.',
          '',
        ].join('\n'),
      );
      expect(() => {
        writeCodexPluginCatalogue(canonical, plugin, '1.2.3');
      }).toThrow('Native plugin assets reference project-local executable runtime');
      expect(existsSync(plugin)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects an unexpected non-Markdown skill asset', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-unexpected-asset-'));
    const canonical = nodePath.join(root, 'canonical');
    const plugin = nodePath.join(root, 'plugin');
    try {
      mkdirSync(nodePath.join(canonical, 'audit'), { recursive: true });
      writeFileSync(
        nodePath.join(canonical, 'audit/SKILL.md'),
        ['---', 'name: audit', 'description: Audit changes', '---', '', 'Audit.', ''].join('\n'),
      );
      writeCodexPluginCatalogue(canonical, plugin, '1.2.3');
      writeFileSync(nodePath.join(plugin, 'skills/audit/runtime.js'), 'export {};\n');

      expect(() => {
        assertCodexPluginCatalogue(canonical, plugin, '1.2.3');
      }).toThrow('Codex plugin has unexpected asset: skills/audit/runtime.js');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a changed runtime path and an unpinned helper in a generated Codex skill', () => {
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
      const original = readFileSync(generatedPath, 'utf8');
      const bundled = 'bun "$SAFEWORD_PLUGIN_RUNTIME"';
      expect(original).toContain(bundled);
      writeFileSync(generatedPath, original.replace(bundled, 'bunx --bun safeword'));
      expect(() => {
        assertCodexPluginCatalogue(canonical, plugin, '1.2.3');
      }).toThrow('skills/audit/SKILL.md');
      writeFileSync(
        generatedPath,
        generatedSkill(
          'Run `bun .safeword/hooks/run-review.ts review run audit changed-file --agent-handoff --json`.',
        ).replaceAll('../../runtime/cli.js', '../../runtime/foreign.js'),
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
