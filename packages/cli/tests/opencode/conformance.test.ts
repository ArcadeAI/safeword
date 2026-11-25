import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  type ConformanceStore,
  publishConformanceAttempt,
  readConformanceAttempts,
} from '../../src/host-contract/conformance-run.js';
import {
  type OpenCodeConformanceOptions,
  runOpenCodeConformance,
} from '../../src/opencode/conformance.js';
import { installOpenCodeProfile, observeOpenCodeProfile } from '../../src/opencode/profile.js';
import {
  CONFORMANCE_RUN_LAYOUT as runs,
  OPENCODE_V2_PLUGIN_LAYOUT as layout,
} from '../../src/schema.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';
import {
  installNativeHookComponent,
  nativeToolEvent,
  setNativeParentComponent,
} from '../helpers/opencode-native-hook-component.js';

function prepareGuardSkillFixture(candidate: string, variant: string): boolean {
  const loadsExplain = variant === 'active-explain' || variant === 'foreign-explain';
  let dispatcher = `import ${JSON.stringify(nodePath.resolve('src/opencode/dispatcher.ts'))};`;
  if (variant === 'allow-denied-status')
    dispatcher = 'process.stdin.resume();process.stdin.on("end",()=>process.exit(0));';
  else if (variant === 'always-deny-status')
    dispatcher = 'process.stdin.resume();process.stdin.on("end",()=>process.exit(2));';
  writeFileSync(nodePath.join(candidate, layout.dispatcher), dispatcher);
  mkdirSync(nodePath.join(candidate, 'skills/cleanup-zombies'), { recursive: true });
  writeFileSync(nodePath.join(candidate, 'skills/cleanup-zombies/SKILL.md'), '# Cleanup control');
  if (loadsExplain) {
    mkdirSync(nodePath.join(candidate, 'skills/explain'), { recursive: true });
    writeFileSync(nodePath.join(candidate, 'skills/explain/SKILL.md'), '# Explain control');
  }
  writeFileSync(
    nodePath.join(candidate, layout.catalogue),
    JSON.stringify([
      {
        name: 'explain',
        description: loadsExplain ? 'Explain control' : 42,
        relativePath: 'explain/SKILL.md',
        bodyOffset: 0,
      },
      {
        name: 'cleanup-zombies',
        description: 'Control',
        relativePath: 'cleanup-zombies/SKILL.md',
        bodyOffset: 0,
      },
    ]),
  );
  return loadsExplain;
}

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories) removeTemporaryDirectory(directory);
  directories.length = 0;
});

/** Only the outer host executable is substituted; enrollment/controller/status are real. */
function registrationStatusFixture(version = '2.4.1', native = false) {
  const root = createTemporaryDirectory();
  directories.push(root);
  const project = nodePath.join(root, 'project');
  const profile = nodePath.join(root, 'profile');
  const candidate = nodePath.join(root, 'candidate');
  const bin = nodePath.join(root, 'bin');
  for (const directory of [project, profile, candidate, bin])
    mkdirSync(directory, { recursive: true });
  mkdirSync(nodePath.join(project, '.safeword'));
  writeFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'), '# Synthetic project\n');
  for (const [path, content] of [
    [layout.entry, 'export default {};\n'],
    [layout.runtime, '// Synthetic payload, never a proof writer.\n'],
    [layout.dispatcher, '// Synthetic dispatcher, never executed.\n'],
    [layout.catalogue, JSON.stringify([{ name: 'explain', description: 'Optional skill' }])],
    [layout.manifest, JSON.stringify({ name: 'safeword-opencode-v2', type: 'module' })],
  ] as const) {
    mkdirSync(nodePath.dirname(nodePath.join(candidate, path)), { recursive: true });
    writeFileSync(nodePath.join(candidate, path), content);
  }
  if (native) installNativeHookComponent(root, candidate);
  const executable = nodePath.join(bin, 'opencode');
  // A completed process without native observations must never mint conformance.
  writeFileSync(
    executable,
    `#!/bin/sh\nif [ "$1" = "--version" ]; then printf "opencode v${version}\\n"; else printf "native attempt\\n" >> "$OPENCODE_FIXTURE_LAUNCH_LOG"; fi\nexit 0\n`,
  );
  chmodSync(executable, 0o755);
  expect(
    installOpenCodeProfile(profile, {
      nativeV2: { projectDirectory: project, packageDirectory: candidate, epoch: 'fixture' },
    }).state,
  ).toBe('changed');
  return {
    root,
    executable,
    project,
    profile,
    candidate,
    launchLog: nodePath.join(root, 'outer-process-launch.log'),
    environment: {
      OPENCODE_CONFIG_DIR: profile,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      OPENCODE_FIXTURE_LAUNCH_LOG: nodePath.join(root, 'outer-process-launch.log'),
    },
  };
}

function latestControllerAttempt(store: ConformanceStore) {
  const record = readConformanceAttempts(store)?.at(-1);
  if (!record) throw new Error('Missing latest controller attempt');
  return record;
}

