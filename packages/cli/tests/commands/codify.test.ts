/**
 * Integration tests for `safeword codify <ticket>` (ticket CS86B0).
 *
 * Covers AC3 from `.safeword-project/tickets/CS86B0/test-definitions.md`: output
 * sink (stdout default / --out file) and bad-input errors. End-to-end via the
 * built CLI (dist/cli.js) in a temp dir — rebuild before running. The emitter
 * itself (AC1 + AC2) is unit-tested in src/utils/test-skeleton.test.ts.
 */

import { readdirSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  fileExists,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  TIMEOUT_QUICK,
  writeTestFile,
} from '../helpers.js';

const TICKET_ID = 'DEMO01';

/** A two-scenario, one-rule test-definitions.md saved on disk for a ticket. */
const TWO_SCENARIOS = [
  '# Test Definitions',
  '',
  '## Rule: demo behaviour',
  '',
  '### Scenario: demo.DEV1.AC1.one',
  '',
  'Given a',
  'When b',
  'Then c',
  '',
  '- [ ] RED',
  '- [ ] GREEN',
  '- [ ] REFACTOR',
  '',
  '### Scenario: demo.DEV1.AC1.two',
  '',
  'Given a',
  'When b',
  'Then c',
  '',
  '- [ ] RED',
  '- [ ] GREEN',
  '- [ ] REFACTOR',
  '',
].join('\n');

function scaffoldTicket(root: string, testDefinitions: string): void {
  writeTestFile(
    root,
    `.safeword-project/tickets/${TICKET_ID}/test-definitions.md`,
    testDefinitions,
  );
}

function scaffoldFeatureTicket(root: string): void {
  writeTestFile(root, `.safeword-project/tickets/${TICKET_ID}-demo/ticket.md`, '# demo');
  writeTestFile(
    root,
    'features/demo.feature',
    [
      'Feature: Demo feature source',
      '',
      '  Rule: source rule',
      '',
      '    @demo.DEV1.AC1',
      '    Scenario: demo.DEV1.AC1.feature_source_one',
      '      Given a feature file',
      '      When codify runs',
      '      Then a Vitest test is emitted',
      '',
      '    @demo.DEV1.AC1',
      '    Scenario: demo.DEV1.AC1.feature_source_two',
      '      Given a second scenario',
      '      When codify runs',
      '      Then another Vitest test is emitted',
      '',
    ].join('\n'),
  );
}

function scaffoldInvalidFeatureTicket(root: string): void {
  writeTestFile(root, `.safeword-project/tickets/${TICKET_ID}-demo/ticket.md`, '# demo');
  writeTestFile(
    root,
    'features/demo.feature',
    ['Feature: Broken', '  Scenario: bad', '    Given ok', '    nope', ''].join('\n'),
  );
}

function scaffoldOutlineFeatureTicket(root: string): void {
  writeTestFile(root, `.safeword-project/tickets/${TICKET_ID}-demo/ticket.md`, '# demo');
  writeTestFile(
    root,
    'features/demo.feature',
    [
      'Feature: Demo feature source',
      '',
      '  Rule: source rule',
      '',
      '    @demo.DEV1.AC1',
      '    Scenario Outline: demo.DEV1.AC1.outline_source',
      '      Given a <source> feature file',
      '      Then codify emits <result>',
      '',
      '      Examples: source rows',
      '        | source | result       |',
      '        | valid  | a test stub  |',
      '        | tagged | coverage tag |',
      '',
    ].join('\n'),
  );
}

