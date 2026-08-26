import { readdirSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createResult } from '../../src/cli-protocol/result.js';
import { CURSOR_COMMAND_WRAPPERS } from '../../src/cursor-wrappers.js';
import { installLifecycle } from '../../src/lifecycle/commands.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = createTemporaryDirectory();
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories) removeTemporaryDirectory(directory);
  temporaryDirectories.length = 0;
  vi.unstubAllEnvs();
});

describe('OpenCode project catalogue', () => {
  it('TBU1.R1.S01 installs the complete non-empty canonical command and agent sets', async () => {
    const project = temporaryDirectory();
    vi.stubEnv('OPENCODE_CONFIG_DIR', temporaryDirectory());

    const result = await installLifecycle(
      {
        cwd: project,
        noInput: true,
        offline: false,
        operands: [],
        options: { agents: 'opencode' },
      },
      {
        installClaude: () => Promise.resolve(createResult({ state: 'healthy' })),
        installCodex: () => Promise.resolve(createResult({ state: 'healthy' })),
      },
    );

    const markdownNames = (directory: string): string[] =>
      readdirSync(nodePath.join(project, directory))
        .filter(name => name.endsWith('.md'))
        .map(name => name.slice(0, -3))
        .toSorted((left, right) => left.localeCompare(right));
    const commandNames = CURSOR_COMMAND_WRAPPERS.map(wrapper => wrapper.name).toSorted(
      (left, right) => left.localeCompare(right),
    );

    expect(result.errors).toEqual([]);
    expect(commandNames.length).toBeGreaterThan(0);
    expect(markdownNames('.opencode/commands')).toEqual(commandNames);
    expect(markdownNames('.opencode/agents')).toEqual([
      'safeword-retro-filer',
      'safeword-reviewer',
    ]);
  });
});
