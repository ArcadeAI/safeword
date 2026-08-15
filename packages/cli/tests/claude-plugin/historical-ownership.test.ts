import { beforeAll, describe, expect, it } from 'vitest';

import { CLAUDE_HISTORICAL_CATALOGUE } from '../../src/claude-plugin/historical-catalogue.generated.js';
import {
  historicalCatalogueDigest,
  historicalHookEntry,
  isAcceptedHistoricalFile,
  isAcceptedHistoricalHook,
  supportedClaudeLegacyReleases,
} from '../../src/claude-plugin/historical-ownership.js';
import { readHistoricalTemplate, requireHistoricalReleaseTags } from '../helpers/git-history.js';

/** Releases this suite reads real bytes from; shared with the history preflight. */
const FIXTURE_VERSIONS = ['0.68.0', '0.69.0', '0.72.0'];

describe('Claude historical ownership catalogue', () => {
  beforeAll(() => {
    requireHistoricalReleaseTags(FIXTURE_VERSIONS);
  });

  it('contains the required released migration fixtures and prerelease history', () => {
    expect(supportedClaudeLegacyReleases()).toEqual(
      expect.arrayContaining(['0.68.0', '0.69.0', '0.71.0-rc.0', '0.72.0']),
    );
    expect(historicalCatalogueDigest()).toMatch(/^[\da-f]{64}$/u);
  });

  it.each(FIXTURE_VERSIONS)('recognizes real %s released file bytes', version => {
    const release =
      CLAUDE_HISTORICAL_CATALOGUE.releases[
        version as keyof typeof CLAUDE_HISTORICAL_CATALOGUE.releases
      ];
    const [installedPath, expectedDigest] = Object.entries(release.files)[0] ?? [];
    expect(installedPath).toBeDefined();
    const content = readHistoricalTemplate(version, installedPath ?? '');
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
