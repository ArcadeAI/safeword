import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

export interface ElectronReportSelection {
  readonly testFile: string;
  readonly testLine: number;
  readonly testFullName: string;
  readonly mutation: { readonly expectedFailure: string; readonly assertionLocation: string };
}

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Electron proof report contains a malformed object.');
  }
  return value as JsonObject;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Electron proof report contains a malformed array.');
  return value;
}

interface SelectedTest {
  readonly title: string;
  readonly spec: JsonObject;
  readonly test: JsonObject;
}

function collectTests(suites: unknown, parents: readonly string[] = []): SelectedTest[] {
  return array(suites).flatMap(value => {
    const suite = object(value);
    if (typeof suite.title !== 'string') throw new Error('Electron suite title is missing.');
    const titles = [...parents, suite.title];
    const tests = array(suite.specs).flatMap(specValue => {
      const spec = object(specValue);
      if (typeof spec.title !== 'string') throw new Error('Electron test title is missing.');
      return array(spec.tests).map(test => ({
        title: ['', ...titles, spec.title].join(' '),
        spec,
        test: object(test),
      }));
    });
    return [...tests, ...collectTests(suite.suites ?? [], titles)];
  });
}

function requireSelection(report: JsonObject, selection: ElectronReportSelection): SelectedTest {
  const tests = collectTests(report.suites);
  const selected = tests[0];
  if (
    tests.length !== 1 ||
    selected?.title !== selection.testFullName ||
    selected.spec.file !== path.posix.basename(selection.testFile) ||
    selected.spec.line !== selection.testLine ||
    selected.test.projectName !== '' ||
    selected.test.projectId !== ''
  ) {
    throw new Error('Electron proof did not execute exactly the declared test.');
  }
  return selected;
}

function requireSingleProject(report: JsonObject): void {
  const projects = array(object(report.config).projects);
  const project = object(projects[0]);
  if (
    projects.length !== 1 ||
    project.id !== '' ||
    project.name !== '' ||
    project.repeatEach !== 1 ||
    project.retries !== 0
  )
    throw new Error('Electron proof requires one project without repeats or retries.');
}

function requireSingleExecution(report: JsonObject, test: JsonObject): JsonObject {
  requireSingleProject(report);
  const results = array(test.results);
  const result = object(results[0]);
  if (
    test.expectedStatus !== 'passed' ||
    array(test.annotations).length > 0 ||
    results.length !== 1 ||
    result.retry !== 0 ||
    array(result.annotations).length > 0
  ) {
    throw new Error(
      'Electron proof requires one unannotated execution without retries or global errors.',
    );
  }
  return result;
}

function requireNoGlobalErrors(report: JsonObject): void {
  const errors = array(report.errors);
  if (errors.length === 0) return;
  const messages = errors
    .map(value => object(value).message)
    .filter((value): value is string => typeof value === 'string');
  const detail = stripVTControlCharacters(messages.join('\n')).slice(0, 2000);
  throw new Error(`Electron proof reported global setup errors: ${detail}`);
}

function requireAssertionLocation(error: JsonObject, selection: ElectronReportSelection): void {
  const location = object(error.location);
  const declared = /^(.*):(\d+)$/u.exec(selection.mutation.assertionLocation);
  const file = typeof location.file === 'string' ? location.file.replaceAll('\\', '/') : '';
  if (
    declared?.[1] !== selection.testFile ||
    !file.endsWith(`/${selection.testFile}`) ||
    location.line !== Number(declared?.[2])
  )
    throw new Error('Electron mutation error location differs from the declared expectation.');
}

function hasMatcherDifference(message: string): boolean {
  const lines = message.split('\n').map(line => line.trim());
  const expected =
    /Expected[^\r\n]*:/u.test(message) || lines.some(line => /^- Expected\s+-\s+\d+$/u.test(line));
  const received =
    /Received[^\r\n]*:/u.test(message) ||
    lines.some(line => /^\+ Received\s+\+\s+\d+$/u.test(line));
  return expected && received;
}

function mutationFailure(result: JsonObject, selection: ElectronReportSelection): string {
  const errors = array(result.errors);
  if (errors.length !== 1) throw new Error('Electron mutation needs exactly one assertion error.');
  const error = object(errors[0]);
  requireAssertionLocation(error, selection);
  const message = typeof error.message === 'string' ? stripVTControlCharacters(error.message) : '';
  if (
    !message.includes(selection.mutation.expectedFailure) ||
    !message.includes(selection.mutation.assertionLocation) ||
    !/expect\([^\r\n]*\)\.[a-zA-Z]/u.test(message) ||
    !hasMatcherDifference(message)
  )
    throw new Error(
      `Electron mutation did not fail at the declared scenario expectation: ${message.slice(0, 5000)}`,
    );
  return message;
}

function requireStatistics(stats: JsonObject, passing: boolean): void {
  if (
    stats.expected !== (passing ? 1 : 0) ||
    stats.unexpected !== (passing ? 0 : 1) ||
    stats.flaky !== 0 ||
    stats.skipped !== 0
  )
    throw new Error('Electron proof statistics do not describe exactly one normal result.');
}

function requireOutcome(
  stats: JsonObject,
  test: JsonObject,
  result: JsonObject,
  expected: 'passed' | 'failed',
  exitCode: number,
): void {
  const passing = expected === 'passed';
  requireStatistics(stats, passing);
  if (
    !Number.isSafeInteger(exitCode) ||
    exitCode < 0 ||
    (passing ? exitCode !== 0 : exitCode === 0) ||
    result.status !== expected ||
    test.status !== (passing ? 'expected' : 'unexpected')
  )
    throw new Error(
      `The declared ${passing ? 'original' : 'mutated'} Electron test did not ${expected} normally.`,
    );
}

/** Interpret a fresh Playwright JSON report, never subprocess output alone. */
export function evaluateElectronReport(
  input: unknown,
  selection: ElectronReportSelection,
  expected: 'passed' | 'failed',
  exitCode: number,
): { exitCode: number; failure: string } {
  const report = object(input);
  requireNoGlobalErrors(report);
  const selected = requireSelection(report, selection);
  const result = requireSingleExecution(report, selected.test);
  const stats = object(report.stats);
  requireOutcome(stats, selected.test, result, expected, exitCode);
  if (expected === 'failed') return { exitCode, failure: mutationFailure(result, selection) };
  if (array(result.errors).length > 0)
    throw new Error('The original Electron test reported errors.');
  return { exitCode, failure: '' };
}