function countTests(emitted: string): number {
  return (emitted.match(/\bit(?:\.todo)?\(/g) ?? []).length;
}

describe('safeword codify', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  it(
    'codify.DEV1.AC3.default_prints_to_stdout',
    async () => {
      scaffoldTicket(temporaryDirectory, TWO_SCENARIOS);
      const result = await runCli(['codify', TICKET_ID], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('describe(');
      expect(countTests(result.stdout)).toBe(2);
      // stdout-only: no test file written to disk.
      const written = readdirSync(temporaryDirectory).filter(name => name.endsWith('.test.ts'));
      expect(written).toEqual([]);
    },
    TIMEOUT_QUICK,
  );

  it(
    'codify.DEV1.AC3.out_writes_the_file',
    async () => {
      scaffoldTicket(temporaryDirectory, TWO_SCENARIOS);
      const result = await runCli(['codify', TICKET_ID, '--out', 'gen.test.ts'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);
      expect(fileExists(temporaryDirectory, 'gen.test.ts')).toBe(true);
      const written = readTestFile(temporaryDirectory, 'gen.test.ts');
      expect(written).toContain('describe(');
      expect(countTests(written)).toBe(2);
    },
    TIMEOUT_QUICK,
  );

  it(
    'codify.DEV1.AC3.out_refuses_to_overwrite_an_existing_file',
    async () => {
      scaffoldTicket(temporaryDirectory, TWO_SCENARIOS);
      writeTestFile(temporaryDirectory, 'gen.test.ts', 'ORIGINAL CONTENT');
      const result = await runCli(['codify', TICKET_ID, '--out', 'gen.test.ts'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/overwrite|exists|refus/i);
      expect(readTestFile(temporaryDirectory, 'gen.test.ts')).toBe('ORIGINAL CONTENT');
    },
    TIMEOUT_QUICK,
  );

  it(
    'codify.DEV1.AC3.out_parent_dir_missing_errors',
    async () => {
      scaffoldTicket(temporaryDirectory, TWO_SCENARIOS);
      const result = await runCli(['codify', TICKET_ID, '--out', 'missing-dir/gen.test.ts'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('missing-dir/gen.test.ts');
      expect(fileExists(temporaryDirectory, 'missing-dir/gen.test.ts')).toBe(false);
    },
    TIMEOUT_QUICK,
  );

  it(
    'codify.DEV1.AC3.missing_test_definitions_errors',
    async () => {
      // Ticket folder exists (ticket.md) but no test-definitions.md.
      writeTestFile(temporaryDirectory, `.safeword-project/tickets/${TICKET_ID}/ticket.md`, '# x');
      const result = await runCli(['codify', TICKET_ID], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/test-definitions/);
    },
    TIMEOUT_QUICK,
  );

  it(
    'codify.DEV1.AC3.scenario_less_input_errors',
    async () => {
      scaffoldTicket(temporaryDirectory, '# Test Definitions\n\nNo rules or scenarios here.\n');
      const result = await runCli(['codify', TICKET_ID], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/no scenarios/i);
      expect(result.stdout).not.toContain('describe(');
    },
    TIMEOUT_QUICK,
  );

  it(
    'gherkin-typescript.DEV1.AC2.default_emits_vitest',
    async () => {
      scaffoldTicket(temporaryDirectory, TWO_SCENARIOS);
      const result = await runCli(['codify', TICKET_ID], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('describe(');
      expect(result.stdout).not.toContain('Feature:');
    },
    TIMEOUT_QUICK,
  );

  it(
    'feature-files-as-source.SM1.AC2.feature_source_default_emits_vitest',
    async () => {
      scaffoldFeatureTicket(temporaryDirectory);
      const result = await runCli(['codify', TICKET_ID], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('describe("source rule"');
      expect(result.stdout).toContain('it.todo("demo.DEV1.AC1.feature_source_one")');
      expect(countTests(result.stdout)).toBe(2);
    },
    TIMEOUT_QUICK,
  );

  it(
    'feature-files-as-source.SM1.AC2.scenario_outline_rows_emit_distinct_vitest_stubs',
    async () => {
      scaffoldOutlineFeatureTicket(temporaryDirectory);
      const result = await runCli(['codify', TICKET_ID], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(
        'it.todo("demo.DEV1.AC1.outline_source (source=valid, result=a test stub)")',
      );
      expect(result.stdout).toContain(
        'it.todo("demo.DEV1.AC1.outline_source (source=tagged, result=coverage tag)")',
      );
      expect(result.stdout).toContain('// Given a valid feature file');
      expect(result.stdout).toContain('// Then codify emits coverage tag');
      expect(countTests(result.stdout)).toBe(2);
    },
    TIMEOUT_QUICK,
  );

  it(
    'feature-files-as-source.SM1.AC2.feature_source_format_gherkin_echoes_source',
    async () => {
      scaffoldFeatureTicket(temporaryDirectory);
      const result = await runCli(['codify', TICKET_ID, '--format', 'gherkin'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Feature: Demo feature source');
      expect(result.stdout).toContain('Scenario: demo.DEV1.AC1.feature_source_two');
      expect(result.stdout).not.toContain('describe(');
    },
    TIMEOUT_QUICK,
  );

  it(
    'feature-files-as-source.SM1.AC2.invalid_feature_source_errors_without_parser_stack',
    async () => {
      scaffoldInvalidFeatureTicket(temporaryDirectory);
      const result = await runCli(['codify', TICKET_ID], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/features\/demo\.feature/);
      expect(result.stderr).toMatch(/invalid gherkin/i);
      expect(result.stderr).not.toMatch(/CompositeParserException|Parser\.ts|class Composite/i);
    },
    TIMEOUT_QUICK,
  );

  it(
    'gherkin-typescript.DEV1.AC2.format_gherkin_emits_feature',
    async () => {
      scaffoldTicket(temporaryDirectory, TWO_SCENARIOS);
      const result = await runCli(['codify', TICKET_ID, '--format', 'gherkin'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Feature:');
      expect(result.stdout).not.toContain('describe(');
      expect(result.stdout.match(/^[ \t]*Scenario:/gm) ?? []).toHaveLength(2);
    },
    TIMEOUT_QUICK,
  );

  it(
    'bdd-lane-adoption.7CK2KP.conventions_pointer_prints_to_stderr_when_configured',
    async () => {
      scaffoldTicket(temporaryDirectory, TWO_SCENARIOS);
      writeTestFile(
        temporaryDirectory,
        '.safeword/config.json',
        JSON.stringify({ bdd: { conventions: 'tests/CONVENTIONS.md' } }),
      );
      const result = await runCli(['codify', TICKET_ID], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('tests/CONVENTIONS.md');
      // stdout stays a clean skeleton — the pointer must not corrupt `codify > file`.
      expect(result.stdout).not.toContain('CONVENTIONS.md');
      expect(countTests(result.stdout)).toBe(2);
    },
    TIMEOUT_QUICK,
  );

  it(
    'bdd-lane-adoption.7CK2KP.no_pointer_when_conventions_unset',
    async () => {
      scaffoldTicket(temporaryDirectory, TWO_SCENARIOS);
      const result = await runCli(['codify', TICKET_ID], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).not.toContain('Host conventions');
    },
    TIMEOUT_QUICK,
  );

  it(
    'gherkin-typescript.DEV1.AC2.unknown_format_errors',
    async () => {
      scaffoldTicket(temporaryDirectory, TWO_SCENARIOS);
      const result = await runCli(['codify', TICKET_ID, '--format', 'bogus'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/gherkin/);
      expect(result.stderr).toMatch(/vitest/);
    },
    TIMEOUT_QUICK,
  );
});
