import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { findCommandDefinition, publicCommands } from '../../src/cli-protocol/catalog.js';
import { createTemporaryDirectory, runCli } from '../helpers.js';

describe('quality-review regressions for the public CLI boundary', () => {
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
});
