import { existsSync } from 'node:fs';
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
});
