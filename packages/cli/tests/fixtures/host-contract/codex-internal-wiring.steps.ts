import '../../../../../steps/world.js';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import nodePath from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';
import { parse } from 'yaml';

import type { SafewordWorld } from '../../../../../steps/world.js';

interface WiringWorld extends SafewordWorld {
  wiring?: { repo: string; shipped: string; missing: string };
}
const sourceRoot = nodePath.resolve(import.meta.dirname, '../../../../..');

function check(repo: string) {
  const root = nodePath.dirname(repo);
  const result = spawnSync(
    nodePath.join(sourceRoot, 'scripts/dev'),
    ['bun', '--no-env-file', 'packages/cli/scripts/generate-codex-plugin.ts', '--check'],
    {
      cwd: repo,
      env: { ...process.env, CODEX_HOME: nodePath.join(root, 'checker-profile') },
      encoding: 'utf8',
      timeout: 60_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  assert.equal(result.error, undefined, 'WIRING_SETUP_UNAVAILABLE: checker did not execute');
  assert.equal(
    result.signal ?? undefined,
    undefined,
    'WIRING_SETUP_UNAVAILABLE: checker was signalled',
  );
  return result;
}

Given(
  'a generated native Codex package is missing a canonical internal sibling reference',
  { timeout: 90_000 },
  function (this: WiringWorld) {
    const parameters = this.parameters as { wiringRepo?: string; wiringBundle?: string };
    assert.ok(
      parameters.wiringRepo && parameters.wiringBundle,
      'WIRING_SETUP_UNAVAILABLE: owned generated fixture required',
    );
    const repo = realpathSync(parameters.wiringRepo);
    const root = nodePath.dirname(repo);
    assert.ok(nodePath.basename(root).startsWith('safeword-contract-repository-'));
    assert.equal(nodePath.basename(repo), 'repository');
    const bundle = realpathSync(parameters.wiringBundle);
    assert.ok(bundle.startsWith(`${root}/`));
    const source = nodePath.join(repo, 'packages/cli/templates/skills/testing');
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/u.exec(
      readFileSync(nodePath.join(source, 'SKILL.md'), 'utf8'),
    );
    assert.ok(frontmatter);
    const settings = parse(frontmatter[1] ?? '') as Record<string, unknown>;
    assert.equal(settings['user-invocable'], false);
    assert.ok(existsSync(nodePath.join(source, 'FIRST.md')));
    const shipped = nodePath.join(repo, 'packages/cli/codex-plugin');
    rmSync(shipped, { recursive: true, force: true });
    cpSync(bundle, shipped, { recursive: true });
    const clean = check(repo);
    this.attach(
      JSON.stringify({
        label: 'clean-generated-control',
        status: clean.status,
        stdout: clean.stdout,
        stderr: clean.stderr,
      }),
      'application/json',
    );
    assert.equal(
      clean.status,
      0,
      `WIRING_SETUP_UNAVAILABLE: clean generated check failed\n${clean.stdout}\n${clean.stderr}`,
    );
    const missing = 'internal/testing/references/FIRST.md';
    const projected = existsSync(nodePath.join(shipped, 'resources/workflow-index.json'));
    if (projected) {
      assert.ok(
        existsSync(nodePath.join(shipped, missing)),
        'WIRING_SETUP_UNAVAILABLE: complete generated projection must contain the sibling before deletion',
      );
    }
    this.attach(
      JSON.stringify({
        label: 'projection-before-deletion',
        projected,
        meaning: projected
          ? 'Generated sibling exists before the missing-resource mutation'
          : 'Preimplementation RED: native internal projection is entirely absent',
      }),
      'application/json',
    );
    rmSync(nodePath.join(shipped, missing), { force: true });
    assert.equal(existsSync(nodePath.join(shipped, missing)), false);
    this.wiring = { repo, shipped, missing };
  },
);

When(
  'the required generated catalogue and resource checks run',
  { timeout: 90_000 },
  function (this: WiringWorld) {
    assert.ok(this.wiring);
    const result = check(this.wiring.repo);
    this.attach(
      JSON.stringify({
        label: 'missing-internal-resource-check',
        missing: this.wiring.missing,
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
      }),
      'application/json',
    );
    assert.ok(
      typeof result.status === 'number',
      'WIRING_SETUP_UNAVAILABLE: checker has no exit status',
    );
    this.result = { stdout: result.stdout, stderr: result.stderr, exitCode: result.status };
  },
);

Then(
  'they reject the incomplete package and identify the missing internal resource',
  function (this: WiringWorld) {
    assert.ok(this.wiring);
    assert.notEqual(
      this.result.exitCode,
      0,
      'INTERNAL_REFERENCE_PROJECTION_MISSING: checker accepts a missing canonical internal resource',
    );
    assert.ok(
      `${this.result.stdout}\n${this.result.stderr}`.includes(this.wiring.missing),
      'The generated check did not identify the missing internal resource',
    );
  },
);
