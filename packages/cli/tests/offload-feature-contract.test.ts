import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { collectExecutableFeatureFiles } from '../src/utils/feature-source.js';
import { parseFeatureScenarios } from '../src/utils/gherkin-feature.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../..');
const STEP_MAX_CHARACTERS = 240;
const FEATURE_PREFIX = 'packages/cli/features/offload-tests-';
const RULE_IDS = [
  'offload-tests.NTB1.R1',
  'offload-tests.NTB1.R2',
  'offload-tests.NTB1.R3',
  'offload-tests.TBU1.R1',
  'offload-tests.TBU1.R10',
  'offload-tests.TBU1.R11',
  'offload-tests.TBU1.R12',
  'offload-tests.TBU1.R13',
  'offload-tests.TBU1.R2',
  'offload-tests.TBU1.R3',
  'offload-tests.TBU1.R4',
  'offload-tests.TBU1.R5',
  'offload-tests.TBU1.R6',
  'offload-tests.TBU1.R7',
  'offload-tests.TBU1.R8',
  'offload-tests.TBU1.R9',
] as const;
const META_PROOF_TITLES = [
  'The effective permission manifest is exactly contents read',
  'The malformed pending-record fixture matrix is complete',
  'The owned-channel manifest exactly covers captured production surfaces',
  'The personal-config boundary manifest is complete and executes every fixture independently',
  'The pinned HTTP 200 response-member allowlist is independently frozen',
  'The reconciliation failure manifest covers every production durability site',
  'The run-identity mutation manifest covers every field-defect cell',
  'The workflow identity-input boundary matrix is complete',
] as const;

function offloadFiles(): string[] {
  return collectExecutableFeatureFiles(REPO_ROOT)
    .map(path => nodePath.relative(REPO_ROOT, path))
    .filter(path => path.startsWith(FEATURE_PREFIX))
    .toSorted((left, right) => left.localeCompare(right));
}

function ruleId(line: string): string | undefined {
  const tag = line
    .trim()
    .split(/\s+/u)
    .find(value => value.startsWith('@offload-tests.'));
  const id = tag?.slice(1);
  return id !== undefined && /^offload-tests\.(?:TBU1|NTB1)\.R\d+$/u.test(id) ? id : undefined;
}

describe('offload feature split contract', () => {
  it('keeps steps narrow enough to identify one failing observation', () => {
    const oversized = offloadFiles().flatMap(path =>
      readFileSync(nodePath.join(REPO_ROOT, path), 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          /^\s*(?:Given|When|Then|And|But)\s/u.test(line) && line.length > STEP_MAX_CHARACTERS
            ? [{ path, line: index + 1, characters: line.length }]
            : [],
        ),
    );
    expect(oversized).toEqual([]);
  });

  it('keeps the ticket-owned split structurally complete and independently named', () => {
    const files = offloadFiles();
    const sources = files.map(path => readFileSync(nodePath.join(REPO_ROOT, path), 'utf8'));
    const featureNames = sources.map(source =>
      source
        .split('\n')
        .find(line => line.startsWith('Feature: '))
        ?.slice('Feature: '.length),
    );
    const ruleIds = sources
      .flatMap(source => source.split('\n').flatMap(line => ruleId(line) ?? []))
      .toSorted((left, right) => left.localeCompare(right));
    const metaProofTitles = [
      ...new Set(
        sources
          .flatMap(source => parseFeatureScenarios(source))
          .filter(scenario => scenario.tags.includes('@proof.pending-vitest'))
          .map(scenario => scenario.title.replace(/ \(.+\)$/u, '')),
      ),
    ].toSorted((left, right) => left.localeCompare(right));
    const canonicalHeaders = sources.every(source => {
      const lines = source.replaceAll('\r\n', '\n').split('\n');
      const ruleStart = lines.findIndex(line => ruleId(line) !== undefined);
      return (
        ruleStart === 2 &&
        lines[0]?.startsWith('Feature: ') === true &&
        lines[1] === '' &&
        lines[ruleStart]?.startsWith('  @wip @offload-tests.') === true
      );
    });

    expect({
      files: files.length,
      canonicalHeaders,
      ruleIds,
      metaProofTitles,
    }).toEqual({
      files: RULE_IDS.length,
      canonicalHeaders: true,
      ruleIds: RULE_IDS,
      metaProofTitles: META_PROOF_TITLES,
    });
    expect(featureNames.every(name => typeof name === 'string' && name.length > 0)).toBe(true);
    expect(new Set(featureNames).size).toBe(RULE_IDS.length);
    expect(sources.every(source => (source.match(/^ {2}Rule:/gmu) ?? []).length === 1)).toBe(true);
  });
});
