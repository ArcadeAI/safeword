import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { findCommandDefinition, publicCommands } from '../../src/cli-protocol/catalog.js';
import { addGlobalOptions } from '../../src/cli-protocol/execute.js';
import { registerPublicCommandCatalog } from '../../src/cli-protocol/register.js';
import { createResult } from '../../src/cli-protocol/result.js';
import { createTemporaryDirectory, runCli } from '../helpers.js';

describe('quality-review regressions for the public CLI boundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('gives every public catalog entry a real handler', () => {
    for (const definition of publicCommands) {
      expect(definition, definition.name).toEqual(
        expect.objectContaining({ handler: expect.any(Function) }),
      );
    }
  });

  it('keeps command-family help canonical when the family is also a retained alias', async () => {
    const result = await runCli(['--help']);
    expect(result.stdout).toContain('retro');
    expect(result.stdout).not.toContain('Deprecated alias for retro run');
  });

  it.each(['codex install', 'codex status', 'codex recover', 'ticket new'])(
    'catalogs the public %s leaf',
    name => {
      expect(findCommandDefinition(name)).toEqual(
        expect.objectContaining({ name, public: true, handler: expect.any(Function) }),
      );
    },
  );

  it.each(['diff', 'reset'])('does not expose the legacy codex %s bypass', async leaf => {
    const directory = createTemporaryDirectory();
    const result = await runCli(
      ['codex', leaf, '--json', '--no-input', '--offline', '--cwd', directory],
      { cwd: directory },
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      changed: false,
      errors: [{ code: 'CLI_ARGUMENT_INVALID' }],
    });
  });

  it('executes machine Gherkin lint instead of returning synthetic health', async () => {
    const directory = createTemporaryDirectory();
    const result = await runCli(
      [
        'project',
        'lint-gherkin',
        'missing.feature',
        '--json',
        '--no-input',
        '--offline',
        '--cwd',
        directory,
      ],
      { cwd: directory },
    );

    expect(result).toMatchObject({ exitCode: 1, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      changed: false,
      errors: [{ code: 'GHERKIN_FILE_NOT_FOUND' }],
    });
  });

  it('honors --cwd and the typed renderer when creating a ticket', async () => {
    const invocationDirectory = createTemporaryDirectory();
    const targetDirectory = createTemporaryDirectory();
    const result = await runCli(
      [
        'ticket',
        'new',
        'machine-fixture',
        '--type',
        'task',
        '--json',
        '--no-input',
        '--offline',
        '--cwd',
        targetDirectory,
      ],
      {
        cwd: invocationDirectory,
        env: {
          SAFEWORD_NO_UPDATE_CHECK: '1',
          SAFEWORD_TICKET_ID_OVERRIDE: 'N80D28',
        },
      },
    );

    expect(result).toMatchObject({ exitCode: 0, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'changed',
      changed: true,
      data: { command: 'ticket new', ticket_id: 'N80D28' },
    });
    expect(
      existsSync(
        nodePath.join(targetDirectory, '.project/tickets/N80D28-machine-fixture/ticket.md'),
      ),
    ).toBe(true);
    expect(existsSync(nodePath.join(invocationDirectory, '.project'))).toBe(false);
  });

  it('returns an offline tracker plan through the typed renderer', async () => {
    const directory = createTemporaryDirectory();
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword/config.json'),
      JSON.stringify({ ticketBridge: { provider: 'github', target: { repo: 'acme/demo' } } }),
    );

    const result = await runCli(
      ['tracker', 'sync', '--plan', '--json', '--no-input', '--offline', '--cwd', directory],
      { cwd: directory },
    );

    expect(result).toMatchObject({ exitCode: 0, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'healthy',
      effects: { network: [] },
      data: {
        command: 'tracker sync',
        mode: 'plan',
        provider: 'github',
        plan: { version: 1, intents: [] },
      },
    });
  });

  it('applies tracker executor results offline through the typed renderer', async () => {
    const directory = createTemporaryDirectory();
    const ticketDirectory = nodePath.join(directory, '.project/tickets/AB12CD-login');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword/config.json'),
      JSON.stringify({ ticketBridge: { provider: 'github', target: { repo: 'acme/demo' } } }),
    );
    writeFileSync(
      nodePath.join(ticketDirectory, 'ticket.md'),
      ['---', 'id: AB12CD', 'slug: login', 'type: task', 'status: in_progress', '---'].join('\n'),
    );
    const resultsFile = nodePath.join(directory, 'results.json');
    writeFileSync(
      resultsFile,
      JSON.stringify({
        version: 1,
        results: [
          {
            ticketId: 'AB12CD',
            number: '549',
            url: 'https://github.com/acme/demo/issues/549',
          },
        ],
      }),
    );

    const result = await runCli(
      [
        'tracker',
        'sync',
        '--apply-results',
        resultsFile,
        '--json',
        '--no-input',
        '--offline',
        '--cwd',
        directory,
      ],
      { cwd: directory },
    );

    expect(result).toMatchObject({ exitCode: 0, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'changed',
      effects: {
        files: [{ kind: 'update', target: '.safeword/tracker-map.json' }],
        network: [],
      },
      data: { command: 'tracker sync', mode: 'apply', provider: 'github' },
    });
    const trackerMapPath = nodePath.join(directory, '.safeword/tracker-map.json');
    const trackerMap = JSON.parse(readFileSync(trackerMapPath, 'utf8'));
    expect(trackerMap).toMatchObject({
      issues: { AB12CD: { ref: { provider: 'github', id: '549' } } },
    });
  });

  it('renders a stable JSON result when a post-parse handler throws', async () => {
    const definition = findCommandDefinition('capabilities');
    const originalHandler = definition.handler;
    Object.defineProperty(definition, 'handler', {
      configurable: true,
      value: () => Promise.reject(new Error('adapter exploded')),
    });
    const stdout: string[] = [];
    const stderr: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(chunk => {
      stdout.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation(chunk => {
      stderr.push(String(chunk));
      return true;
    });

    try {
      const program = new Command().name('safeword');
      addGlobalOptions(program);
      registerPublicCommandCatalog(program);
      await program.parseAsync(['node', 'safeword', 'capabilities', '--json', '--no-input']);
    } finally {
      Object.defineProperty(definition, 'handler', {
        configurable: true,
        value: originalHandler,
      });
    }

    expect(stderr).toEqual([]);
    expect(process.exitCode).toBe(1);
    expect(JSON.parse(stdout.join(''))).toMatchObject({
      schema_version: 1,
      state: 'failed',
      changed: false,
      errors: [{ code: 'COMMAND_EXECUTION_FAILED', retryable: false }],
    });
  });

  it('renders Commander argument failures through the JSON protocol', async () => {
    const result = await runCli(['capabilities', '--json', '--no-input', '--definitely-invalid']);

    expect(result).toMatchObject({ exitCode: 1, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      schema_version: 1,
      state: 'failed',
      changed: false,
      errors: [{ code: 'CLI_ARGUMENT_INVALID', retryable: false }],
    });
  });

  it('does not claim a mutation when removal fails during preflight', async () => {
    const directory = createTemporaryDirectory();
    const safewordDirectory = nodePath.join(directory, '.safeword');
    mkdirSync(safewordDirectory);
    chmodSync(safewordDirectory, 0o000);

    try {
      const result = await runCli(['remove', '--json', '--no-input', '--cwd', directory], {
        cwd: directory,
      });

      expect(result).toMatchObject({ exitCode: 1, stderr: '' });
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'failed',
        changed: false,
        effects: {
          files: [],
          packages: [],
          configuration: [],
          network: [],
          destructive: [],
        },
      });
    } finally {
      chmodSync(safewordDirectory, 0o700);
    }
  });

  it('gives canonical retro leaves options parsed by the retained family alias', async () => {
    const definition = findCommandDefinition('retro run');
    const originalHandler = definition.handler;
    Object.defineProperty(definition, 'handler', {
      configurable: true,
      value: (invocation: { options: Readonly<Record<string, unknown>> }) =>
        Promise.resolve(createResult({ state: 'healthy', data: invocation.options })),
    });
    const stdout: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(chunk => {
      stdout.push(String(chunk));
      return true;
    });

    try {
      const program = new Command().name('safeword');
      addGlobalOptions(program);
      registerPublicCommandCatalog(program);
      await program.parseAsync([
        'node',
        'safeword',
        'retro',
        'run',
        '--transcript',
        'session.jsonl',
        '--findings',
        'findings.json',
        '--json',
        '--no-input',
      ]);
    } finally {
      Object.defineProperty(definition, 'handler', {
        configurable: true,
        value: originalHandler,
      });
    }

    expect(JSON.parse(stdout.join(''))).toMatchObject({
      state: 'healthy',
      data: {
        transcript: 'session.jsonl',
        findings: 'findings.json',
      },
    });
  });
});
