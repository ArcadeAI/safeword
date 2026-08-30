import { existsSync, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createResult } from '../../src/cli-protocol/result.js';
import { CURSOR_COMMAND_WRAPPERS } from '../../src/cursor-wrappers.js';
import { installLifecycle } from '../../src/lifecycle/commands.js';
import {
  renderOpenCodeAgent,
  renderOpenCodeCommand,
  SAFEWORD_SUBAGENTS,
} from '../../src/opencode/catalogue.js';
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

describe('OpenCode profile catalogue', () => {
  it('installs the complete native catalogue without project host files', async () => {
    const project = temporaryDirectory();
    const profile = temporaryDirectory();
    vi.stubEnv('OPENCODE_CONFIG_DIR', profile);

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
      readdirSync(nodePath.join(profile, directory))
        .filter(name => name.endsWith('.md'))
        .map(name => name.slice(0, -3))
        .toSorted((left, right) => left.localeCompare(right));
    const commandNames = CURSOR_COMMAND_WRAPPERS.map(
      wrapper => `safeword-${wrapper.name}`,
    ).toSorted((left, right) => left.localeCompare(right));
    const skillNames = readdirSync(
      nodePath.resolve(import.meta.dirname, '../../templates/skills'),
      { withFileTypes: true },
    )
      .filter(entry => entry.isDirectory())
      .map(entry => `safeword-${entry.name}`)
      .toSorted((left, right) => left.localeCompare(right));

    expect(result.errors).toEqual([]);
    expect(commandNames.length).toBeGreaterThan(0);
    expect(markdownNames('commands')).toEqual(commandNames);
    expect(markdownNames('agents')).toEqual(['safeword-retro-filer', 'safeword-reviewer']);
    expect(
      readdirSync(nodePath.join(profile, 'skills')).toSorted((left, right) =>
        left.localeCompare(right),
      ),
    ).toEqual(skillNames);
    expect(existsSync(nodePath.join(project, '.opencode'))).toBe(false);
    expect(existsSync(nodePath.join(project, '.claude/skills'))).toBe(false);
    expect(existsSync(nodePath.join(profile, 'plugins/safeword.js'))).toBe(true);
    expect(existsSync(nodePath.join(profile, 'safeword/dispatcher.mjs'))).toBe(true);
    for (const agent of SAFEWORD_SUBAGENTS) {
      expect(readFileSync(nodePath.join(profile, `agents/${agent.name}.md`), 'utf8')).toBe(
        renderOpenCodeAgent(agent),
      );
    }
  });
});
