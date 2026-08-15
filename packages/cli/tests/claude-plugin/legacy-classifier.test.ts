import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { CLAUDE_HISTORICAL_CATALOGUE } from '../../src/claude-plugin/historical-catalogue.generated.js';
import { historicalHookEntry } from '../../src/claude-plugin/historical-ownership.js';
import { observeClaudeLegacy } from '../../src/claude-plugin/legacy-classifier.js';
import { readHistoricalTemplate, requireHistoricalReleaseTags } from '../helpers/git-history.js';

const fixtures: string[] = [];

function fixture(): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-legacy-classifier-'));
  fixtures.push(root);
  return root;
}

afterEach(() => {
  for (const root of fixtures) rmSync(root, { recursive: true, force: true });
  fixtures.length = 0;
});

/** Releases this suite reads real bytes from; shared with the history preflight. */
const FIXTURE_VERSIONS = ['0.68.0', '0.69.0', '0.72.0'];

describe('Claude legacy classifier', () => {
  beforeAll(() => {
    requireHistoricalReleaseTags(FIXTURE_VERSIONS);
  });

  it.each(FIXTURE_VERSIONS)('recognizes real %s files and rejects changed bytes', version => {
    const root = fixture();
    const release =
      CLAUDE_HISTORICAL_CATALOGUE.releases[
        version as keyof typeof CLAUDE_HISTORICAL_CATALOGUE.releases
      ];
    const installedPath = Object.keys(release.files)[0];
    expect(installedPath).toBeDefined();
    const target = nodePath.join(root, installedPath ?? '');
    mkdirSync(nodePath.dirname(target), { recursive: true });
    writeFileSync(target, readHistoricalTemplate(version, installedPath ?? ''));
    expect(observeClaudeLegacy(root).recognizedFiles).toContain(installedPath);

    writeFileSync(target, 'user changed bytes\n');
    expect(observeClaudeLegacy(root).conflictingFiles).toContain(installedPath);
  });

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

  it('classifies a historical file below a symlinked ancestor as a conflict', () => {
    const root = fixture();
    const external = fixture();
    const installedPath = Object.keys(CLAUDE_HISTORICAL_CATALOGUE.releases['0.72.0'].files)[0];
    if (installedPath === undefined) throw new Error('Historical fixture path is missing.');
    const firstSegment = installedPath.split('/', 1)[0];
    if (firstSegment === undefined) throw new Error('Historical fixture ancestor is missing.');
    mkdirSync(nodePath.join(external, nodePath.dirname(installedPath)), { recursive: true });
    writeFileSync(nodePath.join(external, installedPath), 'external bytes\n');
    symlinkSync(nodePath.join(external, firstSegment), nodePath.join(root, firstSegment));

    const observation = observeClaudeLegacy(root);
    expect(observation.recognizedFiles).not.toContain(installedPath);
    expect(observation.conflictingFiles).toContain(installedPath);
  });
});
