import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseFeatureScenarios } from '../src/utils/gherkin-feature.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../..');
const WORKSPACE_DIRECTORIES = ['packages', 'apps', 'libs', 'modules'] as const;
const FEATURE_HIGH_WATER_LINES = 1000;
const OFFLOAD_FEATURE_PREFIX = 'packages/cli/features/offload-tests-';
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
const OFFLOAD_SEMANTIC_DIGEST = 'ae85ca52e26737f6ae5243bb15ba173f2c68801e3b1d8803c63f3909d1a220fe';

// A cohesive specification may cross a high-water mark when reviewers accept
// an explicit path-and-reason exception here. The default stays fail-closed.
const REVIEWED_COHESIVE_EXCEPTIONS: Readonly<Record<string, string>> = {};

function featureFilesUnder(relativeDirectory: string): string[] {
  const absoluteDirectory = nodePath.join(REPO_ROOT, relativeDirectory);
  if (!existsSync(absoluteDirectory)) return [];

  return readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap(entry => {
    const relativePath = nodePath.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return featureFilesUnder(relativePath);
    return entry.isFile() && entry.name.endsWith('.feature') ? [relativePath] : [];
  });
}

function configuredFeatureFiles(): string[] {
  const workspaceFeatures = WORKSPACE_DIRECTORIES.flatMap(workspaceDirectory => {
    const absoluteDirectory = nodePath.join(REPO_ROOT, workspaceDirectory);
    if (!existsSync(absoluteDirectory)) return [];

    return readdirSync(absoluteDirectory, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .flatMap(entry =>
        featureFilesUnder(nodePath.join(workspaceDirectory, entry.name, 'features')),
      );
  });

  return [...featureFilesUnder('features'), ...workspaceFeatures];
}

function countGherkinLines(source: string, prefix: string): number {
  return source.split('\n').filter(line => line.trimStart().startsWith(prefix)).length;
}

function offloadRuleId(line: string): string | undefined {
  const tag = line.trim();
  if (!tag.startsWith('@offload-tests.')) return undefined;

  const id = tag.slice(1);
  return /^offload-tests\.(?:TBU1|NTB1)\.R\d+$/u.test(id) ? id : undefined;
}

describe('BDD feature maintainability', () => {
  it('keeps feature files below reviewed monolith high-water marks', () => {
    const oversized = configuredFeatureFiles().flatMap(relativePath => {
      if (REVIEWED_COHESIVE_EXCEPTIONS[relativePath] !== undefined) return [];

      const source = readFileSync(nodePath.join(REPO_ROOT, relativePath), 'utf8');
      const lines = source.split('\n').length - (source.endsWith('\n') ? 1 : 0);
      if (lines <= FEATURE_HIGH_WATER_LINES) return [];

      const rules = countGherkinLines(source, 'Rule:');
      return [{ path: relativePath, lines, rules }];
    });

    expect(oversized).toEqual([]);
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
    const ruleIds = sources
      .flatMap(source => source.split('\n').flatMap(line => offloadRuleId(line) ?? []))
      .toSorted((left, right) => left.localeCompare(right));
    const expandedCases = sources
      .flatMap(source => parseFeatureScenarios(source))
      .map(scenario => ({
        ...scenario,
        tags: scenario.tags.toSorted((left, right) => left.localeCompare(right)),
      }))
      .toSorted((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
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
      everyFileIsWip: sources.every(source => source.startsWith('@wip\n')),
      everyFileHasOneRule: sources.every(source => countGherkinLines(source, 'Rule:') === 1),
      everyFeatureIsNamed: featureNames.every(name => name !== undefined && name !== ''),
      uniqueFeatureNames: new Set(featureNames).size,
      ruleIds,
      declarations: scenarios + outlines,
      scenarios,
      outlines,
      examples,
      expandedCases: expandedCases.length,
      semanticDigest: createHash('sha256').update(JSON.stringify(expandedCases)).digest('hex'),
    }).toEqual({
      files: 16,
      everyFileIsWip: true,
      everyFileHasOneRule: true,
      everyFeatureIsNamed: true,
      uniqueFeatureNames: 16,
      ruleIds: OFFLOAD_RULE_IDS,
      declarations: 134,
      scenarios: 55,
      outlines: 79,
      examples: 79,
      expandedCases: 624,
      semanticDigest: OFFLOAD_SEMANTIC_DIGEST,
    });
  });
});
