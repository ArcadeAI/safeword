import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

/** Only trusted fixture Git subprocesses receive this environment; native tasks do not. */
function gitEnvironment(): NodeJS.ProcessEnv {
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
  };
}

function gitCommands(project: string, observation: string) {
  const commands: unknown[] = [];
  const env = gitEnvironment();
  const gitEnvironmentObservation = Object.fromEntries(
    Object.entries(env).filter(([key]) => key.startsWith('GIT_')),
  );
  return (...args: string[]): string => {
    const result = spawnSync('git', args, {
      cwd: project,
      env,
      encoding: 'utf8',
      timeout: 30_000,
    });
    commands.push({
      args,
      status: result.status,
      signal: result.signal,
      stdout: result.stdout,
      stderr: result.stderr,
      error: result.error?.message,
    });
    writeFileSync(
      observation,
      `${JSON.stringify({ project, environmentScope: 'fixture Git subprocess only', gitEnvironment: gitEnvironmentObservation, commands }, undefined, 2)}\n`,
    );
    assert.equal(result.error, undefined, 'HOST_CONTRACT_PROOF_UNAVAILABLE: fixture Git process');
    assert.equal(
      result.status,
      0,
      `HOST_CONTRACT_PROOF_UNAVAILABLE: fixture Git ${args[0]}: ${result.stderr}`,
    );
    return result.stdout.trim();
  };
}

/** A dirty tree is allowed; only the handbook's root/branch/commit precondition is checked. */
export function workflowGitReadiness(project: string, observation: string): void {
  const git = gitCommands(project, observation);
  git('--version');
  assert.equal(
    realpathSync(git('rev-parse', '--show-toplevel')),
    realpathSync(project),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: fixture Git root',
  );
  assert.equal(
    git('branch', '--show-current'),
    'codex/fixture',
    'HOST_CONTRACT_PROOF_UNAVAILABLE: fixture Git branch',
  );
  git('rev-parse', '--verify', 'HEAD^{commit}');
}

/** Called only for the producer-owned, newly seeded project, before native dispatch. */
export function initializeWorkflowGit(
  project: string,
  artifacts: string,
  tracked = ['.safeword/SAFEWORD.md', '.safeword/config.json', 'package.json', 'clamp.js'],
): void {
  assert.equal(
    lstatSync(nodePath.join(project, '.git'), { throwIfNoEntry: false }),
    undefined,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: fixture already has Git state',
  );
  const template = nodePath.join(artifacts, 'empty-git-template');
  mkdirSync(template);
  const git = gitCommands(project, nodePath.join(artifacts, 'project-git-initialization.json'));
  git('init', '--quiet', '--initial-branch=codex/fixture', `--template=${template}`);
  git('add', '--', ...tracked);
  git(
    '-c',
    'user.name=Native fixture',
    '-c',
    'user.email=fixture@example.test',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '--quiet',
    '-m',
    'Seed owned native workflow project',
  );
  workflowGitReadiness(project, nodePath.join(artifacts, 'project-git-prepared.json'));
}
