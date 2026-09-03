import { readFileSync } from 'node:fs';

import { Command } from 'commander';
import { describe, expect, it } from 'vitest';

import {
  addGlobalOptions,
  readCommandOptions,
  readGlobalOptions,
} from '../../src/cli-protocol/execute.js';
import { createCliProgram, normalizeCliArgv } from '../../src/cli-protocol/program.js';

function commandRoutes(program: ReturnType<typeof createCliProgram>): string[] {
  const routes: string[] = [];
  const visit = (
    command: ReturnType<typeof createCliProgram>,
    parents: readonly string[],
  ): void => {
    for (const child of command.commands) {
      const route = [...parents, child.name()];
      routes.push(route.join(' '));
      visit(child, route);
    }
  };
  visit(program, []);
  return routes;
}

describe('production CLI program factory', () => {
  it('maps Commander negated input state to no-input without leaking a command option', () => {
    const command = addGlobalOptions(new Command()).exitOverride();
    command.parse(['node', 'safeword', '--no-input']);

    expect(readGlobalOptions(command).noInput).toBe(true);
    expect(readCommandOptions(command)).not.toHaveProperty('input');
  });

  it('assembles the complete production tree without touching process state', () => {
    const argvBefore = [...process.argv];
    const environmentBefore = { ...process.env };
    const exitCodeBefore = process.exitCode;

    const program = createCliProgram();

    expect(commandRoutes(program)).toEqual(
      expect.arrayContaining([
        'install',
        'project lint-gherkin',
        'review run',
        'boundary',
        'hook codex',
        'codex-hook',
        'feature-directories',
      ]),
    );
    expect(process.argv).toEqual(argvBefore);
    expect(process.env).toEqual(environmentBefore);
    expect(process.exitCode).toBe(exitCodeBefore);
  });

  it('keeps the executable entry point as a Commander-free runCli wrapper', () => {
    const source = readFileSync(new URL('../../src/cli.ts', import.meta.url), 'utf8');

    expect(source).not.toContain("from 'commander'");
    expect(source).not.toContain('.command(');
    expect(source).toContain("import { runCli } from './cli-protocol/program.js';");
    expect(source).toContain('await runCli(process.argv);');
  });

  it('normalizes the retained retro spelling without mutating or losing delimiter values', () => {
    const argv = ['node', 'safeword', 'retro', '--transcript', '--', '--literal'];

    expect(normalizeCliArgv(argv)).toEqual({
      argv: ['node', 'safeword', 'retro', 'run', '--transcript', '--', '--literal'],
      invocation: { retainedAlias: 'retro' },
    });
    expect(argv).toEqual(['node', 'safeword', 'retro', '--transcript', '--', '--literal']);
  });

  it('routes the bare retained retro spelling to retro run', () => {
    expect(normalizeCliArgv(['node', 'safeword', 'retro'])).toEqual({
      argv: ['node', 'safeword', 'retro', 'run'],
      invocation: { retainedAlias: 'retro' },
    });
  });

  it.each([
    [
      ['node', 'safeword', '--json', 'retro'],
      ['node', 'safeword', '--json', 'retro', 'run'],
    ],
    [
      ['node', 'safeword', '-v', 'retro'],
      ['node', 'safeword', '-v', 'retro', 'run'],
    ],
    [
      ['node', 'safeword', '--cwd', '/tmp/project', 'retro'],
      ['node', 'safeword', '--cwd', '/tmp/project', 'retro', 'run'],
    ],
    [
      ['node', 'safeword', '--cwd=/tmp/project', 'retro'],
      ['node', 'safeword', '--cwd=/tmp/project', 'retro', 'run'],
    ],
    [
      ['node', 'safeword', 'retro', '-h'],
      ['node', 'safeword', 'retro', 'run', '-h'],
    ],
  ])('finds retained retro after root options', (argv, expected) => {
    expect(normalizeCliArgv(argv)).toEqual({
      argv: expected,
      invocation: { retainedAlias: 'retro' },
    });
  });

  it('does not treat values after the option delimiter as a command', () => {
    const argv = ['node', 'safeword', '--', 'retro'];
    expect(normalizeCliArgv(argv)).toEqual({ argv, invocation: {} });
  });

  it('leaves direct canonical argv unchanged', () => {
    const argv = ['node', 'safeword', 'retro', 'run', '--transcript', 'fixture'];

    expect(normalizeCliArgv(argv)).toEqual({ argv, invocation: {} });
    expect(normalizeCliArgv(argv).argv).not.toBe(argv);
  });
});
