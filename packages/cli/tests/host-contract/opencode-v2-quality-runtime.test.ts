import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { installOpenCodeProfile } from '../../src/opencode/profile.js';
import { OPENCODE_V2_PLUGIN_LAYOUT as layout } from '../../src/schema.js';
import { runCli } from '../helpers.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function createRuntimeFixture() {
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
const callbacks = new Map();
await plugin.setup({options:{profileDirectory:process.argv[3]},location:{directory:process.cwd()},app:{version:process.argv[4]},
tool:{hook:async(event,fn)=>{if(callbacks.has(event))throw Error('Duplicate registration');callbacks.set(event,fn);}},
session:{hook:async()=>{}},skill:{transform:async()=>({dispose:async()=>{}})},command:{transform:async()=>{}}});
if(!callbacks.size){console.log('not registered');process.exit(0);}
const event=JSON.parse(process.argv[5]);
try{await callbacks.get(event.status ? 'execute.after' : 'execute.before')(event);console.log(event.result?.content ?? 'callback allowed');}
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
  function invokeEvent(version: string, event: object) {
    const result = spawnSync(
      'bun',
      [driver, nodePath.join(candidate, layout.entry), profile, version, JSON.stringify(event)],
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
  function invoke(version: string, command: string, tool = 'shell', input?: object) {
    return invokeEvent(version, {
      tool,
      sessionID: 'component-session',
      input: input ?? { command },
    });
  }
  return { project, candidate, profile, environment, invoke, invokeEvent };
}

it('characterizes enrolled SDK setup and registered callback through actual packaged guard allow/deny', () => {
  const { project, candidate, profile, environment, invoke } = createRuntimeFixture();
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

it('binds a saved intake ticket through the installed OpenCode profile before enforcing direct edits', async () => {
  const { project, profile, candidate, environment, invokeEvent } = createRuntimeFixture();
  expect(
    installOpenCodeProfile(profile, {
      nativeV2: {
        projectDirectory: project,
        packageDirectory: candidate,
        epoch: 'component',
      },
    }).state,
  ).toBe('changed');
  const authorSession = 'author/feature';
  function before(tool: string, input: Record<string, string>, sessionID = authorSession) {
    return invokeEvent('2.2.6', { tool, input, sessionID });
  }
  function expectDenied(result: ReturnType<typeof before>) {
    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain('advance-intake');
  }
  function expectAllowed(result: ReturnType<typeof before>) {
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe('callback allowed');
  }
  function after(path: string, content: string) {
    const result = invokeEvent('2.2.6', {
      tool: 'write',
      input: { path, content },
      sessionID: authorSession,
      status: 'completed',
      result: { content: 'Saved' },
    });
    expect(result.status, result.stderr).toBe(0);
    return result.stdout;
  }
  const dir = nodePath.join(project, '.project/tickets/OPEN12-dispatch');
  mkdirSync(dir, { recursive: true });
  const filePath = nodePath.join(dir, 'ticket.md');
  const content = '---\nid: OPEN12\ntype: feature\nphase: intake\nstatus: in_progress\n---\n';
  writeFileSync(filePath, content);
  const output = after(filePath, content);
  async function switchWork(action: 'pause' | 'resume') {
    const commands = output.matchAll(
      /safeword ticket (pause|resume) OPEN12 ([\w.-]+?)(?= in this checkout|\.(?:\s|$))/gu,
    );
    const session = commands.find(match => match[1] === action)?.[2];
    if (!session) throw new Error(`Missing ${action} command in ${output}`);
    const result = await runCli(['ticket', action, 'OPEN12', session, '--json'], { cwd: project });
    expect(result.exitCode, result.stdout || result.stderr).toBe(0);
  }
  expectDenied(before('edit', { path: 'delivery.py' }));
  expectDenied(before('write', { path: 'deployment.toml' }));
  expectAllowed(before('write', { path: 'deployment.toml' }, 'unbound'));
  expectAllowed(before('shell', { command: 'cat delivery.py' }));
  const namedDestination = { command: 'cp /tmp/input delivery.py' };
  expectDenied(before('shell', namedDestination));
  expectAllowed(before('shell', namedDestination, 'unbound'));
  expectAllowed(before('shell', { ...namedDestination, workdir: dir }));
  const app = nodePath.join(project, 'app');
  mkdirSync(app);
  const redirect = { command: 'cat < input > report 2>&1', workdir: 'app' };
  expectDenied(before('shell', redirect));
  expectAllowed(before('shell', { ...redirect, workdir: dir }));
  expectAllowed(before('shell', { command: 'cp delivery.py /tmp/output' }));
  // Patch has no verified V2 codec. Exercise its canonical dispatcher boundary directly.
  const patch = spawnSync('bun', [nodePath.join(candidate, layout.dispatcher)], {
    cwd: project,
    env: environment,
    encoding: 'utf8',
    input: JSON.stringify({
      cwd: project,
      session_id: authorSession,
      tool_name: 'apply_patch',
      tool_input: {
        command:
          '*** Begin Patch\n*** Update File: .project/notes\n*** Move to: delivery.py\n@@\n-a\n+b\n*** End Patch',
      },
    }),
  });
  expect(patch.status).toBe(4);
  expect(patch.stderr).toContain('advance-intake');
  await switchWork('pause');
  expectAllowed(before('write', { path: 'help.txt' }));
  expect(after('help.txt', '')).toBe('Saved\n');
  await switchWork('resume');
  expectDenied(before('write', { path: 'delivery.py' }));
});
