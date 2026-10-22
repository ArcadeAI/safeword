import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import nodePath from 'node:path';
import { promisify } from 'node:util';

import { generateOpenCodeCatalogueAssets } from '../../src/opencode/catalogue.js';
import type { OpenCodeIdentityV1 } from '../../src/opencode/identity.js';
import { openCodeProfilePaths, reconcileOpenCodeProfile } from '../../src/opencode/profile.js';
import { VERSION } from '../../src/version.js';
import { createNativeCatalogueProbe } from './native-catalogue-probe.js';
import { type ModelMessage, openCodeScriptedModelFixture } from './opencode-native-driver.js';
import { type OpenCodeNativeFixture, OpenCodeNativeWriteActor } from './opencode-native-write.js';
import { prepareVersionedCatalogueRuntime } from './versioned-catalogue-runtime.js';

const execute = promisify(execFile);

function installCanonicalCatalogue(profile: string, canonical: string): void {
  const paths = openCodeProfilePaths(profile);
  const identity = JSON.parse(readFileSync(paths.identity, 'utf8')) as OpenCodeIdentityV1;
  const assets = generateOpenCodeCatalogueAssets(canonical);
  const result = reconcileOpenCodeProfile({
    operation: 'install',
    root: profile,
    pluginBytes: readFileSync(paths.plugin),
    dispatcherBytes: readFileSync(paths.dispatcher),
    identity: {
      ...identity,
      assets: assets.map(asset => ({
        path: asset.relativePath,
        sha256: createHash('sha256').update(asset.content).digest('hex'),
      })),
    },
    catalogueAssets: assets,
  });
  assert.ok(result.state === 'changed' || result.state === 'healthy');
}

function commandsFromV1Skill(content: string, profile: string) {
  const base = /^Base directory for this skill: (.+)$/mu.exec(content)?.[1];
  assert.equal(base, nodePath.join(profile, 'skills/safeword-explain'));
  assert.ok(base);
  const guide = /\[the packaged guide\]\(([^)]+)\)/u.exec(content)?.[1];
  const helper = /```bash\n([\s\S]*?)```/u.exec(content)?.[1];
  assert.ok(guide && helper);
  assert.ok(
    helper.includes(`bunx --bun safeword@${VERSION} project runtime audit-principle-trace`),
  );
  assert.equal(helper.includes('.safeword/hooks/'), false);
  return { guide: nodePath.resolve(base, guide), helper };
}

/** Retained V1 uses its actual profile catalogue and unchanged versioned CLI binding. */
export async function proveOpenCodeV1Catalogue(
  fixture: OpenCodeNativeFixture,
  runtime: 'CLI' | 'TUI',
) {
  const source = mkdtempSync(nodePath.join(fixture.runsDirectory, 'opencode-v1-catalogue-'));
  const probe = await createNativeCatalogueProbe(source);
  const actor = new OpenCodeNativeWriteActor(fixture);
  await actor.prepare('OpenCode V1', '1.18.23', runtime);
  let project = '';
  let installedRoot = '';
  let directory = '';
  let results: ModelMessage[] = [];
  let bindingFailure = '';
  await actor.runModelFixture(async paths => {
    ({ project, directory } = paths);
    installCanonicalCatalogue(paths.profile, nodePath.join(source, 'canonical'));
    // Only fixture fallbacks are removed. The native profile remains the delivery under test.
    for (const relative of [
      '.safeword/skills',
      '.safeword/guides',
      '.safeword/hooks',
      '.opencode/skills',
      '.agents/skills',
    ])
      rmSync(nodePath.join(project, relative), { recursive: true, force: true });
    mkdirSync(nodePath.join(project, '.host-contract'));
    const installed = await prepareVersionedCatalogueRuntime(
      probe.packageRoot,
      directory,
      paths.environment,
    );
    installedRoot = installed.packageRoot;
    const ready = await execute(
      'bun',
      [
        'x',
        '--bun',
        `safeword@${VERSION}`,
        'project',
        'runtime',
        'audit-principle-trace',
        '--cwd',
        project,
        '--',
        project,
      ],
      {
        cwd: project,
        env: installed.environment,
        timeout: 120_000,
      },
    );
    assert.ok(
      ready.stdout.includes(probe.helperMarker),
      'HOST_CONTRACT_PROOF_UNAVAILABLE: candidate helper prerequisite failed',
    );
    const artifact = nodePath.join(project, '.host-contract/native-helper.json');
    assert.ok(existsSync(artifact));
    rmSync(artifact);
    const model = await openCodeScriptedModelFixture(directory, request => {
      results = request.messages?.filter(message => message.role === 'tool') ?? [];
      if (results.length === 0)
        return { tool: { name: 'skill', input: { name: 'safeword-explain' } } };
      const content = results[0]?.content;
      if (typeof content !== 'string' || !content.includes(probe.workflowMarker)) return {};
      try {
        const commands = commandsFromV1Skill(content, paths.profile);
        if (results.length === 1)
          return { tool: { name: 'read', input: { filePath: commands.guide } } };
        if (results.length === 2)
          return {
            tool: {
              name: 'bash',
              input: {
                command: commands.helper,
                description: 'Invoke the declared workflow helper',
              },
            },
          };
        return {};
      } catch (error) {
        bindingFailure = String(error);
        return {};
      }
    });
    return { ...model, environment: installed.environment };
  });
  const visible = JSON.stringify(results);
  assert.ok(visible.includes(probe.workflowMarker), 'NATIVE_OPENCODE_V1_CATALOGUE_MISSING');
  assert.equal(bindingFailure, '', 'NATIVE_HELPER_ORIGIN_MISMATCH');
  assert.ok(
    String(results[1]?.content).includes(probe.guideMarker),
    'NATIVE_HELPER_ORIGIN_MISMATCH: guide not read',
  );
  assert.ok(
    String(results[2]?.content).includes(probe.helperMarker),
    'NATIVE_HELPER_ORIGIN_MISMATCH: helper did not execute',
  );
  const artifact = JSON.parse(
    readFileSync(nodePath.join(project, '.host-contract/native-helper.json'), 'utf8'),
  ) as { marker: string; origin: string; runtime: string };
  assert.equal(artifact.marker, probe.helperMarker);
  assert.equal(
    artifact.origin,
    nodePath.join(installedRoot, 'templates/hooks/audit-principle-trace.ts'),
  );
  assert.equal(artifact.runtime, nodePath.join(installedRoot, 'runtime/cli.js'));
  console.log(`OpenCode V1 ${runtime} canonical guide/helper passed: ${directory}`);
}
