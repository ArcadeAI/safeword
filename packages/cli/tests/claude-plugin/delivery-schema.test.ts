import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  assertClaudePluginCatalogue,
  generateClaudePluginAssets,
  sealClaudePluginCatalogue,
} from '../../src/claude-plugin/catalogue.js';
import { schemaForClaudeDelivery } from '../../src/claude-plugin/delivery-schema.js';
import { writeClaudePluginMode } from '../../src/claude-plugin/migration-state.js';

const roots: string[] = [];
const digest = 'a'.repeat(64);
const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

describe('Claude delivery schema', () => {
  it('generates and seals one canonical native plugin inventory', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'claude-native-catalogue-'));
    roots.push(root);
    const input = {
      cliBundle: 'export {};\n',
      sourceRoot: nodePath.join(REPO_ROOT, 'packages/cli/src'),
      templatesRoot: nodePath.join(REPO_ROOT, 'packages/cli/templates'),
      version: '0.73.0',
    };
    for (const asset of generateClaudePluginAssets(input)) {
      const target = nodePath.join(root, asset.relativePath);
      mkdirSync(nodePath.dirname(target), { recursive: true });
      writeFileSync(target, asset.content);
    }

    sealClaudePluginCatalogue(root, input.version);

    expect(() => {
      assertClaudePluginCatalogue(input, root);
    }).not.toThrow();
  });

  it('does not recreate Claude legacy delivery after automatic v2 migration', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'claude-native-schema-'));
    roots.push(root);
    writeClaudePluginMode(root, {
      schema_version: 2,
      state: 'clean',
      plugin_version: '0.73.0',
      hook_manifest_sha256: digest,
      catalogue_sha256: digest,
      unresolved_paths: [],
    });
    const schema = schemaForClaudeDelivery(root);
    expect(Object.keys(schema.ownedFiles).some(path => path.startsWith('.claude/'))).toBe(false);
    expect(Object.keys(schema.managedFiles).some(path => path.startsWith('.claude/'))).toBe(false);
  });

  it('keeps the checked-in inspiration gate collaborators byte-identical to generated assets', () => {
    const input = {
      cliBundle: 'export {};\n',
      sourceRoot: nodePath.join(REPO_ROOT, 'packages/cli/src'),
      templatesRoot: nodePath.join(REPO_ROOT, 'packages/cli/templates'),
      version: '0.73.0',
    };
    const generated = new Map(
      generateClaudePluginAssets(input).map(asset => [asset.relativePath, asset.content]),
    );

    for (const relativePath of [
      'runtime/hooks/pre-tool-quality.ts',
      'runtime/hooks/lib/active-ticket.ts',
      'runtime/hooks/lib/impl-plan.ts',
      'runtime/hooks/lib/inspiration.ts',
      'runtime/hooks/lib/plan-gate.ts',
    ]) {
      expect(readFileSync(nodePath.join(REPO_ROOT, 'plugin', relativePath), 'utf8')).toBe(
        generated.get(relativePath),
      );
    }
  });

  it('runs a generated denial branch without treating plugin-root placeholders as globals', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'claude-plugin-hook-runtime-'));
    roots.push(root);
    const result = spawnSync(
      'bun',
      [nodePath.join(REPO_ROOT, 'plugin/runtime/hooks/pre-tool-quality.ts')],
      {
        cwd: root,
        input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'pkill node' } }),
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: root,
          CLAUDE_PLUGIN_ROOT: nodePath.join(REPO_ROOT, 'plugin'),
        },
      },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain('ReferenceError');
    expect(result.stdout).toContain('Broad process kill blocked');
    expect(result.stdout).toContain('${CLAUDE_PLUGIN_ROOT}');
  });

  it('runs implementation entry through the checked-in Claude plugin hook', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'claude-plugin-plan-gate-'));
    roots.push(root);
    const ticketDirectory = nodePath.join(root, '.project/tickets/PLUG01-gate');
    mkdirSync(ticketDirectory, { recursive: true });
    const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
    writeFileSync(
      ticketPath,
      [
        '---',
        'id: PLUG01',
        'type: feature',
        'phase: plan-implementation',
        'status: in_progress',
        'scope: plugin plan gate',
        'out_of_scope: unrelated work',
        'done_when: transition is blocked',
        '---',
        '# Plugin plan gate',
      ].join('\n'),
    );
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), '# Spec\n');

    const result = spawnSync(
      'bun',
      [nodePath.join(REPO_ROOT, 'plugin/runtime/hooks/pre-tool-quality.ts')],
      {
        cwd: root,
        input: JSON.stringify({
          tool_name: 'Edit',
          tool_input: {
            file_path: ticketPath,
            old_string: 'phase: plan-implementation',
            new_string: 'phase: implement',
          },
        }),
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: root,
          CLAUDE_PLUGIN_ROOT: nodePath.join(REPO_ROOT, 'plugin'),
        },
      },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain('Error');
    expect(result.stdout).toContain('impl-plan.md');
  });

  it('does not mistake an unrelated third-party hook for legacy Safeword delivery', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'claude-third-party-schema-'));
    roots.push(root);
    const settings = nodePath.join(root, '.claude/settings.json');
    mkdirSync(nodePath.dirname(settings), { recursive: true });
    writeFileSync(
      settings,
      JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ command: 'bun vendor.ts' }] }] } }),
    );
    const schema = schemaForClaudeDelivery(root);
    expect(Object.keys(schema.ownedFiles).some(path => path.startsWith('.claude/'))).toBe(false);
  });
});