describe('OpenCode V2 registration/status controller', () => {
  it('recognizes the current host before checking project enrollment', async () => {
    const fixture = registrationStatusFixture('2.4.1');
    const project = createTemporaryDirectory();
    directories.push(project);
    const observed = observeOpenCodeProfile(fixture.profile, {
      projectDirectory: project,
      opencodeVersion: '2.4.1',
    });
    expect(
      observed.findings.map(row => row.code),
      'CURRENT_OPENCODE_HOST_REJECTED',
    ).toContain('OPENCODE_V2_ENROLLMENT_REQUIRED');
    const conformance = await runOpenCodeConformance(fixture.environment, {
      projectDirectory: project,
      runtime: 'CLI',
    });
    expect(
      conformance.findings.map(row => row.code),
      'CURRENT_OPENCODE_HOST_REJECTED',
    ).toContain('OPENCODE_V2_ENROLLMENT_REQUIRED');
    expect(existsSync(fixture.launchLog)).toBe(false);
  });

  it('rejects an unselected host even when project/runtime and a V2 enrollment are present', async () => {
    const fixture = registrationStatusFixture('unlisted');
    for (const options of [{}, { projectDirectory: fixture.project, runtime: 'TUI' as const }]) {
      const result = await runOpenCodeConformance(fixture.environment, options);
      expect(result).toMatchObject({
        state: 'action_required',
        findings: [{ code: 'OPENCODE_VERSION_UNSUPPORTED' }],
      });
    }
    expect(existsSync(fixture.launchLog)).toBe(false);
  });

  it('does not recommend a V1 install to repair missing V2 enrollment', async () => {
    const fixture = registrationStatusFixture();
    const otherProject = createTemporaryDirectory();
    directories.push(otherProject);
    const result = await runOpenCodeConformance(fixture.environment, {
      projectDirectory: otherProject,
      runtime: 'CLI',
    });

    expect(result).toMatchObject({
      state: 'action_required',
      findings: [{ code: 'OPENCODE_V2_ENROLLMENT_REQUIRED' }],
      data: { lane: 2, conformant: false },
      nextActions: [{ kind: 'human', mutates: false, requiresHuman: true }],
    });
    expect(result.nextActions).not.toContainEqual(
      expect.objectContaining({ command: 'safeword install --agents=opencode' }),
    );
    expect(existsSync(fixture.launchLog)).toBe(false);
  });

  it.each([
    ['CLI', 0],
    ['TUI', 0],
    ['CLI', 9],
    ['TUI', 9],
  ] as const)(
    'isolates %s capture and keeps exit %s without native observations unproved',
    async (runtime, exitCode) => {
      const fixture = registrationStatusFixture();
      writeFileSync(nodePath.join(fixture.project, 'customer-private.txt'), 'CALLER_CONTENT');
      writeFileSync(
        fixture.executable,
        String.raw`#!${process.execPath}
const fs = require('node:fs');
if (process.argv.includes('--version')) { console.log('opencode v2.4.1'); process.exit(0); }
fs.appendFileSync(${JSON.stringify(fixture.launchLog)}, JSON.stringify({
  cwd: fs.realpathSync('.'), argv: process.argv.slice(2), environment: process.env,
  terminal: !!process.stdout.isTTY,
  files: fs.readdirSync('.'),
  config: JSON.parse(fs.readFileSync('opencode.json', 'utf8')),
}) + '\n');
// Behave like a terminal UI that exits normally on the controller's completion interrupt.
process.on('SIGINT', () => process.exit(${exitCode}));
// Exit success and a claimed pass cannot substitute for native observations.
console.log(JSON.stringify({conformant:true,result:'passed'}));
console.log('SAFEWORD_NATIVE_TURN_COMPLETE');
process.exit(${exitCode});
`,
      );
      const options: OpenCodeConformanceOptions = { projectDirectory: fixture.project, runtime };
      const result = await runOpenCodeConformance(
        {
          ...fixture.environment,
          HOME: fixture.project,
          OPENAI_API_KEY: 'CALLER_SECRET',
          AWS_SECRET_ACCESS_KEY: 'CALLER_SECRET',
          SAFEWORD_CONFORMANCE_KEY: 'PARENT_KEY',
          CUSTOMER_DATA: 'CALLER_CONTENT',
          OPENCODE_CONFIG_CONTENT: '{"provider":"customer"}',
          NODE_OPTIONS: '--trace-warnings',
        },
        options,
      );
      expect(result.findings).toContainEqual(
        expect.objectContaining({ code: 'OPENCODE_V2_OBSERVATIONS_REQUIRED' }),
      );
      expect(existsSync(fixture.launchLog), 'ISOLATED_NATIVE_CAPTURE_MISSING').toBe(true);
      const launches = readFileSync(fixture.launchLog, 'utf8')
        .trim()
        .split('\n')
        .map(
          line =>
            JSON.parse(line) as {
              cwd: string;
              argv: string[];
              environment: Record<string, string>;
              terminal: boolean;
              files: string[];
              config: {
                enabled_providers: string[];
                provider: Record<
                  string,
                  {
                    options: { apiKey: string; baseURL: string };
                  }
                >;
              };
            },
        );
      expect(launches).toHaveLength(1);
      const launch = launches[0];
      if (!launch) throw new Error('Missing launch observation');
      expect(launch.cwd).not.toBe(realpathSync(fixture.project));
      expect(launch.cwd).not.toContain(fixture.root);
      expect(launch.files).not.toContain('customer-private.txt');
      expect(launch.files).toContain('.safeword');
      expect(JSON.stringify(launch)).not.toMatch(/CALLER_SECRET|CALLER_CONTENT|PARENT_KEY/);
      expect(launch.environment).not.toHaveProperty('NODE_OPTIONS');
      expect(launch.environment).not.toHaveProperty('OPENCODE_CONFIG_CONTENT');
      const ownedRoot = nodePath.dirname(launch.cwd);
      for (const name of [
        'HOME',
        'XDG_CONFIG_HOME',
        'XDG_DATA_HOME',
        'XDG_CACHE_HOME',
        'XDG_STATE_HOME',
        'OPENCODE_CONFIG_DIR',
      ]) {
        expect(launch.environment[name]?.startsWith(`${ownedRoot}/`)).toBe(true);
        expect(launch.environment[name]).not.toBe(fixture.profile);
      }
      expect(launch.config.enabled_providers).toEqual(['test']);
      expect(Object.keys(launch.config.provider)).toEqual(['test']);
      expect(launch.config.provider.test?.options).toMatchObject({
        apiKey: 'test-key',
        baseURL: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/v1$/),
      });
      expect(launch.argv).toContain('--standalone');
      expect(launch.argv).toContain('--auto');
      expect(launch.terminal).toBe(runtime === 'TUI');
      if (runtime === 'CLI') expect(launch.argv[0]).toBe('run');
      else {
        expect(launch.argv).not.toContain('run');
        expect(launch.argv).toContain('--prompt');
      }
      expect(result).toMatchObject({
        state: 'action_required',
        findings: [{ code: 'OPENCODE_V2_OBSERVATIONS_REQUIRED' }],
        data: {
          lane: 2,
          runtime,
          conformant: false,
          capture: {
            outcome: 'unavailable',
            exit_code: exitCode,
            reason: exitCode === 0 ? 'missing-native-observations' : 'host-exit',
          },
        },
      });
      const status = observeOpenCodeProfile(fixture.profile, {
        projectDirectory: fixture.project,
        opencodeVersion: '2.4.1',
      });
      expect(status.data, 'V2_CONTROLLER_STATUS_BINDING_MISSING').toMatchObject({
        lane: 2,
        runtime_lanes: {
          [runtime]: {
            activated: false,
            conformant: false,
            guarantees: [{ id: 'reject_action', state: 'unproved' }],
          },
        },
      });
      expect(status.state).toBe('action_required');
      expect(existsSync(nodePath.join(fixture.profile, 'safeword/conformance-v1'))).toBe(false);
      const profileFiles = readdirSync(fixture.profile, { recursive: true, encoding: 'utf8' });
      for (const file of profileFiles) {
        if (!file.endsWith('.json')) continue;
        const record = JSON.parse(readFileSync(nodePath.join(fixture.profile, file), 'utf8'));
        expect(record).not.toMatchObject({ result: 'passed' });
        expect(record).not.toMatchObject({ outcome: 'passed' });
        expect(record).not.toMatchObject({ conformant: true });
      }
      expect(existsSync(ownedRoot), 'Owned capture fixture is removed after use').toBe(false);
    },
  );
  it.each(['CLI', 'TUI'] as const)(
    'completes %s V2 auxiliary/model exchanges without claiming proof',
    async runtime => {
      const fixture = registrationStatusFixture();
      writeFileSync(
        fixture.executable,
        `#!${process.execPath}
const fs = require('node:fs');
if (process.argv.includes('--version')) { console.log('opencode v2.4.1'); process.exit(0); }
process.on('SIGINT', () => process.exit(0));
(async () => {
  const config = JSON.parse(fs.readFileSync('opencode.json', 'utf8'));
  const url = config.provider.test.options.baseURL + '/chat/completions';
  const replies = [];
  for (const body of [
    {stream:false,messages:[{role:'user',content:'Generate a title for this conversation'}]},
    {stream:true,tools:[],messages:[{role:'user',content:'Auxiliary title'}]},
    {stream:true,tools:[{function:{name:'shell'}}],messages:[{role:'user',content:'Control'}]},
    {stream:true,tools:[{function:{name:'shell'}}],messages:[{role:'tool',content:'control observed'}]},
  ]) {
    const response = await fetch(url, {method:'POST',body:JSON.stringify(body)});
    replies.push({type:response.headers.get('content-type'), body:await response.text()});
  }
  fs.writeFileSync(${JSON.stringify(fixture.launchLog)},JSON.stringify(replies));
  console.log(replies[3].body);
  if (process.stdout.isTTY) setInterval(() => {},1000);
})().catch(error => { console.error(error); process.exitCode = 1; });
`,
      );
      const result = await runOpenCodeConformance(fixture.environment, {
        projectDirectory: fixture.project,
        runtime,
      });
      expect(result).toMatchObject({
        state: 'action_required',
        data: { conformant: false, capture: { outcome: 'unavailable', exit_code: 0 } },
      });
      const replies = JSON.parse(readFileSync(fixture.launchLog, 'utf8')) as {
        type: string;
        body: string;
      }[];
      expect(replies).toHaveLength(4);
      expect(replies[0]?.type, 'V2_AUXILIARY_JSON_MISSING').toBe('application/json');
      expect(JSON.parse(replies[0]?.body ?? '')).toMatchObject({
        choices: [{ message: { content: 'Fixture title' }, finish_reason: 'stop' }],
      });
      expect(replies[1]?.body).toContain('Fixture title');
      expect(replies[1]?.body).not.toContain('tool_calls');
      expect(replies[2]?.body).toContain('tool_calls');
      expect(replies[2]?.body).toContain('shell');
      expect(replies[3]?.body, 'V2_COMPLETION_MARKER_MISSING').toContain(
        'SAFEWORD_NATIVE_TURN_COMPLETE',
      );
      expect(replies[3]?.body).not.toContain('tool_calls');
    },
  );

  it('cleans the owned PTY session when its Python driver dies first', async () => {
    const fixture = registrationStatusFixture();
    writeFileSync(
      fixture.executable,
      `#!${process.execPath}
const fs = require('node:fs');
if (process.argv.includes('--version')) { console.log('opencode v2.4.1'); process.exit(0); }
if (!process.stdout.isTTY) process.exit(9);
process.on('SIGHUP', () => {});
fs.writeFileSync(${JSON.stringify(fixture.launchLog)},JSON.stringify({pid:process.pid,parent:process.ppid}));
process.kill(process.ppid,'SIGKILL');
setInterval(() => {},1000);
`,
    );
    const result = await runOpenCodeConformance(fixture.environment, {
      projectDirectory: fixture.project,
      runtime: 'TUI',
    });
    const { pid } = JSON.parse(readFileSync(fixture.launchLog, 'utf8')) as { pid: number };
    const alive = () => {
      try {
        process.kill(pid, 0);
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
        throw error;
      }
    };
    try {
      expect(result).toMatchObject({
        state: 'action_required',
        data: { conformant: false, capture: { outcome: 'unavailable' } },
      });
      await expect
        .poll(alive, { timeout: 2000, message: 'OWNED_PTY_SESSION_SURVIVED_DRIVER' })
        .toBe(false);
    } finally {
      if (alive()) process.kill(pid, 'SIGKILL');
    }
  });
  it('rejects copied package links outside the selected payload before launching', async () => {
    const fixture = registrationStatusFixture();
    const privateFile = nodePath.join(fixture.project, 'customer-private.txt');
    writeFileSync(privateFile, 'CALLER_CONTENT');
    symlinkSync(privateFile, nodePath.join(fixture.candidate, 'outside.txt'));
    const result = await runOpenCodeConformance(fixture.environment, {
      projectDirectory: fixture.project,
      runtime: 'CLI',
    });
    expect(result).toMatchObject({
      state: 'action_required',
      data: {
        conformant: false,
        capture: {
          outcome: 'unavailable',
          reason: 'capture-error',
          error: expect.stringContaining('outside the selected payload'),
        },
      },
    });
    expect(existsSync(fixture.launchLog), 'ESCAPING_PACKAGE_LAUNCHED').toBe(false);
  });

  it('bounds public diagnostics while preserving complete stream digests', async () => {
    const fixture = registrationStatusFixture();
    writeFileSync(
      fixture.executable,
      `#!${process.execPath}
if (process.argv.includes('--version')) { console.log('opencode v2.4.1'); process.exit(0); }
process.stdout.write('x'.repeat(128 * 1024));
`,
    );
    const result = await runOpenCodeConformance(fixture.environment, {
      projectDirectory: fixture.project,
      runtime: 'CLI',
    });
    expect(JSON.stringify(result).length, 'PUBLIC_CAPTURE_OUTPUT_UNBOUNDED').toBeLessThan(20_000);
    expect(result).toMatchObject({
      state: 'action_required',
      data: {
        conformant: false,
        capture: {
          outcome: 'unavailable',
          stdout: {
            bytes: 128 * 1024,
            sha256: createHash('sha256')
              .update('x'.repeat(128 * 1024))
              .digest('hex'),
            tail: 'x'.repeat(4096),
          },
        },
      },
    });
  });
  it.each(['original', 'copy'] as const)(
    'rejects %s payload changes during capture even when entry and runtime stay unchanged',
    async destination => {
      const fixture = registrationStatusFixture();
      writeFileSync(
        fixture.executable,
        `#!${process.execPath}
const fs = require('node:fs');
if (process.argv.includes('--version')) { console.log('opencode v2.4.1'); process.exit(0); }
const packageDirectory = ${destination === 'original' ? JSON.stringify(fixture.candidate) : "require('node:path').join(require('node:path').dirname(process.cwd()),'candidate')"};
fs.writeFileSync(require('node:path').join(packageDirectory,${JSON.stringify(layout.catalogue)}),'[]');
`,
      );
      const result = await runOpenCodeConformance(fixture.environment, {
        projectDirectory: fixture.project,
        runtime: 'CLI',
      });
      expect(result).toMatchObject({
        state: 'action_required',
        data: {
          conformant: false,
          capture: {
            outcome: 'unavailable',
            reason: 'capture-error',
            error: expect.stringContaining('payload changed during capture'),
          },
        },
      });
      expect(
        observeOpenCodeProfile(fixture.profile, {
          projectDirectory: fixture.project,
          opencodeVersion: '2.4.1',
        }).data,
      ).toMatchObject({ activated: false, conformant: false });
    },
  );
  it.each([
    'valid',
    'foreign-version',
    'foreign-loader',
    'missing-control',
    'failed-root',
    'failed-entry',
    'active-entry',
    'duplicate-failed',
    'mixed-state',
    'unknown-state',
  ] as const)(
    'validates %s native observations before sealing a required registration attempt',
    async variant => {
      const fixture = registrationStatusFixture();
      const rejected = ['valid', 'failed-root', 'failed-entry'].includes(variant);
      writeFileSync(
        fixture.executable,
        String.raw`#!${process.execPath}
const fs = require('node:fs'), path = require('node:path');
if (process.argv.includes('--version')) { console.log('opencode v2.4.1'); process.exit(0); }
(async () => {
  const root = path.dirname(process.cwd()), candidate = path.join(root,'candidate');
  const url = JSON.parse(fs.readFileSync('opencode.json','utf8')).provider.test.options.baseURL + '/chat/completions';
  const tools = [{function:{name:'shell'}}];
  const send = async messages => (await fetch(url,{method:'POST',body:JSON.stringify({stream:true,tools,messages})})).text();
  const first = await send([{role:'user',content:'Perform control'}]);
  const delta = first.split('\n').filter(line => line.startsWith('data: {')).map(line => JSON.parse(line.slice(6))).find(row => row.choices[0]?.delta?.tool_calls);
  const command = JSON.parse(delta.choices[0].delta.tool_calls[0].function.arguments).command;
  if (${JSON.stringify(variant)} !== 'missing-control') require('node:child_process').execFileSync('/bin/sh',['-c',command]);
  const entry=path.join(candidate,${JSON.stringify(layout.entry)});
  const failed=target=>({source:{type:'local',path:target},features:{server:true},state:{status:'failed',error:'Plugin must export a default definition with an id and an effect or setup function.',ref:'err_fixture'}});
  const active={id:'safeword',source:{type:'local',path:entry},features:{server:true},state:{status:'active'}};
  const inventory={'failed-root':[failed(candidate)],'failed-entry':[failed(entry)],'active-entry':[active],'duplicate-failed':[failed(candidate),failed(entry)],'mixed-state':[failed(candidate),active],'unknown-state':[{...failed(candidate),state:{status:'unknown'}}]};
  const observations = [{setup:true,version:${JSON.stringify(variant === 'foreign-version' ? 'unlisted' : '2.4.1')}},
    {tool:'shell',input:{command},session_id:'native-session',plugins:inventory[${JSON.stringify(variant)}]??[]}];
  fs.writeFileSync(path.join(root,'native-observations.jsonl'),observations.map(row => JSON.stringify(row)).join('\n')+'\n');
  const logs = path.join(process.env.XDG_DATA_HOME,'opencode/log'); fs.mkdirSync(logs,{recursive:true});
  const cause = 'PluginModule.LoadError: SchemaError ["default"]["id"] expected string';
  fs.writeFileSync(path.join(logs,'opencode.log'),'timestamp=now message="failed to load plugin" target='+candidate+${JSON.stringify(variant === 'foreign-loader' ? '-foreign' : '')}+' cause='+JSON.stringify(cause)+'\n');
  console.log(await send([{role:'tool',content:'Control command returned'}]));
})().catch(error => { console.error(error); process.exitCode=1; });
`,
      );
      const result = await runOpenCodeConformance(fixture.environment, {
        projectDirectory: fixture.project,
        runtime: 'CLI',
      });
      expect(result.state).toBe('action_required');
      if (rejected) {
        expect(result.data, 'VALIDATED_NATIVE_REJECTION_NOT_SEALED').toMatchObject({
          conformant: false,
          proof_id: expect.any(String),
          capture: {
            outcome: 'failed',
            registrations: [
              {
                id: layout.entry,
                required: true,
                state: 'rejected',
                cause: expect.stringContaining('PluginModule.LoadError'),
              },
            ],
          },
        });
      } else
        expect(result.data).toMatchObject({
          conformant: false,
          capture: { outcome: 'unavailable' },
        });
      const directory = nodePath.join(fixture.project, '.safeword/state/conformance-runs-v1');
      expect(existsSync(directory), 'CONTROLLER_ATTEMPT_NOT_RETAINED').toBe(true);
      const files = readdirSync(directory, { recursive: true, encoding: 'utf8' }).filter(file =>
        file.endsWith('.json'),
      );
      expect(files).toHaveLength(1);
      const recordPath = nodePath.join(directory, files[0] ?? '');
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record).toMatchObject({
        schema_version: 1,
        integrity: expect.stringMatching(/^[a-f0-9]{64}$/),
        payload: {
          identity: {
            profile_directory: realpathSync(fixture.profile),
            project_directory: realpathSync(fixture.project),
            runtime: 'CLI',
            host_version: '2.4.1',
            method: 'automated',
            payload_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          },
          outcome: rejected ? 'failed' : 'unavailable',
        },
      });
      if (rejected) {
        expect(
          observeOpenCodeProfile(fixture.profile, {
            projectDirectory: fixture.project,
            opencodeVersion: '2.4.1',
          }).data,
        ).toMatchObject({
          runtime_lanes: {
            CLI: {
              activated: false,
              conformant: false,
              guarantees: [
                {
                  id: 'reject_action',
                  state: 'unavailable',
                  cause: expect.stringContaining('PluginModule.LoadError'),
                },
              ],
              registrations: [
                {
                  id: layout.entry,
                  required: true,
                  state: 'rejected',
                  cause: expect.stringContaining('PluginModule.LoadError'),
                },
              ],
            },
          },
        });
        const store = {
          directory: nodePath.dirname(recordPath),
          keyFile: nodePath.join(fixture.profile, runs.key),
          headFile: nodePath.join(
            fixture.profile,
            runs.heads,
            `${nodePath.basename(nodePath.dirname(recordPath))}.json`,
          ),
        };
        expect(latestControllerAttempt(store).id).toBe(record.id);
        const second = await runOpenCodeConformance(fixture.environment, {
          projectDirectory: fixture.project,
          runtime: 'CLI',
        });
        const history = readConformanceAttempts(store);
        expect(history).toHaveLength(2);
        const newest = latestControllerAttempt(store);
        expect(newest.id).toBe((second.data as { proof_id: string }).proof_id);
        expect(publishConformanceAttempt(store, record.payload, record.id).id).toBe(record.id);
        expect(latestControllerAttempt(store).id).toBe(newest.id);
        expect(() =>
          publishConformanceAttempt(store, { ...record.payload, outcome: 'conflict' }, record.id),
        ).toThrow('Conflicting');
        const newestPath = nodePath.join(
          store.directory,
          `${createHash('sha256').update(newest.id).digest('hex')}.json`,
        );
        const bytes = readFileSync(newestPath);
        const oldestBytes = readFileSync(recordPath);
        rmSync(recordPath);
        expect(
          readConformanceAttempts(store),
          'Deleted earlier history must be unavailable',
        ).toBeUndefined();
        expect(() => publishConformanceAttempt(store, newest.payload)).toThrow('history');
        writeFileSync(recordPath, oldestBytes);
        writeFileSync(
          newestPath,
          JSON.stringify({ ...newest, payload: { ...newest.payload, forged: true } }),
        );
        expect(readConformanceAttempts(store)).toBeUndefined();
        rmSync(newestPath);
        expect(
          readConformanceAttempts(store),
          'No fallback after newest record deletion',
        ).toBeUndefined();
        expect(() => publishConformanceAttempt(store, newest.payload)).toThrow('head');
        writeFileSync(newestPath, bytes);
        rmSync(store.keyFile);
        expect(() => publishConformanceAttempt(store, newest.payload)).toThrow('key missing');
        const lostKey = await runOpenCodeConformance(fixture.environment, {
          projectDirectory: fixture.project,
          runtime: 'CLI',
        });
        expect(lostKey.data).toMatchObject({
          capture: { outcome: 'failed' },
          publication_error: expect.stringContaining('key missing'),
        });
        expect(readConformanceAttempts(store)).toBeUndefined();
        expect(existsSync(store.keyFile), 'Reader must never recreate missing key').toBe(false);
      }
    },
  );
  it('rejects configuration changes during the actual capture before admission', async () => {
    const fixture = registrationStatusFixture();
    writeFileSync(
      fixture.executable,
      `#!${process.execPath}
if(process.argv.includes('--version')){console.log('opencode v2.4.1');process.exit(0)}
require('node:fs').writeFileSync(${JSON.stringify(nodePath.join(fixture.profile, 'opencode.json'))},'{}');
`,
    );
    const result = await runOpenCodeConformance(fixture.environment, {
      projectDirectory: fixture.project,
    });
    expect(result.data).toMatchObject({
      conformant: false,
      capture: {
        outcome: 'unavailable',
        error: expect.stringContaining('identity changed'),
      },
    });
  });
  it.each([
    'valid',
    'active-explain',
    'foreign-explain',
    'denied-write',
    'missing-allowed',
    'allow-denied-status',
    'always-deny-status',
    'wrong-cause',
    'activation-missing',
    'entry-valid',
    'entry-missing-allowed',
    'entry-denied-write',
    'inventory-missing',
    'inventory-foreign',
    'inventory-duplicate',
    'inventory-failed',
  ] as const)(
    'admits optional rejection only with %s independent guard contrasts',
    async variant => {
      const scenario = variant.replace(/^entry-/u, '');
      const fixture = registrationStatusFixture('2.4.1', variant === 'valid');
      const loadsExplain = prepareGuardSkillFixture(fixture.candidate, variant);
      writeFileSync(
        fixture.executable,
        String.raw`#!${process.execPath}
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
if(process.argv.includes('--version')){console.log('opencode v2.4.1');process.exit(0);}
(async()=>{
 const counter=${JSON.stringify(nodePath.join(fixture.root, 'turn-count'))};
 const turns=fs.existsSync(counter)?Number(fs.readFileSync(counter,'utf8')):0;fs.writeFileSync(counter,String(turns+1));
 if(${JSON.stringify(scenario)}==='activation-missing'&&turns>0)return;
 const root=path.dirname(process.cwd()),candidate=path.join(root,'candidate');
 const url=JSON.parse(fs.readFileSync('opencode.json','utf8')).provider.test.options.baseURL+'/chat/completions';
 const messages=[{role:'user',content:'Perform controls'}],rows=[{setup:true,version:'2.4.1'}];
 const tools=[{function:{name:'shell'}},{function:{name:'skill'}}];
 for(let i=0;i<5;i++){
  const reply=await(await fetch(url,{method:'POST',body:JSON.stringify({stream:true,tools,messages})})).text();
  const call=reply.split('\n').filter(x=>x.startsWith('data: {')).map(x=>JSON.parse(x.slice(6))).flatMap(x=>x.choices[0]?.delta?.tool_calls??[])[0];
  if(!call)break;
  const tool=call.function.name,input=JSON.parse(call.function.arguments),session='native-session';
  const plugin={id:'safeword',source:{type:'local',path:${JSON.stringify(variant === 'valid')}?candidate:path.join(candidate,${JSON.stringify(layout.entry)})},features:{server:true},state:{status:'active'}};
  const plugins=${JSON.stringify(variant)}==='inventory-missing'?[]:${JSON.stringify(variant)}==='inventory-foreign'?[{...plugin,source:{type:'local',path:candidate+'-foreign/index.js'}}]:${JSON.stringify(variant)}==='inventory-duplicate'?[plugin,{...plugin,source:{type:'local',path:candidate}}]:${JSON.stringify(variant)}==='inventory-failed'?[{...plugin,state:{status:'failed'}}]:[plugin];
  rows.push({tool,input,session_id:session,observed_at:new Date().toISOString(),plugins});
  fs.writeFileSync(path.join(root,'native-observations.jsonl'),rows.map(x=>JSON.stringify(x)).join('\n')+'\n');
  const r=spawnSync('bun',[path.join(candidate,${JSON.stringify(layout.dispatcher)})],{input:JSON.stringify({cwd:process.cwd(),session_id:session,hook_event_name:'PreToolUse',tool_name:tool==='shell'?'Bash':tool,tool_input:input}),encoding:'utf8'});
  let content=r.stdout+r.stderr;
  if(tool==='shell'&&(r.status===0||${JSON.stringify(scenario)}==='denied-write'||(${JSON.stringify(scenario)}==='always-deny-status'&&i===0))&& !(${JSON.stringify(scenario)}==='missing-allowed'&&i===0)&& !(${JSON.stringify(scenario)}==='allow-denied-status'&&i===3))spawnSync('/bin/sh',['-c',input.command]);
  if(tool==='skill')content=input.id==='safeword-explain'?(${JSON.stringify(scenario)}==='wrong-cause'?'Unrelated lookup error':'Unable to load skill safeword-explain'): '<skill_content># Cleanup control\nBase directory for this skill: '+candidate+'/skills/cleanup-zombies</skill_content>';
  if(tool==='skill'&&input.id==='safeword-explain'&&${JSON.stringify(loadsExplain)}){
   const source=${JSON.stringify(variant === 'foreign-explain')}?candidate+'-foreign':candidate;
   content='<skill_content># Explain control\nBase directory for this skill: '+source+'/skills/explain</skill_content>';
  }
  messages.push({role:'tool',tool_call_id:call.id,content});
 }
})().catch(e=>{console.error(e);process.exitCode=1});
`,
      );
      const result = await runOpenCodeConformance(fixture.environment, {
        projectDirectory: fixture.project,
        runtime: 'CLI',
      });
      if (scenario === 'valid')
        expect(
          result.data,
          `OPTIONAL_GUARD_CONTRAST_NOT_ADMITTED: ${JSON.stringify(result)}`,
        ).toMatchObject({
          conformant: true,
          proof_id: expect.any(String),
          capture: {
            outcome: 'passed',
            guarantees: [{ id: 'reject_action', state: 'proved' }],
            registrations: expect.arrayContaining([
              {
                id: 'safeword-explain',
                required: false,
                state: 'rejected',
                cause: expect.stringContaining('Unable to load skill safeword-explain'),
              },
            ]),
          },
        });
      else if (variant === 'active-explain')
        expect(result.data).toMatchObject({
          conformant: true,
          capture: {
            registrations: expect.arrayContaining([
              { id: 'safeword-explain', required: false, state: 'active' },
            ]),
          },
        });
      else if (variant === 'activation-missing')
        expect(result.data).toMatchObject({ conformant: true });
      else
        expect(result.data).toMatchObject({
          conformant: false,
          capture: { outcome: 'unavailable' },
        });
      const status = (now?: number) =>
        observeOpenCodeProfile(fixture.profile, {
          projectDirectory: fixture.project,
          opencodeVersion: '2.4.1',
          now,
        }).data as {
          runtime_lanes: {
            CLI: { activated: boolean; conformant: boolean; guarantees: unknown[] };
            TUI: { activated: boolean };
          };
        };
      if (variant === 'valid') {
        expect(
          status().runtime_lanes.CLI.activated,
          'Conformance must not activate the real target',
        ).toBe(false);
        expect(
          readFileSync(nodePath.join(fixture.root, 'turn-count'), 'utf8'),
          'Only conformance ran',
        ).toBe('1');
        const beforeProfile = process.env.OPENCODE_CONFIG_DIR;
        process.env.OPENCODE_CONFIG_DIR = fixture.profile;
        try {
          await nativeToolEvent(fixture.candidate, fixture.profile, fixture.project);
        } finally {
          if (beforeProfile === undefined) delete process.env.OPENCODE_CONFIG_DIR;
          else process.env.OPENCODE_CONFIG_DIR = beforeProfile;
        }
        expect(status(), 'FRESH_NATIVE_ACTIVATION_STATUS_MISSING').toMatchObject({
          runtime_lanes: {
            CLI: {
              activated: true,
              conformant: true,
              guarantees: [
                {
                  id: 'reject_action',
                  state: 'active',
                  proof_id: (result.data as { proof_id: string }).proof_id,
                },
              ],
            },
            TUI: { activated: false },
          },
        });
        const cli = spawnSync(
          'bun',
          [nodePath.resolve('src/cli.ts'), 'status', '--agents=opencode', '--json'],
          {
            cwd: fixture.project,
            env: { ...process.env, ...fixture.environment },
            encoding: 'utf8',
            timeout: 30_000,
          },
        );
        expect(cli.status).toBe(2);
        const publicResult = JSON.parse(cli.stdout);
        expect(publicResult.ok).toBe(true);
        expect(
          publicResult.data.surfaces.find((row: { name: string }) => row.name === 'opencode').data
            .runtime_lanes.CLI.activated,
          'Actual CLI cwd did not select current proof',
        ).toBe(true);
        const directory = nodePath.join(fixture.profile, runs.activation);
        const attempts = readdirSync(directory, { recursive: true, encoding: 'utf8' })
          .filter(name => name.endsWith('.json'))
          .map(name => JSON.parse(readFileSync(nodePath.join(directory, name), 'utf8')));
        const activation = attempts.find(record => record.payload?.runtime === 'CLI');
        const proofRoot = nodePath.join(fixture.project, runs.directory);
        const proofName = readdirSync(proofRoot, { recursive: true, encoding: 'utf8' }).find(name =>
          name.endsWith('.json'),
        );
        const proofPath = nodePath.join(proofRoot, proofName ?? 'missing');
        const originalProof = readFileSync(proofPath);
        const originalRecord = JSON.parse(originalProof.toString());
        writeFileSync(
          proofPath,
          JSON.stringify({
            ...originalRecord,
            payload: {
              ...originalRecord.payload,
              identity: { ...originalRecord.payload.identity, method: 'imported' },
            },
          }),
        );
        expect(
          status().runtime_lanes.CLI.activated,
          'Forged project record must not activate',
        ).toBe(false);
        writeFileSync(proofPath, originalProof);
        const keyPath = nodePath.join(fixture.profile, runs.key),
          keyBytes = readFileSync(keyPath);
        rmSync(keyPath);
        expect(status().runtime_lanes.CLI.activated).toBe(false);
        expect(existsSync(keyPath), 'Status must never create a missing key').toBe(false);
        writeFileSync(keyPath, keyBytes);
        const cataloguePath = nodePath.join(fixture.candidate, layout.catalogue),
          catalogueBytes = readFileSync(cataloguePath);
        writeFileSync(cataloguePath, '[]');
        expect(
          status().runtime_lanes.CLI.activated,
          'Changed complete payload must invalidate',
        ).toBe(false);
        writeFileSync(cataloguePath, catalogueBytes);
        const observedAt = Date.parse(activation.payload.observed_at);
        expect(status(observedAt).runtime_lanes.CLI.activated).toBe(true);
        expect(status(observedAt + 7 * 86_400_000).runtime_lanes.CLI.activated).toBe(true);
        expect(status(observedAt - 1).runtime_lanes.CLI.activated).toBe(false);
        expect(status(observedAt + 7 * 86_400_000 + 1).runtime_lanes.CLI.activated).toBe(false);
        const nativePaths = readdirSync(directory, { recursive: true, encoding: 'utf8' }).filter(
          name => name.endsWith('.json'),
        );
        expect(
          nativePaths.map(name => readFileSync(nodePath.join(directory, name), 'utf8')).join(''),
        ).not.toContain('fixture private prompt');
        const nativeRecord = nativePaths.find(
          name =>
            JSON.parse(readFileSync(nodePath.join(directory, name), 'utf8')).payload?.runtime ===
            'CLI',
        );
        if (!nativeRecord) throw new Error('Native activation record missing');
        const nativePath = nodePath.join(directory, nativeRecord),
          nativeBytes = readFileSync(nativePath);
        writeFileSync(
          nativePath,
          JSON.stringify({ ...activation, payload: { ...activation.payload, runtime: 'TUI' } }),
        );
        expect(status().runtime_lanes.CLI.activated, 'Forged native record fails closed').toBe(
          false,
        );
        writeFileSync(nativePath, nativeBytes);
        const nativeKey = nodePath.join(directory, 'integrity.key'),
          nativeKeyBytes = readFileSync(nativeKey);
        rmSync(nativeKey);
        expect(status().runtime_lanes.CLI.activated, 'Missing native key fails closed').toBe(false);
        expect(existsSync(nativeKey), 'Reader must not create native key').toBe(false);
        writeFileSync(nativeKey, nativeKeyBytes);
        rmSync(nativePath);
        expect(
          status().runtime_lanes.CLI.activated,
          'Deleted latest native observation fails closed',
        ).toBe(false);
        writeFileSync(nativePath, nativeBytes);
        setNativeParentComponent(fixture.root, { parentExecutable: '/foreign/native' });
        const savedProfile = process.env.OPENCODE_CONFIG_DIR;
        process.env.OPENCODE_CONFIG_DIR = fixture.profile;
        try {
          await nativeToolEvent(fixture.candidate, fixture.profile, fixture.project);
        } finally {
          if (savedProfile === undefined) delete process.env.OPENCODE_CONFIG_DIR;
          else process.env.OPENCODE_CONFIG_DIR = savedProfile;
        }
        expect(status().runtime_lanes.CLI.activated, 'Foreign parent must not activate').toBe(
          false,
        );
        const foreignCli = spawnSync(
          'bun',
          [nodePath.resolve('src/cli.ts'), 'status', '--agents=opencode', '--json'],
          {
            cwd: fixture.project,
            env: { ...process.env, ...fixture.environment },
            encoding: 'utf8',
            timeout: 30_000,
          },
        );
        expect(foreignCli.status).toBe(2);
        const foreignStatus = JSON.parse(foreignCli.stdout);
        expect(foreignStatus.ok).toBe(true);
        expect(
          foreignStatus.data.surfaces.find((row: { name: string }) => row.name === 'opencode').data
            .runtime_lanes.CLI.activated,
          'Public status must refuse activation after observing a foreign parent',
        ).toBe(false);
        const bytes = readFileSync(fixture.executable);
        writeFileSync(
          fixture.executable,
          `#!${process.execPath}\nif(process.argv.includes('--version'))console.log('opencode v2.4.1');`,
        );
        await runOpenCodeConformance(fixture.environment, {
          projectDirectory: fixture.project,
          runtime: 'CLI',
        });
        expect(status().runtime_lanes.CLI.activated, 'Later unavailable cannot fall back').toBe(
          false,
        );
        writeFileSync(fixture.executable, bytes);
      } else expect(status().runtime_lanes.CLI.activated).toBe(false);
    },
  );
});
