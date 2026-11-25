import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { installOpenCodeProfile } from '../../src/opencode/profile.js';
import { OPENCODE_V2_PLUGIN_LAYOUT as layout } from '../../src/schema.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
it('characterizes enrolled SDK setup and registered callback through actual packaged guard allow/deny', () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'opencode-v2-quality-owner-'));
  roots.push(root);
  const candidate = nodePath.join(root, 'candidate'),
    project = nodePath.join(root, 'project'),
    profile = nodePath.join(root, 'profile');
  const build = spawnSync(
    'bun',
    ['scripts/generate-opencode-v2-plugin.ts', '--output', candidate],
    {
      cwd: nodePath.resolve(import.meta.dirname, '../..'),
      encoding: 'utf8',
      timeout: 120_000,
    },
  );
  expect(build.error).toBeUndefined();
  expect(build.status, build.stderr).toBe(0);
  // Existing pinned SDK resolves from the owned parent, never installed or copied into payload.
  symlinkSync(
    nodePath.resolve(import.meta.dirname, '../../../opencode-v2-plugin/node_modules'),
    nodePath.join(root, 'node_modules'),
    'dir',
  );
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  mkdirSync(profile);
  writeFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'), '# synthetic\n');
  cpSync(
    nodePath.resolve(import.meta.dirname, '../../templates/hooks'),
    nodePath.join(project, '.safeword/hooks'),
    { recursive: true },
  );
  const driver = nodePath.join(root, 'sdk-callback.mjs');
  writeFileSync(
    driver,
    `import {pathToFileURL} from 'node:url';
const plugin=(await import(pathToFileURL(process.argv[2]).href)).default;
let callback;
await plugin.setup({options:{profileDirectory:process.argv[3]},location:{directory:process.cwd()},app:{version:process.argv[4]},
tool:{hook:async(event,fn)=>{if(event!=='execute.before'||callback)throw Error('Unexpected registration');callback=fn;}},
session:{hook:async()=>{}},skill:{transform:async()=>({dispose:async()=>{}})},command:{transform:async()=>{}}});
if(!callback){console.log('not registered');process.exit(0);}
try{await callback(JSON.parse(process.argv[5]));console.log('callback allowed');}
catch(error){console.error(error.message);process.exitCode=2;}
`,
  );
  const environment = {
    PATH: process.env.PATH,
    HOME: nodePath.join(root, 'home'),
    XDG_CONFIG_HOME: nodePath.join(root, 'xdg'),
    OPENCODE_CONFIG_DIR: profile,
    SAFEWORD_NO_AUTO_UPGRADE: '1',
    SAFEWORD_SKIP_INSTALL: '1',
  };
  function invoke(version: string, command: string, tool = 'shell', input?: object) {
    const result = spawnSync(
      'bun',
      [
        driver,
        nodePath.join(candidate, layout.entry),
        profile,
        version,
        JSON.stringify({ tool, sessionID: 'component-session', input: input ?? { command } }),
      ],
      {
        cwd: project,
        encoding: 'utf8',
        timeout: 30_000,
        env: environment,
      },
    );
    expect(result.error).toBeUndefined();
    return result;
  }
  // Lifecycle enrollment is setup, never conformance or activation evidence.
  const missing = invoke('2.2.6', 'pkill node');
  expect(missing.status, missing.stderr).toBe(0);
  expect(missing.stdout.trim()).toBe('not registered');
  expect(
    installOpenCodeProfile(profile, {
      nativeV2: { projectDirectory: project, packageDirectory: candidate, epoch: 'component' },
    }).state,
  ).toBe('changed');
  const wrongVersion = invoke('1.18.23', 'pkill node');
  expect(wrongVersion.status, wrongVersion.stderr).toBe(0);
  expect(wrongVersion.stdout.trim()).toBe('not registered');
  const allowed = invoke('2.2.6', 'echo synthetic-control');
  expect(allowed.status, allowed.stderr).toBe(0);
  expect(allowed.stdout.trim()).toBe('callback allowed');
  const denied = invoke('2.2.6', 'pkill node');
  expect(denied.status, denied.stderr).toBe(2);
  expect(denied.stderr).toContain('Broad process kill blocked: `pkill node`');
  expect(denied.stdout).toBe('');

  const ticket = nodePath.join(project, '.project/tickets/codec');
  mkdirSync(ticket, { recursive: true });
  writeFileSync(
    nodePath.join(ticket, 'test-definitions.md'),
    '### Scenario: private codec control\n\n- [ ] RED\n',
  );
  const missingTarget = nodePath.join(project, '.project/tickets/missing/test-definitions.md');
  mkdirSync(nodePath.dirname(missingTarget), { recursive: true });
  const document = nodePath.join(project, 'document.md');
  writeFileSync(document, 'old\n');
  for (const [tool, allowedInput, deniedInput, canonicalInput, reason, code] of [
    [
      'write',
      { path: document, content: 'new\n' },
      { path: missingTarget, content: '# scenarios\n' },
      { file_path: missingTarget, content: '# scenarios\n' },
      'Cannot create test definitions without a ticket spec.',
      2,
    ],
    [
      'edit',
      { path: document, oldString: 'old', newString: 'new', replaceAll: false },
      {
        path: nodePath.join(ticket, 'test-definitions.md'),
        oldString: '- [ ] RED',
        newString: '- [x] RED',
      },
      {
        file_path: nodePath.join(ticket, 'test-definitions.md'),
        old_string: '- [ ] RED',
        new_string: '- [x] RED',
      },
      'without an annotation',
      2,
    ],
  ] as const) {
    const control = spawnSync('bun', [nodePath.join(candidate, layout.dispatcher)], {
      cwd: project,
      encoding: 'utf8',
      timeout: 30_000,
      env: { ...environment, SAFEWORD_PLUGIN_CLI: nodePath.join(candidate, layout.runtime) },
      input: JSON.stringify({
        cwd: project,
        session_id: 'component-session',
        hook_event_name: 'PreToolUse',
        tool_name: tool === 'write' ? 'Write' : 'Edit',
        tool_input: canonicalInput,
      }),
    });
    expect(control.error).toBeUndefined();
    expect(control.status, control.stderr).toBe(code);
    expect(control.stderr).toContain(reason);
    const allow = invoke('2.2.6', '', tool, allowedInput);
    expect(allow.status, allow.stderr).toBe(0);
    expect(allow.stdout.trim()).toBe('callback allowed');
    const deny = invoke('2.2.6', '', tool, deniedInput);
    expect.soft(deny.status, `V2_${tool.toUpperCase()}_CODEC_MISSING`).toBe(2);
    expect.soft(deny.stderr, `V2_${tool.toUpperCase()}_POLICY_REASON_MISSING`).toContain(reason);
  }
});
