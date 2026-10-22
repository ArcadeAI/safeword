import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { applyEdits, modify, parse } from 'jsonc-parser';

import { installOpenCodeProfile } from '../../src/opencode/profile.js';
import { assertMatchingTree } from './codex-plugin-package.js';
import { openCodeModelFixture, runOpenCodeTurn } from './opencode-native-driver.js';
import { type OpenCodeNativeFixture, OpenCodeNativeWriteActor } from './opencode-native-write.js';

interface NativeSelection {
  nativeV2: { projectDirectory: string; packageDirectory: string; epoch: string };
}

/** Real profile controller, actual V1/V2 hosts and independent side effects. */
export async function proveOpenCodeCoexistence(
  fixture: OpenCodeNativeFixture,
  runtime: 'CLI' | 'TUI',
): Promise<void> {
  const actor = new OpenCodeNativeWriteActor(fixture);
  await actor.prepare('OpenCode V2', '2.0.32', runtime);
  let observed!: {
    directory: string;
    project: string;
    candidate: string;
    profile: string;
    environment: NodeJS.ProcessEnv;
  };
  let firstResults = '';
  let profileBefore = '';
  let pluginBefore = Buffer.alloc(0);
  let lastModelUrl = '';
  const relative = '.project/tickets/coexistence/ticket.md';
  await actor.runModelFixture(async paths => {
    observed = paths;
    const target = nodePath.join(paths.project, relative);
    mkdirSync(nodePath.dirname(target), { recursive: true });
    const model = await openCodeModelFixture(`printf enrolled > ${relative}`, paths.directory);
    return {
      ...model,
      beforeTurn() {
        const configFile = nodePath.join(paths.project, 'opencode.json');
        const config = JSON.parse(readFileSync(configFile, 'utf8')) as Record<string, unknown>;
        const marker = nodePath.join(paths.directory, 'v1-hook-marker');
        const userPlugin = nodePath.join(paths.directory, 'v1-user-plugin.mjs');
        writeFileSync(
          userPlugin,
          `import { appendFileSync } from 'node:fs';\nexport const Marker = async () => { appendFileSync(${JSON.stringify(marker)}, 'V1\\n'); return {}; };\n`,
        );
        config.plugin = [userPlugin];
        config.plugins = [
          nodePath.join(paths.directory, 'observer'),
          { package: paths.candidate, options: { profileDirectory: paths.profile } },
        ];
        const file = nodePath.join(paths.profile, 'opencode.jsonc');
        writeFileSync(
          file,
          `// Preserve this user's configuration.\n${JSON.stringify(config, undefined, 2)}\n`,
        );
        rmSync(configFile);
        profileBefore = readFileSync(file, 'utf8');
        pluginBefore = readFileSync(nodePath.join(paths.profile, 'plugins/safeword.js'));
        for (const catalogue of ['skills', 'commands', 'agents']) {
          const original = nodePath.join(paths.profile, catalogue);
          if (existsSync(original))
            cpSync(original, nodePath.join(paths.directory, `before-${catalogue}`), {
              recursive: true,
            });
        }
        // The pre-change controller ignores the new optional selected-lane request.
        // It still performs its real V1 ownership checks; no test-owned enrollment writer.
        const install: (
          root: string,
          selection?: NativeSelection,
        ) => ReturnType<typeof installOpenCodeProfile> = installOpenCodeProfile;
        const result = install(paths.profile, {
          nativeV2: {
            projectDirectory: paths.project,
            packageDirectory: paths.candidate,
            epoch: 'coexistence-epoch',
          },
        });
        assert.equal(result.ok, true, 'HOST_CONTRACT_PROOF_UNAVAILABLE: profile controller failed');
      },
      close() {
        assert.equal(
          model.attempts,
          1,
          'HOST_CONTRACT_PROOF_UNAVAILABLE: missing enrolled native attempt',
        );
        assert.ok(
          model.results.length > 0,
          'HOST_CONTRACT_PROOF_UNAVAILABLE: missing enrolled native result',
        );
        firstResults = JSON.stringify(model.results);
        model.close();
      },
    };
  });
  const { directory, project, profile, environment } = observed;
  const second = nodePath.join(directory, 'second-project');
  cpSync(project, second, { recursive: true });
  rmSync(nodePath.join(second, relative), { force: true });
  const outcomes: { version: string; project: string; written: boolean; results: string }[] = [
    {
      version: '2.0.32',
      project,
      written: existsSync(nodePath.join(project, relative)),
      results: firstResults,
    },
  ];
  let v1Loads = 0;
  // A profile-wide package declaration must not enroll the second checkout.
  for (const [version, location] of [
    ['2.0.32', second],
    ['1.18.23', project],
    ['1.18.23', second],
  ] as const) {
    const run = nodePath.join(directory, `coexist-${version}-${nodePath.basename(location)}`);
    mkdirSync(run);
    rmSync(nodePath.join(location, relative), { force: true });
    const model = await openCodeModelFixture(`printf attempted > ${relative}`, run);
    lastModelUrl = model.url;
    try {
      const file = nodePath.join(profile, 'opencode.jsonc');
      const content = readFileSync(file, 'utf8');
      const edits = modify(content, ['provider', 'fixture', 'options', 'baseURL'], model.url, {});
      writeFileSync(file, applyEdits(content, edits));
      await runOpenCodeTurn({
        binary: version === '2.0.32' ? fixture.v2Binary : fixture.v1Binary,
        version,
        runtime,
        project: location,
        environment: {
          ...environment,
          PWD: location,
          INIT_CWD: location,
          // Share configuration, not incompatible host-owned database schemas.
          XDG_DATA_HOME:
            version === '1.18.23' ? nodePath.join(directory, 'v1-data') : environment.XDG_DATA_HOME,
        },
        finish: model.finish,
        directory: run,
      });
      assert.equal(
        model.attempts,
        1,
        'HOST_CONTRACT_PROOF_UNAVAILABLE: missing native tool attempt',
      );
      assert.ok(
        model.results.length > 0,
        'HOST_CONTRACT_PROOF_UNAVAILABLE: missing native tool result',
      );
      outcomes.push({
        version,
        project: location,
        written: existsSync(nodePath.join(location, relative)),
        results: JSON.stringify(model.results),
      });
      if (version === '2.0.32')
        assert.equal(
          existsSync(nodePath.join(directory, 'v1-hook-marker')),
          false,
          'V1_PLUGIN_EXECUTED_IN_V2',
        );
      else {
        v1Loads++;
        const marker = readFileSync(nodePath.join(directory, 'v1-hook-marker'), 'utf8');
        assert.equal(marker.trim().split('\n').length, v1Loads);
      }
    } finally {
      model.close();
    }
  }
  const after = readFileSync(nodePath.join(profile, 'opencode.jsonc'), 'utf8');
  assert.ok(after.includes('// Preserve this user'));
  const expectedEdits = modify(
    profileBefore,
    ['provider', 'fixture', 'options', 'baseURL'],
    lastModelUrl,
    {},
  );
  assert.deepEqual(parse(after), parse(applyEdits(profileBefore, expectedEdits)));
  assert.equal(
    readFileSync(nodePath.join(profile, 'plugins/safeword.js')).equals(pluginBefore),
    true,
  );
  assert.ok(readFileSync(nodePath.join(directory, 'v1-hook-marker'), 'utf8').includes('V1'));
  for (const catalogue of ['skills', 'commands', 'agents']) {
    const original = nodePath.join(directory, `before-${catalogue}`);
    if (existsSync(original)) assertMatchingTree(original, nodePath.join(profile, catalogue));
  }
  assert.ok(fixture.v2CandidatePackage);
  assertMatchingTree(fixture.v2CandidatePackage, observed.candidate);
  const native = readFileSync(nodePath.join(directory, 'native-observations.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(
      line =>
        JSON.parse(line) as {
          tool?: string;
          input?: { command?: string };
          session_id?: string;
          plugins?: { source: { type: string; path?: string }; state: { status: string } }[];
        },
    );
  const attempts = native.filter(row => row.tool === 'shell');
  assert.equal(attempts.length, 2, 'HOST_CONTRACT_PROOF_UNAVAILABLE: missing native V2 dispatches');
  assert.ok(
    attempts.every(row =>
      row.plugins?.some(
        plugin =>
          plugin.source.type === 'local' &&
          plugin.source.path?.startsWith(observed.candidate) &&
          plugin.state.status === 'active',
      ),
    ),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: candidate not active in native host',
  );
  const enrolled = attempts.filter(row => row.input?.command === `printf enrolled > ${relative}`);
  const foreign = attempts.filter(row => row.input?.command === `printf attempted > ${relative}`);
  assert.equal(enrolled.length, 1);
  assert.equal(foreign.length, 1);
  writeFileSync(
    nodePath.join(directory, 'coexistence-outcomes.json'),
    JSON.stringify(outcomes, undefined, 2),
  );
  assert.equal(outcomes[1]?.written, true, 'V2_FOREIGN_PROJECT_ENROLLED');
  for (const outcome of outcomes.slice(2)) {
    assert.equal(outcome.written, false, 'V1_GUARD_LOST_DURING_V2_ENROLLMENT');
    assert.match(outcome.results, /Safeword denied|Shell commands can't change/u);
  }
  assert.ok(outcomes[0]);
  assert.equal(outcomes[0].written, false, 'V2_ENROLLED_GUARD_MISSING');
  assert.match(firstResults, /Safeword denied|Shell commands can't change/u);
  const dispatches = readFileSync(nodePath.join(directory, 'runtime-observations.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(
      line =>
        JSON.parse(line) as {
          status: number;
          input: {
            cwd: string;
            session_id: string;
            tool_name: string;
            tool_input: { command: string };
          };
        },
    );
  assert.equal(dispatches.length, 1, 'V2_FOREIGN_PROJECT_DISPATCHED');
  const dispatch = dispatches[0];
  assert.ok(dispatch);
  assert.equal(dispatch.status, 2);
  assert.equal(dispatch.input.cwd, project);
  assert.equal(dispatch.input.session_id, enrolled[0]?.session_id);
  assert.equal(dispatch.input.tool_name, 'Bash');
  assert.equal(dispatch.input.tool_input.command, `printf enrolled > ${relative}`);
  console.log(`OpenCode ${runtime} profile coexistence passed: ${directory}`);
}
