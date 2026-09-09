import { existsSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  parseCodexPluginGenerationOptions,
  publishFreshDirectory,
} from '../../scripts/lib/codex-plugin-generation.js';

describe('Codex plugin generation boundary', () => {
  it.each(['not-a-version', '0.84.0+codex.test'])(
    'rejects incompatible effective version %s',
    effectiveVersion => {
      expect(() =>
        parseCodexPluginGenerationOptions(
          ['--version', effectiveVersion, '--output', 'bundle'],
          '0.83.1',
        ),
      ).toThrow();
    },
  );

  it('requires an explicit fresh output for a version override', () => {
    expect(() =>
      parseCodexPluginGenerationOptions(['--version', '0.83.1+codex.test'], '0.83.1'),
    ).toThrow('--version and --output must be provided together');
  });

  it('does not replace an existing output', async () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-publish-'));
    const output = nodePath.join(fixture, 'plugin');
    writeFileSync(output, 'owned');
    try {
      await expect(publishFreshDirectory(output, () => Promise.resolve())).rejects.toThrow(
        'Output already exists',
      );
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('does not replace a broken symlink at the output path', async () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-publish-'));
    const output = nodePath.join(fixture, 'plugin');
    symlinkSync(nodePath.join(fixture, 'missing-target'), output);
    try {
      await expect(publishFreshDirectory(output, () => Promise.resolve())).rejects.toThrow(
        'Output already exists',
      );
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('removes partial staging output when generation fails', async () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-publish-'));
    const output = nodePath.join(fixture, 'plugin');
    try {
      await expect(
        publishFreshDirectory(output, staging => {
          writeFileSync(nodePath.join(staging, 'partial'), 'incomplete');
          return Promise.reject(new Error('injected generation failure'));
        }),
      ).rejects.toThrow('injected generation failure');
      expect(existsSync(output)).toBe(false);
      expect(readdirSync(fixture)).toEqual([]);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
