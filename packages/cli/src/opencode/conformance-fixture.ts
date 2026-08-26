import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { CURSOR_COMMAND_WRAPPERS } from '../cursor-wrappers.js';
import { getTemplatesDirectory } from '../utils/fs.js';
import { renderOpenCodeAgent, renderOpenCodeCommand, SAFEWORD_SUBAGENTS } from './catalogue.js';
import { installOpenCodeProfile } from './profile.js';

export const OPENCODE_EXPECTED_DISCOVERY = {
  command: 'bdd',
  subagent: 'safeword-reviewer',
  skill: 'bdd',
} as const;

function prepareCatalogueFixture(root: string): string {
  const project = nodePath.join(root, 'project');
  const config = nodePath.join(root, 'config');
  const command = CURSOR_COMMAND_WRAPPERS.find(candidate => candidate.name === 'bdd');
  const agent = SAFEWORD_SUBAGENTS.find(candidate => candidate.name === 'safeword-reviewer');
  if (command === undefined || agent === undefined) {
    throw new Error('Safeword OpenCode catalogue fixture is incomplete');
  }
  const skillPath = nodePath.join(getTemplatesDirectory(), 'skills', 'bdd', 'SKILL.md');

  mkdirSync(nodePath.join(project, '.opencode', 'commands'), { recursive: true });
  mkdirSync(nodePath.join(project, '.opencode', 'agents'), { recursive: true });
  mkdirSync(nodePath.join(project, '.claude', 'skills', 'bdd'), { recursive: true });
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(project, '.opencode', 'commands', 'bdd.md'),
    renderOpenCodeCommand(command),
  );
  writeFileSync(
    nodePath.join(project, '.opencode', 'agents', 'safeword-reviewer.md'),
    renderOpenCodeAgent(agent),
  );
  writeFileSync(
    nodePath.join(project, '.claude', 'skills', 'bdd', 'SKILL.md'),
    readFileSync(skillPath),
  );
  writeFileSync(nodePath.join(project, '.safeword', 'SAFEWORD.md'), '# Safeword\n');
  if (installOpenCodeProfile(config).state !== 'changed') {
    throw new Error('Safeword OpenCode profile fixture could not be installed');
  }
  return project;
}

function runHost(
  executable: string,
  args: readonly string[],
  cwd: string,
  environment: NodeJS.ProcessEnv,
) {
  return spawnSync(executable, args, {
    cwd,
    encoding: 'utf8',
    env: environment,
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30_000,
  });
}

export function proveOpenCodeCatalogue(
  executable: string,
  environment: NodeJS.ProcessEnv,
): boolean {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-opencode-conformance-'));
  try {
    const project = prepareCatalogueFixture(root);
    const fixtureEnvironment = {
      ...environment,
      HOME: nodePath.join(root, 'home'),
      XDG_CONFIG_HOME: nodePath.join(root, 'xdg-config'),
      XDG_DATA_HOME: nodePath.join(root, 'xdg-data'),
      XDG_CACHE_HOME: nodePath.join(root, 'xdg-cache'),
      OPENCODE_CONFIG_DIR: nodePath.join(root, 'config'),
      OPENCODE_DISABLE_AUTOUPDATE: 'true',
    };
    const config = runHost(executable, ['debug', 'config'], project, fixtureEnvironment);
    const skills = runHost(executable, ['debug', 'skill'], project, fixtureEnvironment);
    if (config.status !== 0 || skills.status !== 0) return false;
    const resolved = JSON.parse(config.stdout) as {
      command?: Record<string, unknown>;
      agent?: Record<string, unknown>;
    };
    const discoveredSkills = JSON.parse(skills.stdout) as { name?: unknown }[];
    return (
      resolved.command?.[OPENCODE_EXPECTED_DISCOVERY.command] !== undefined &&
      resolved.agent?.[OPENCODE_EXPECTED_DISCOVERY.subagent] !== undefined &&
      discoveredSkills.some(skill => skill.name === OPENCODE_EXPECTED_DISCOVERY.skill)
    );
  } catch {
    return false;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
