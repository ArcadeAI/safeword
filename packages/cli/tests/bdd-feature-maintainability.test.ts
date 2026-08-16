import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { collectExecutableFeatureFiles } from '../src/utils/feature-source.js';
import { parseFeatureScenarios } from '../src/utils/gherkin-feature.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../..');
// Current cohesive specs top out below 500 lines; 1000 flags an extreme outlier
// without turning ordinary Rule grouping into a mandatory file-count policy.
const FEATURE_HIGH_WATER_LINES = 1000;

function configuredFeatureFiles(): string[] {
  return collectExecutableFeatureFiles(REPO_ROOT).map(absolutePath =>
    nodePath.relative(REPO_ROOT, absolutePath),
  );
}

function countGherkinLines(source: string, prefix: string): number {
  return source.split('\n').filter(line => line.trimStart().startsWith(prefix)).length;
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

  it('keeps feature files below reviewed monolith high-water marks', () => {
    const featureFiles = configuredFeatureFiles();
    const oversized = featureFiles.flatMap(relativePath => {
      const source = readFileSync(nodePath.join(REPO_ROOT, relativePath), 'utf8');
      const lines = source.split('\n').length - (source.endsWith('\n') ? 1 : 0);
      if (lines <= FEATURE_HIGH_WATER_LINES) return [];

      const rules = countGherkinLines(source, 'Rule:');
      return [{ path: relativePath, lines, rules }];
    });

    expect(oversized).toEqual([]);
  });
});
