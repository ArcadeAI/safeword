import { execFileSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { CLAUDE_HISTORICAL_CATALOGUE } from '../../src/claude-plugin/historical-catalogue.generated.js';
import {
  historicalCatalogueDigest,
  historicalHookEntry,
  isAcceptedHistoricalFile,
  isAcceptedHistoricalHook,
  supportedClaudeLegacyReleases,
} from '../../src/claude-plugin/historical-ownership.js';

const repoRoot = new URL('../../../..', import.meta.url).pathname;

function gitShow(tag: string, path: string): string {
  return execFileSync('git', ['show', `${tag}:${path}`], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

describe('Claude historical ownership catalogue', () => {
  it('contains the required released migration fixtures and prerelease history', () => {
    expect(supportedClaudeLegacyReleases()).toEqual(
      expect.arrayContaining(['0.68.0', '0.69.0', '0.71.0-rc.0', '0.72.0']),
    );
    expect(historicalCatalogueDigest()).toMatch(/^[\da-f]{64}$/u);
  });

  it.each(['0.68.0', '0.69.0', '0.72.0'])('recognizes real %s released file bytes', version => {
    const release =
      CLAUDE_HISTORICAL_CATALOGUE.releases[
        version as keyof typeof CLAUDE_HISTORICAL_CATALOGUE.releases
      ];
    const [installedPath, expectedDigest] = Object.entries(release.files)[0] ?? [];
    expect(installedPath).toBeDefined();
    const schema = gitShow(`v${version}`, 'packages/cli/src/schema.ts');
    const escaped = installedPath?.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`) ?? '';
    // eslint-disable-next-line security/detect-non-literal-regexp -- escaped fixture path is test-owned
    const template = new RegExp(
      String.raw`['"]${escaped}['"]\s*:\s*\{[^}]*?template:\s*['"]([^'"]+)['"]`,
      'su',
    ).exec(schema)?.[1];
    expect(template).toBeDefined();
    const content = gitShow(`v${version}`, `packages/cli/templates/${template}`);
    expect(isAcceptedHistoricalFile(installedPath ?? '', content)).toBe(true);
    expect(expectedDigest).toMatch(/^[\da-f]{64}$/u);
    expect(isAcceptedHistoricalFile(installedPath ?? '', `${content}\nmodified`)).toBe(false);
  });

  it('requires an exact all-field structural hook match', () => {
    const release = CLAUDE_HISTORICAL_CATALOGUE.releases['0.72.0'];
    const fingerprint = release.hooks.UserPromptSubmit?.[0];
    const candidate = historicalHookEntry(fingerprint ?? '');
    expect(candidate).toBeDefined();
    expect(isAcceptedHistoricalHook('UserPromptSubmit', candidate)).toBe(true);
    expect(
      isAcceptedHistoricalHook('UserPromptSubmit', {
        ...(candidate as Record<string, unknown>),
        thirdParty: true,
      }),
    ).toBe(false);
  });
});
