import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { nativeWorkflowEnvironment } from './codex-internal-workflows.js';
import { isolatedBuildIdentity } from './codex-isolated-build.js';
import { initializeWorkflowGit } from './codex-workflow-git.js';

const repo = path.resolve(import.meta.dirname, '../../../..');
const launcher = path.join(repo, 'scripts/dev');

/** New owned grade only: no native task/model dispatch, author/shared installation
 * mutation, hook grants or inherited config. Profile/state is private operational
 * data, not shareable evidence; remove copied auth before archiving receipts.
 */
export function provisionIsolatedGrade(parent: string, authProfile: string) {
  const artifacts = realpathSync(mkdtempSync(path.join(parent, 'isolated-grade-')));
  const project = path.join(artifacts, 'project');
  const profile = path.join(artifacts, 'profile');
  const installed = path.join(artifacts, 'package');
  for (const dir of [project, profile, path.join(project, '.safeword')]) mkdirSync(dir);
  cpSync(path.join(repo, 'packages/cli/codex-plugin'), installed, { recursive: true });
  writeFileSync(
    path.join(profile, 'config.toml'),
    'approval_policy = "never"\nsandbox_mode = "read-only"\n',
  );
  const binding = { project, profile, runtime: path.join(installed, 'runtime/cli.js') };
  const build = spawnSync(
    launcher,
    [
      'bun',
      path.join(repo, 'packages/cli/tests/fixtures/host-contract/build-isolated-grader.mjs'),
      repo,
      installed,
      JSON.stringify(binding),
    ],
    { cwd: repo, encoding: 'utf8', timeout: 30_000 },
  );
  // Do not record ambient env/auth; ordinary compiler output is not a model receipt.
  writeFileSync(
    path.join(artifacts, 'build.json'),
    JSON.stringify({
      status: build.status,
      error: build.error?.message,
      stdout: build.stdout,
      stderr: build.stderr,
    }),
  );
  assert.equal(build.error, undefined, 'HOST_CONTRACT_PROOF_UNAVAILABLE: grader build');
  assert.equal(build.status, 0, 'HOST_CONTRACT_PROOF_UNAVAILABLE: grader build');
  const buildIdentity = isolatedBuildIdentity(readFileSync(binding.runtime, 'utf8'), binding);
  copyFileSync(
    path.join(installed, 'resources/SAFEWORD.md'),
    path.join(project, '.safeword/SAFEWORD.md'),
  );
  writeFileSync(
    path.join(project, '.safeword/config.json'),
    JSON.stringify({
      crossAgentReview: 'prefer',
      crossAgentReviewRoutes: { codex: [{ reviewer: 'codex', model: 'gpt-6-astra' }] },
    }),
  );
  writeFileSync(path.join(project, 'package.json'), '{"private":true,"type":"module"}\n');
  initializeWorkflowGit(project, artifacts, [
    '.safeword/SAFEWORD.md',
    '.safeword/config.json',
    'package.json',
  ]);
  const originalState = process.env.XDG_STATE_HOME ?? path.join(homedir(), '.local/state');
  const state = path.join(profile, 'state');
  const selected = spawnSync(launcher, ['bun', '--print', 'process.execPath'], {
    cwd: repo,
    encoding: 'utf8',
  });
  assert.equal(selected.status, 0, 'HOST_CONTRACT_PROOF_UNAVAILABLE: pinned Bun');
  const environment: NodeJS.ProcessEnv = {
    ...nativeWorkflowEnvironment(profile),
    SAFEWORD_AGENT_RUNTIME: 'codex',
    CODEX_HOME: profile,
    XDG_STATE_HOME: state,
    SAFEWORD_REVIEW_KEY_ROOT: state,
    MISE_STATE_DIR: process.env.MISE_STATE_DIR ?? path.join(originalState, 'mise'),
    SAFEWORD_CLI_ENTRYPOINT: binding.runtime,
    SAFEWORD_REVIEW_FOREGROUND_MS: '540000',
    SAFEWORD_REVIEW_RUN_BOUND_MS: '480000',
  };
  const credential = path.join(profile, 'auth.json');
  const cleanupCredentials = () => {
    rmSync(credential, { force: true });
  };
  // Copy only after all other provisioning can succeed. Partial copy/chmod
  // failures clean only this newly created profile, never the source profile.
  try {
    copyFileSync(path.join(authProfile, 'auth.json'), credential);
    chmodSync(credential, 0o600);
  } catch (error) {
    cleanupCredentials();
    throw error;
  }
  return {
    project,
    profile,
    installed,
    artifacts,
    binding,
    buildIdentity,
    environment,
    bun: selected.stdout.trim(),
    cleanupCredentials,
  };
}
