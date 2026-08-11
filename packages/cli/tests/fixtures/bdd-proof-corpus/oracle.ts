import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

export type BddProofVerdict = 'accept' | 'reject';

interface CorpusManifestCase {
  id: string;
  expected_verdict: BddProofVerdict;
  baseline_failure?: 'setup';
  defect_modes?: string[];
  pattern: string;
  reason: string;
  neighboring_valid_case?: string;
  provenance?: string;
}

interface CorpusManifest {
  schema_version: number;
  cases: CorpusManifestCase[];
}

export interface BddProofCase {
  id: string;
  expectedVerdict: BddProofVerdict;
  baselineFailure?: 'setup';
  defectModes: readonly string[];
  pattern: string;
  reason: string;
  neighboringValidCase?: string;
  provenance?: string;
  feature: string;
  proof: string;
}

export interface BddProofCorpus {
  schemaVersion: number;
  cases: BddProofCase[];
}

const corpusRoot = import.meta.dirname;
const CASE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFECT_MODE_PATTERN = CASE_ID_PATTERN;

function requireNonEmptyString(value: unknown, field: string, label: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label}: ${field} must be a non-empty string`);
  }
}

function validateDefectModes(defectModes: unknown, label: string): void {
  if (defectModes === undefined) return;
  if (
    !Array.isArray(defectModes) ||
    defectModes.length === 0 ||
    defectModes.some(mode => typeof mode !== 'string' || !DEFECT_MODE_PATTERN.test(mode))
  ) {
    throw new TypeError(`${label}: defect_modes must be a non-empty array of safe kebab-case IDs`);
  }
  if (new Set(defectModes).size !== defectModes.length) {
    throw new TypeError(`${label}: defect_modes must be unique`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateManifestCase(
  testCase: unknown,
  index: number,
): asserts testCase is CorpusManifestCase {
  if (!isRecord(testCase)) {
    throw new TypeError(`case[${index}]: each case must be an object`);
  }
  const label = typeof testCase.id === 'string' ? testCase.id : `case[${index}]`;
  if (typeof testCase.id !== 'string' || !CASE_ID_PATTERN.test(testCase.id)) {
    throw new TypeError(`${label}: id must be a safe kebab-case fixture name`);
  }
  requireNonEmptyString(testCase.pattern, 'pattern', label);
  requireNonEmptyString(testCase.reason, 'reason', label);
  if (testCase.expected_verdict !== 'accept' && testCase.expected_verdict !== 'reject') {
    throw new TypeError(`${label}: expected_verdict must be accept or reject`);
  }
  if (testCase.baseline_failure !== undefined && testCase.baseline_failure !== 'setup') {
    throw new TypeError(`${label}: baseline_failure must be setup when present`);
  }
  validateDefectModes(testCase.defect_modes, label);
}

function validateManifestRelationships(cases: readonly CorpusManifestCase[]): void {
  const ids = cases.map(testCase => testCase.id);
  if (new Set(ids).size !== ids.length)
    throw new TypeError('BDD proof corpus case IDs must be unique');
  const acceptedIds = new Set(
    cases.filter(testCase => testCase.expected_verdict === 'accept').map(testCase => testCase.id),
  );
  for (const candidate of cases) {
    if (candidate.expected_verdict !== 'reject') continue;
    const neighbor = candidate.neighboring_valid_case;
    requireNonEmptyString(neighbor, 'neighboring_valid_case', candidate.id);
    if (typeof neighbor !== 'string' || !acceptedIds.has(neighbor)) {
      throw new TypeError(
        `${candidate.id}: neighboring_valid_case must name an accepted corpus case`,
      );
    }
  }
}

function validateManifest(manifest: unknown): asserts manifest is CorpusManifest {
  if (!isRecord(manifest)) {
    throw new TypeError('BDD proof corpus manifest must be an object');
  }
  if (manifest.schema_version !== 2 || !Array.isArray(manifest.cases)) {
    throw new TypeError(
      'BDD proof corpus manifest must use schema_version 2 and contain a cases array',
    );
  }
  const indexedCases = manifest.cases.entries();
  for (const [index, testCase] of indexedCases) validateManifestCase(testCase, index);
  validateManifestRelationships(manifest.cases);
}

export function loadBddProofCorpus(): BddProofCorpus {
  const manifest: unknown = JSON.parse(
    readFileSync(nodePath.join(corpusRoot, 'manifest.json'), 'utf8'),
  );
  validateManifest(manifest);
  const registeredIds = manifest.cases
    .map(testCase => testCase.id)
    .toSorted((left, right) => left.localeCompare(right));
  const fixtureIds = readdirSync(nodePath.join(corpusRoot, 'cases'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .toSorted((left, right) => left.localeCompare(right));
  if (JSON.stringify(registeredIds) !== JSON.stringify(fixtureIds)) {
    throw new Error(
      `BDD proof corpus manifest/files mismatch: registered=${registeredIds.join(',')} fixtures=${fixtureIds.join(',')}`,
    );
  }
  return {
    schemaVersion: manifest.schema_version,
    cases: manifest.cases.map(testCase => {
      const caseRoot = nodePath.join(corpusRoot, 'cases', testCase.id);
      return {
        id: testCase.id,
        expectedVerdict: testCase.expected_verdict,
        ...(testCase.baseline_failure !== undefined && {
          baselineFailure: testCase.baseline_failure,
        }),
        defectModes: testCase.defect_modes ?? ['1'],
        pattern: testCase.pattern,
        reason: testCase.reason,
        ...(testCase.neighboring_valid_case !== undefined && {
          neighboringValidCase: testCase.neighboring_valid_case,
        }),
        ...(testCase.provenance !== undefined && { provenance: testCase.provenance }),
        feature: readFileSync(nodePath.join(caseRoot, 'feature.feature'), 'utf8'),
        proof: readFileSync(nodePath.join(caseRoot, 'steps.ts.txt'), 'utf8'),
      };
    }),
  };
}

export function runBddProofCorpusOracle(
  corpus: BddProofCorpus,
  classify: (testCase: BddProofCase) => BddProofVerdict,
): {
  passed: number;
  failures: { id: string; expected: BddProofVerdict; actual: BddProofVerdict }[];
} {
  const failures = corpus.cases.flatMap(testCase => {
    const actual = classify(testCase);
    return actual === testCase.expectedVerdict
      ? []
      : [{ id: testCase.id, expected: testCase.expectedVerdict, actual }];
  });
  return { passed: corpus.cases.length - failures.length, failures };
}
