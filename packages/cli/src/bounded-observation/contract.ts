import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { AstBuilder, compile, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';

import { parseTicketMetadata } from '../utils/ticket-metadata.js';
import profile from './profile.json';

export const purpose = 'bounded-delivery-observation:v1';
export const deliveryTicket = 'T3E4NS';
export const fixedFiles = [
  'tests/bdd-proof-tags.test.ts',
  'tests/integration/planning-scope-review.test.ts',
  'tests/integration/planning-evidence-boundary.test.ts',
  'tests/integration/installed-planning-copy-admission.test.ts',
  'tests/integration/execution-upstream-planning-context.test.ts',
  'tests/integration/planning-review-route-order.test.ts',
  'tests/integration/execution-plan-checkpoint.test.ts',
  'tests/review/execution-plan-conformance.test.ts',
  'tests/review/execution-plan-contract-identity.test.ts',
  'tests/claude-plugin/catalogue.test.ts',
  'tests/codex-plugin-version.test.ts',
  'tests/integration/planning-documentation.test.ts',
];

export function digest(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Deterministic authentication, independent of object insertion order. */
export function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(item => canonical(item)).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .toSorted(([left], [right]) => compareText(left, right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export const profileSha256 = digest(canonical(profile));

function normalizeRegistration(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The fixed delivery registration must be a scenario mapping');
  }
  return Object.fromEntries(
    Object.entries(value).map(([name, tuples]) => {
      if (!Array.isArray(tuples)) throw new Error(`Invalid registration for ${name}`);
      return [name, typeof tuples[0] === 'string' ? [tuples] : tuples];
    }),
  );
}

function validateProfileMetadata(): void {
  const expected = { schema_version: 1, purpose, ticket: deliveryTicket };
  for (const [field, value] of Object.entries(expected)) {
    if (profile[field as keyof typeof expected] !== value) {
      throw new Error(`Unsupported shipped profile ${field}; restore the reviewed fixed contract`);
    }
  }
}

export function validateCandidateContract(root: string): void {
  validateProfileMetadata();
  const nextId = IdGenerator.incrementing();
  const parser = new Parser(new AstBuilder(nextId), new GherkinClassicTokenMatcher());
  const feature = readFileSync(nodePath.join(root, profile.feature), 'utf8');
  const cases = compile(parser.parse(feature), profile.feature, nextId).map(pickle =>
    digest(
      JSON.stringify({
        name: pickle.name,
        steps: pickle.steps.map(step => ({ text: step.text, argument: step.argument })),
        tags: pickle.tags.map(tag => tag.name),
      }),
    ),
  );
  const expected = profile.cases.map(row => row.case_id);
  if (
    new Set(cases).size !== cases.length ||
    cases.length !== 37 ||
    canonical(cases.toSorted((left, right) => compareText(left, right))) !==
      canonical(expected.toSorted((left, right) => compareText(left, right)))
  ) {
    const actualIds = new Set(cases);
    const expectedIds = new Set(expected);
    const mismatches = [
      ...cases.filter(id => !expectedIds.has(id)),
      ...expected.filter(id => !actualIds.has(id)),
      ...cases.filter((id, index) => cases.indexOf(id) !== index),
    ];
    const identities = [...new Set(mismatches)].join(', ') || 'unsupported case census';
    throw new Error(
      `Unsupported or unmapped delivery case: ${identities}; review a complete shipped mapping`,
    );
  }
  for (const row of profile.cases) {
    if (row.required_assertions.length === 0) throw new Error(`Unmapped case ${row.case_id}`);
  }
  const { metadata } = parseTicketMetadata(
    readFileSync(nodePath.join(root, profile.ticket_path), 'utf8'),
  );
  const actual = Object.fromEntries(
    Object.keys(profile.semantic_ticket).map(key => [key, metadata[key]]),
  );
  if (canonical(actual) !== canonical(profile.semantic_ticket)) {
    throw new Error('Changed accepted scope or phase anchor; review an updated shipped contract');
  }
  const registrationPath = nodePath.join(
    root,
    profile.feature.replace('.feature', '.bdd-proof.json'),
  );
  const registration = JSON.parse(readFileSync(registrationPath, 'utf8')) as { scenarios: unknown };
  if (
    canonical(normalizeRegistration(registration.scenarios)) !==
    canonical(normalizeRegistration(profile.registration))
  ) {
    throw new Error('Changed delivery registration; review the complete fixed shipped mapping');
  }
}

interface AssertionResult {
  fullName: string;
  status: string;
}
interface FileResult {
  name: string;
  status: string;
  assertionResults: AssertionResult[];
}

function observedStatuses(matches: AssertionResult[]): string {
  return matches.length === 0 ? 'absent' : matches.map(match => match.status).join(', ');
}

function validateReportedFiles(files: FileResult[]): void {
  for (const file of files) {
    if (typeof file.name !== 'string' || !Array.isArray(file.assertionResults)) {
      throw new TypeError('Malformed or failed test suite in full report');
    }
    for (const assertion of file.assertionResults) {
      if (typeof assertion.fullName !== 'string' || typeof assertion.status !== 'string') {
        throw new TypeError('Malformed or failed assertion in full report');
      }
    }
  }
}

/** A passing file or aggregate total cannot stand in for a named required result. */
// eslint-disable-next-line complexity -- Fail-closed checks for the fixed Vitest JSON schema.
export function gradeReport(
  bytes: Buffer,
  clone: string,
): {
  case_id: string;
  assertions: { file: string; full_name: string; status: string }[];
}[] {
  const report = JSON.parse(bytes.toString('utf8')) as {
    success?: unknown;
    numFailedTests?: unknown;
    numFailedTestSuites?: unknown;
    numRuntimeErrorTestSuites?: unknown;
    unhandledErrors?: unknown;
    testResults?: unknown;
  };
  if (!Array.isArray(report.testResults)) {
    throw new TypeError(
      'Incomplete or unsuccessful runner report; repair the fixed lane and rerun',
    );
  }
  const files = report.testResults as FileResult[];
  validateReportedFiles(files);
  const results = new Map<string, AssertionResult[]>();
  const actualFiles = files
    .map(file => nodePath.resolve(file.name))
    .toSorted((left, right) => compareText(left, right));
  const expectedFiles = fixedFiles
    .map(file => nodePath.join(clone, 'packages/cli', file))
    .toSorted((left, right) => compareText(left, right));
  if (canonical(actualFiles) !== canonical(expectedFiles)) {
    throw new Error(
      'Incomplete fixed file set in runner report; repair the complete lane and rerun',
    );
  }
  for (const file of files) {
    for (const assertion of file.assertionResults) {
      const key = `${nodePath.resolve(file.name)}\0${assertion.fullName}`;
      results.set(key, [...(results.get(key) ?? []), assertion]);
    }
  }
  const cases = profile.cases.map(row => ({
    case_id: row.case_id,
    assertions: row.required_assertions.map(required => {
      const key = `${nodePath.join(clone, required.file)}\0${required.full_name}`;
      const matches = results.get(key) ?? [];
      if (matches.length !== 1 || matches[0]?.status !== 'passed') {
        throw new Error(
          `Required assertion lacks an exact-once passing result (${observedStatuses(matches)}): ${required.file}: ${required.full_name}; repair and rerun`,
        );
      }
      return { ...required, status: 'passed' };
    }),
  }));
  if (
    report.success !== true ||
    report.numFailedTests !== 0 ||
    report.numFailedTestSuites !== 0 ||
    (report.numRuntimeErrorTestSuites !== undefined && report.numRuntimeErrorTestSuites !== 0) ||
    (report.unhandledErrors !== undefined && canonical(report.unhandledErrors) !== '[]') ||
    files.some(
      file =>
        file.status === 'failed' ||
        file.assertionResults.some(assertion => assertion.status === 'failed'),
    )
  ) {
    throw new Error('Incomplete or unsuccessful runner report; repair the fixed lane and rerun');
  }
  return cases;
}

export { default as observationProfile } from './profile.json';
