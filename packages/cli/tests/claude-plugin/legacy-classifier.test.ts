import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CLAUDE_HISTORICAL_CATALOGUE } from '../../src/claude-plugin/historical-catalogue.generated.js';
import { historicalHookEntry } from '../../src/claude-plugin/historical-ownership.js';
import { observeClaudeLegacy } from '../../src/claude-plugin/legacy-classifier.js';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const fixtures: string[] = [];

function fixture(): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-legacy-classifier-'));
  fixtures.push(root);
  return root;
}

function gitShow(tag: string, path: string): string {
  return execFileSync('git', ['show', `${tag}:${path}`], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

afterEach(() => {
  for (const root of fixtures) rmSync(root, { recursive: true, force: true });
  fixtures.length = 0;
});

describe('Claude legacy classifier', () => {
  it.each(['0.68.0', '0.69.0', '0.72.0'])(
    'recognizes real %s files and rejects changed bytes',
    version => {
      const root = fixture();
      const release =
        CLAUDE_HISTORICAL_CATALOGUE.releases[
          version as keyof typeof CLAUDE_HISTORICAL_CATALOGUE.releases
        ];
      const installedPath = Object.keys(release.files)[0];
      expect(installedPath).toBeDefined();
      const schema = gitShow(`v${version}`, 'packages/cli/src/schema.ts');
      const escaped = installedPath?.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`) ?? '';
      // eslint-disable-next-line security/detect-non-literal-regexp -- escaped fixture path is test-owned
      const template = new RegExp(
        String.raw`['"]${escaped}['"]\s*:\s*\{[^}]*?template:\s*['"]([^'"]+)['"]`,
        'su',
      ).exec(schema)?.[1];
      const target = nodePath.join(root, installedPath ?? '');
      mkdirSync(nodePath.dirname(target), { recursive: true });
      writeFileSync(target, gitShow(`v${version}`, `packages/cli/templates/${template}`));
      expect(observeClaudeLegacy(root).recognizedFiles).toContain(installedPath);

      writeFileSync(target, 'user changed bytes\n');
      expect(observeClaudeLegacy(root).conflictingFiles).toContain(installedPath);
    },
  );

  it('distinguishes exact, modified, and unrelated settings hooks without losing JSONC', () => {
    const root = fixture();
    const settings = nodePath.join(root, '.claude/settings.json');
    mkdirSync(nodePath.dirname(settings), { recursive: true });
    const fingerprint =
      CLAUDE_HISTORICAL_CATALOGUE.releases['0.72.0'].hooks.UserPromptSubmit?.[0] ?? '';
    const exact = historicalHookEntry(fingerprint) as Record<string, unknown>;
    const modified = structuredClone(exact) as {
      hooks: { command: string }[];
    };
    const modifiedCommand = modified.hooks[0];
    if (modifiedCommand === undefined) throw new Error('Historical hook command is missing.');
    modifiedCommand.command += ' --user-change';
    writeFileSync(
      settings,
      `{// keep this comment\n  "hooks": {"UserPromptSubmit": ${JSON.stringify([
        exact,
        modified,
        { hooks: [{ type: 'command', command: 'bun third-party.ts' }] },
      ])}}}\n`,
    );

    const observation = observeClaudeLegacy(root);
    expect(observation.recognizedHooks).toHaveLength(1);
    expect(observation.conflictingHooks).toHaveLength(1);
    expect(observation.conflictingHooks[0]).toMatchObject({ event: 'UserPromptSubmit', index: 1 });
    expect(observation.settingsError).toBeUndefined();
  });

  it('preserves malformed settings as an explicit conflict', () => {
    const root = fixture();
    const settings = nodePath.join(root, '.claude/settings.json');
    mkdirSync(nodePath.dirname(settings), { recursive: true });
    writeFileSync(settings, '{ not JSONC');
    expect(observeClaudeLegacy(root).settingsError).toContain('could not be parsed');
  });
});
