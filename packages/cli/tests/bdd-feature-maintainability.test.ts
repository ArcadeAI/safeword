import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { collectExecutableFeatureFiles } from '../src/utils/feature-source.js';
import { parseFeatureScenarios } from '../src/utils/gherkin-feature.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../..');
// Current cohesive specs top out below 500 lines; 1000 flags an extreme outlier
// without turning ordinary Rule grouping into a mandatory file-count policy.
const FEATURE_HIGH_WATER_LINES = 1000;
const OFFLOAD_STEP_MAX_CHARACTERS = 240;
const OFFLOAD_FEATURE_PREFIX = 'packages/cli/features/offload-tests-';
const OFFLOAD_BASELINE_COMMIT = '1f8056ed845b63923ad9ea19a7112101aa07a9b1';
const OFFLOAD_BASELINE_PATH =
  'packages/cli/features/offload-tests-without-blocking-local-work.feature';
const OFFLOAD_BASELINE_OBJECT = `${OFFLOAD_BASELINE_COMMIT}:${OFFLOAD_BASELINE_PATH}`;
const OFFLOAD_RULE_IDS = [
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
const OFFLOAD_META_PROOF_TITLES = [
  'The effective permission manifest is exactly contents read',
  'The malformed pending-record fixture matrix is complete',
  'The owned-channel manifest exactly covers captured production surfaces',
  'The personal-config boundary manifest is complete and executes every fixture independently',
  'The pinned HTTP 200 response-member allowlist is independently frozen',
  'The reconciliation failure manifest covers every production durability site',
  'The run-identity mutation manifest covers every field-defect cell',
  'The workflow identity-input boundary matrix is complete',
] as const;

// A cohesive specification may cross a high-water mark when reviewers accept
// an explicit path-and-reason exception here. The default stays fail-closed.
const REVIEWED_COHESIVE_EXCEPTIONS: Readonly<Record<string, string>> = {};

function configuredFeatureFiles(): string[] {
  return collectExecutableFeatureFiles(REPO_ROOT).map(absolutePath =>
    nodePath.relative(REPO_ROOT, absolutePath),
  );
}

function countGherkinLines(source: string, prefix: string): number {
  return source.split('\n').filter(line => line.trimStart().startsWith(prefix)).length;
}

function offloadRuleId(line: string): string | undefined {
  const tag = line
    .trim()
    .split(/\s+/u)
    .find(candidate => candidate.startsWith('@offload-tests.'));
  if (tag === undefined) return undefined;

  const id = tag.slice(1);
  return /^offload-tests\.(?:TBU1|NTB1)\.R\d+$/u.test(id) ? id : undefined;
}

function expandedCasesFor(sources: readonly string[]) {
  return sources
    .flatMap(source => parseFeatureScenarios(source))
    .map(scenario => ({
      ...scenario,
      tags: scenario.tags.toSorted((left, right) => left.localeCompare(right)),
    }))
    .toSorted((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function scenarioInventory(expandedCases: ReturnType<typeof expandedCasesFor>) {
  return expandedCases.map(({ rule, title }) => ({ rule, title }));
}

function baselineOffloadFeature(): string {
  // The test job fetches full history so the immutable pre-refactor Git object
  // remains independently inspectable instead of trusting new digest literals.
  const baselineExists = spawnSync('git', ['cat-file', '-e', OFFLOAD_BASELINE_OBJECT], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  expect(
    baselineExists.status,
    `BDD split baseline ${OFFLOAD_BASELINE_OBJECT} is unavailable. Run this test from a full Git checkout (CI uses fetch-depth: 0).`,
  ).toBe(0);
  return execFileSync('git', ['show', OFFLOAD_BASELINE_OBJECT], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

describe('BDD feature maintainability', () => {
  it('expresses an observable event in every production scenario', () => {
    const staticScenarios = configuredFeatureFiles().flatMap(relativePath => {
      const source = readFileSync(nodePath.join(REPO_ROOT, relativePath), 'utf8');
      return parseFeatureScenarios(source).flatMap(scenario =>
        scenario.steps.some(step => step.startsWith('When '))
          ? []
          : [{ path: relativePath, scenario: scenario.title }],
      );
    });

    expect(staticScenarios).toEqual([]);
  });

  it('keeps offload steps narrow enough to identify one failing observation', () => {
    const oversizedSteps = configuredFeatureFiles()
      .filter(relativePath => relativePath.startsWith(OFFLOAD_FEATURE_PREFIX))
      .flatMap(relativePath => {
        const source = readFileSync(nodePath.join(REPO_ROOT, relativePath), 'utf8');
        return source.split('\n').flatMap((line, index) => {
          const isStep = /^\s*(?:Given|When|Then|And|But)\s/u.test(line);
          return isStep && line.length > OFFLOAD_STEP_MAX_CHARACTERS
            ? [{ path: relativePath, line: index + 1, characters: line.length }]
            : [];
        });
      });

    expect(oversizedSteps).toEqual([]);
  });

  it('keeps feature files below reviewed monolith high-water marks', () => {
    const featureFiles = configuredFeatureFiles();
    const configuredPaths = new Set(featureFiles);
    const invalidExceptions = Object.entries(REVIEWED_COHESIVE_EXCEPTIONS).flatMap(
      ([path, reason]) =>
        configuredPaths.has(path) && reason.trim() !== '' ? [] : [{ path, reason }],
    );
    const oversized = featureFiles.flatMap(relativePath => {
      const reviewedReason = REVIEWED_COHESIVE_EXCEPTIONS[relativePath];
      if (reviewedReason !== undefined && reviewedReason.trim() !== '') return [];

      const source = readFileSync(nodePath.join(REPO_ROOT, relativePath), 'utf8');
      const lines = source.split('\n').length - (source.endsWith('\n') ? 1 : 0);
      if (lines <= FEATURE_HIGH_WATER_LINES) return [];

      const rules = countGherkinLines(source, 'Rule:');
      return [{ path: relativePath, lines, rules }];
    });

    expect({ invalidExceptions, oversized }).toEqual({ invalidExceptions: [], oversized: [] });
  });

  it('preserves the offload-tests semantic inventory across Rule-aligned files', () => {
    const files = configuredFeatureFiles()
      .filter(relativePath => relativePath.startsWith(OFFLOAD_FEATURE_PREFIX))
      .toSorted((left, right) => left.localeCompare(right));
    const sources = files.map(relativePath =>
      readFileSync(nodePath.join(REPO_ROOT, relativePath), 'utf8'),
    );
    const featureNames = sources.map(source =>
      source
        .split('\n')
        .find(line => line.startsWith('Feature: '))
        ?.slice('Feature: '.length),
    );
    const everyFeatureHeaderIsCanonical = sources.every(source => {
      const lines = source.replaceAll('\r\n', '\n').split('\n');
      const ruleStart = lines.findIndex(line => offloadRuleId(line) !== undefined);
      return (
        ruleStart === 2 &&
        lines[0]?.startsWith('Feature: ') === true &&
        lines[1] === '' &&
        lines[ruleStart]?.startsWith('  @wip @offload-tests.') === true
      );
    });
    const ruleIds = sources
      .flatMap(source => source.split('\n').flatMap(line => offloadRuleId(line) ?? []))
      .toSorted((left, right) => left.localeCompare(right));
    const baselineSource = baselineOffloadFeature();
    const expandedCases = expandedCasesFor(sources);
    const baselineExpandedCases = expandedCasesFor([baselineSource]);
    const metaProofTitles = [
      ...new Set(
        expandedCases
          .filter(scenario => scenario.tags.includes('@proof.pending-vitest'))
          .map(scenario => scenario.title.replace(/ \(.+\)$/u, '')),
      ),
    ].toSorted((left, right) => left.localeCompare(right));
    const scenarios = sources.reduce(
      (count, source) => count + countGherkinLines(source, 'Scenario:'),
      0,
    );
    const outlines = sources.reduce(
      (count, source) => count + countGherkinLines(source, 'Scenario Outline:'),
      0,
    );
    const examples = sources.reduce(
      (count, source) => count + countGherkinLines(source, 'Examples:'),
      0,
    );

    expect({
      files: files.length,
      everyRuleIsWip: sources.every(source => source.includes('\n  @wip @offload-tests.')),
      everyFileHasOneRule: sources.every(source => countGherkinLines(source, 'Rule:') === 1),
      everyFeatureHeaderIsCanonical,
      everyFeatureIsNamed: featureNames.every(name => name !== undefined && name !== ''),
      uniqueFeatureNames: new Set(featureNames).size,
      ruleIds,
      declarations: scenarios + outlines,
      scenarios,
      outlines,
      examples,
      expandedCases: expandedCases.length,
      scenarioInventory: scenarioInventory(expandedCases),
      metaProofTitles,
    }).toEqual({
      files: 16,
      everyRuleIsWip: true,
      everyFileHasOneRule: true,
      everyFeatureHeaderIsCanonical: true,
      everyFeatureIsNamed: true,
      uniqueFeatureNames: 16,
      ruleIds: OFFLOAD_RULE_IDS,
      declarations: 134,
      scenarios: 55,
      outlines: 79,
      examples: 79,
      expandedCases: 624,
      scenarioInventory: scenarioInventory(baselineExpandedCases),
      metaProofTitles: OFFLOAD_META_PROOF_TITLES,
    });
  });
});
