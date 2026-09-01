import { existsSync, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createResult } from '../../src/cli-protocol/result.js';
import { CURSOR_COMMAND_WRAPPERS } from '../../src/cursor-wrappers.js';
import { installLifecycle } from '../../src/lifecycle/commands.js';
import {
  generateOpenCodeCatalogueAssets,
  renderOpenCodeAgent,
  SAFEWORD_SUBAGENTS,
  validateOpenCodeCatalogueReferences,
} from '../../src/opencode/catalogue.js';
import { assertNativePluginRuntimeAuthority } from '../../src/plugin-runtime-authority.js';
import { VERSION } from '../../src/version.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = createTemporaryDirectory();
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories) removeTemporaryDirectory(directory);
  temporaryDirectories.length = 0;
  vi.unstubAllEnvs();
});

describe('OpenCode profile catalogue', () => {
  it('rejects command and subagent references to unknown skills', () => {
    expect(() => {
      validateOpenCodeCatalogueReferences(
        new Set(['bdd']),
        [{ name: 'broken', description: 'broken', skillPath: 'missing/SKILL.md' }],
        [],
      );
    }).toThrow('missing');
    expect(() => {
      validateOpenCodeCatalogueReferences(
        new Set(['bdd']),
        [],
        [{ name: 'broken', description: 'broken', skill: 'missing' }],
      );
    }).toThrow('missing');
  });
  it('contains no executable project-runtime references', () => {
    const templatesRoot = nodePath.resolve(import.meta.dirname, '../../templates');
    expect(() => {
      assertNativePluginRuntimeAuthority(generateOpenCodeCatalogueAssets(templatesRoot));
    }).not.toThrow();
  });
  it('ships referenced skill material and rewrites native workflow invocations', () => {
    const templatesRoot = nodePath.resolve(import.meta.dirname, '../../templates');
    const assets = generateOpenCodeCatalogueAssets(templatesRoot);
    const bdd = assets.find(asset => asset.relativePath === 'skills/safeword-bdd/SKILL.md');

    expect(
      assets.some(asset => asset.relativePath === 'skills/safeword-bdd/references/DISCOVERY.md'),
    ).toBe(true);
    expect(bdd?.content).toContain('references/DISCOVERY.md');
    expect(bdd?.content).toMatch(/^name: safeword-bdd$/mu);
    expect(bdd?.content).not.toMatch(/^name: bdd$/mu);
    expect(bdd?.content).not.toContain('.safeword/skills/bdd/');
    expect(bdd?.content).toContain('/safeword-verify');
    expect(bdd?.content).not.toContain('$safeword:verify');
  });
  it('uses the pinned package runtime rather than Codex plugin-cache paths', () => {
    const templatesRoot = nodePath.resolve(import.meta.dirname, '../../templates');
    const assets = generateOpenCodeCatalogueAssets(templatesRoot);
    const audit = assets.find(asset => asset.relativePath === 'skills/safeword-audit/SKILL.md');
    const verify = assets.find(asset => asset.relativePath === 'skills/safeword-verify/SKILL.md');

    expect(audit?.content).toContain(
      `source <(bunx --bun safeword@${VERSION} project audit-scope)`,
    );
    expect(verify?.content).toContain(
      `bunx --bun safeword@${VERSION} project record-skill-invocation --cwd "$PROJECT_DIR" verify`,
    );
    expect(audit?.content).not.toContain('/plugins/cache/safeword/');
    expect(verify?.content).not.toContain('/plugins/cache/safeword/');
  });
  it('installs the complete native catalogue without project host files', async () => {
    const project = temporaryDirectory();
    const profile = temporaryDirectory();
    vi.stubEnv('OPENCODE_CONFIG_DIR', profile);

    const result = await installLifecycle(
      {
        cwd: project,
        noInput: true,
        offline: false,
        operands: [],
        options: { agents: 'opencode' },
      },
      {
        installClaude: () => Promise.resolve(createResult({ state: 'healthy' })),
        installCodex: () => Promise.resolve(createResult({ state: 'healthy' })),
      },
    );

    const markdownNames = (directory: string): string[] =>
      readdirSync(nodePath.join(profile, directory))
        .filter(name => name.endsWith('.md'))
        .map(name => name.slice(0, -3))
        .toSorted((left, right) => left.localeCompare(right));
    const commandNames = CURSOR_COMMAND_WRAPPERS.map(
      wrapper => `safeword-${wrapper.name}`,
    ).toSorted((left, right) => left.localeCompare(right));
    const skillNames = readdirSync(
      nodePath.resolve(import.meta.dirname, '../../templates/skills'),
      { withFileTypes: true },
    )
      .filter(entry => entry.isDirectory())
      .map(entry => `safeword-${entry.name}`)
      .toSorted((left, right) => left.localeCompare(right));

    expect(result.errors).toEqual([]);
    expect(commandNames.length).toBeGreaterThan(0);
    expect(markdownNames('commands')).toEqual(commandNames);
    expect(markdownNames('agents')).toEqual(['safeword-retro-filer', 'safeword-reviewer']);
    expect(
      readdirSync(nodePath.join(profile, 'skills')).toSorted((left, right) =>
        left.localeCompare(right),
      ),
    ).toEqual(skillNames);
    expect(existsSync(nodePath.join(project, '.opencode'))).toBe(false);
    expect(existsSync(nodePath.join(project, '.claude/skills'))).toBe(false);
    expect(existsSync(nodePath.join(profile, 'plugins/safeword.js'))).toBe(true);
    expect(existsSync(nodePath.join(profile, 'safeword/dispatcher.mjs'))).toBe(true);
    for (const agent of SAFEWORD_SUBAGENTS) {
      expect(readFileSync(nodePath.join(profile, `agents/${agent.name}.md`), 'utf8')).toBe(
        renderOpenCodeAgent(agent),
      );
    }
  });
});
