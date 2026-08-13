import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  readAlternateReviewerModel,
  readPrimaryReviewerModel,
  readReviewPolicy,
} from '../../src/review/policy.js';

/**
 * Carries the model-grammar table that used to live as Gherkin example rows.
 * The rule is illustrated by one accepted and one refused example in the
 * feature file; the exhaustive table belongs here, where it is cheaper to run
 * and easier to read.
 */

const originalEnvironment = process.env.SAFEWORD_REVIEW_ALTERNATE_MODEL_CODEX;
const originalPrimaryClaude = process.env.SAFEWORD_REVIEW_PRIMARY_MODEL_CLAUDE;
const originalAlternateClaude = process.env.SAFEWORD_REVIEW_ALTERNATE_MODEL_CLAUDE;
const directories: string[] = [];

afterEach(() => {
  if (originalEnvironment === undefined) delete process.env.SAFEWORD_REVIEW_ALTERNATE_MODEL_CODEX;
  else process.env.SAFEWORD_REVIEW_ALTERNATE_MODEL_CODEX = originalEnvironment;
  if (originalPrimaryClaude === undefined) delete process.env.SAFEWORD_REVIEW_PRIMARY_MODEL_CLAUDE;
  else process.env.SAFEWORD_REVIEW_PRIMARY_MODEL_CLAUDE = originalPrimaryClaude;
  if (originalAlternateClaude === undefined)
    delete process.env.SAFEWORD_REVIEW_ALTERNATE_MODEL_CLAUDE;
  else process.env.SAFEWORD_REVIEW_ALTERNATE_MODEL_CLAUDE = originalAlternateClaude;
  for (const directory of directories) {
    rmSync(directory, { recursive: true, force: true });
  }
  directories.length = 0;
});

function projectConfiguring(model: unknown): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-grammar-'));
  directories.push(directory);
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, '.safeword', 'config.json'),
    JSON.stringify({ crossAgentReviewAlternateModel: { codex: model } }),
  );
  return directory;
}

function projectConfiguringPrimary(model: unknown): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-primary-model-'));
  directories.push(directory);
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, '.safeword', 'config.json'),
    JSON.stringify({ crossAgentReviewPrimaryModel: { claude: model } }),
  );
  return directory;
}

describe('the alternate model grammar', () => {
  it('defaults a missing config to prefer but fails closed when an existing config is malformed', () => {
    const missing = mkdtempSync(nodePath.join(tmpdir(), 'safeword-missing-policy-'));
    directories.push(missing);
    const malformed = mkdtempSync(nodePath.join(tmpdir(), 'safeword-malformed-policy-'));
    directories.push(malformed);
    mkdirSync(nodePath.join(malformed, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(malformed, '.safeword', 'config.json'), '{');

    expect(readReviewPolicy(missing)).toBe('prefer');
    expect(readReviewPolicy(malformed)).toBe('require');
  });

  it('defaults Claude reviews to Opus with a Sonnet fallback', () => {
    const directory = projectConfiguring(undefined);

    expect(readPrimaryReviewerModel(directory, 'claude')).toBe('opus');
    expect(readAlternateReviewerModel(directory, 'claude')).toBe('sonnet');
  });

  it('leaves Codex model selection to its authenticated profile by default', () => {
    const directory = projectConfiguring(undefined);

    expect(readPrimaryReviewerModel(directory, 'codex')).toBeUndefined();
    expect(readAlternateReviewerModel(directory, 'codex')).toBeUndefined();
  });

  it('allows the Claude defaults to be overridden independently', () => {
    const directory = projectConfiguring(undefined);
    process.env.SAFEWORD_REVIEW_PRIMARY_MODEL_CLAUDE = 'custom-opus';
    process.env.SAFEWORD_REVIEW_ALTERNATE_MODEL_CLAUDE = 'custom-sonnet';

    expect(readPrimaryReviewerModel(directory, 'claude')).toBe('custom-opus');
    expect(readAlternateReviewerModel(directory, 'claude')).toBe('custom-sonnet');
  });

  it('uses a configured primary Claude model', () => {
    expect(readPrimaryReviewerModel(projectConfiguringPrimary('claude-opus-5'), 'claude')).toBe(
      'claude-opus-5',
    );
  });

  it('falls back to the Claude defaults when environment overrides are unusable', () => {
    const directory = projectConfiguring(undefined);
    process.env.SAFEWORD_REVIEW_PRIMARY_MODEL_CLAUDE = '--help';
    process.env.SAFEWORD_REVIEW_ALTERNATE_MODEL_CLAUDE = '--help';

    expect(readPrimaryReviewerModel(directory, 'claude')).toBe('opus');
    expect(readAlternateReviewerModel(directory, 'claude')).toBe('sonnet');
  });

  it.each([
    ['a vendor-dated identifier', 'claude-sonnet-4-5-20250929'],
    ['a short identifier', 'gpt-5-codex'],
    ['a namespaced tag', 'vendor/model:tag'],
    ['dots and underscores', 'o3_mini.v2'],
    ['the longest accepted value', 'a'.repeat(200)],
  ])('accepts %s', (_label, model) => {
    expect(readAlternateReviewerModel(projectConfiguring(model), 'codex')).toBe(model);
  });

  it.each([
    ['an empty value', ''],
    ['only whitespace', ' '.repeat(3)],
    ['an embedded newline', 'sonnet\nhaiku'],
    ['a shell separator', 'sonnet; rm -rf /'],
    ['a command substitution', 'sonnet$(whoami)'],
    ['a pipe', 'sonnet|tee'],
    ['a NUL byte', 'sonnet\0haiku'],
    ['a unicode line separator', 'sonnet haiku'],
    ['an option-like value', '--help'],
    ['a leading hyphen', '-sonnet'],
    ['one character too long', 'a'.repeat(201)],
    ['a non-string', 42],
  ])('treats %s as no model configured', (_label, model) => {
    expect(readAlternateReviewerModel(projectConfiguring(model), 'codex')).toBeUndefined();
  });

  it('falls through to the configured value when the environment override is unusable', () => {
    process.env.SAFEWORD_REVIEW_ALTERNATE_MODEL_CODEX = '--help';
    expect(readAlternateReviewerModel(projectConfiguring('gpt-5-codex'), 'codex')).toBe(
      'gpt-5-codex',
    );
  });

  it('prefers a usable environment override over the configured value', () => {
    process.env.SAFEWORD_REVIEW_ALTERNATE_MODEL_CODEX = 'from-environment';
    expect(readAlternateReviewerModel(projectConfiguring('gpt-5-codex'), 'codex')).toBe(
      'from-environment',
    );
  });
});
