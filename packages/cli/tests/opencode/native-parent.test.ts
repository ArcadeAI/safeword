import * as childProcess from 'node:child_process';
import { chmodSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { readNativeParent } from '../../../opencode-v2-plugin/src/native-parent.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

vi.mock('node:child_process', async importOriginal => ({
  ...(await importOriginal<typeof childProcess>()),
  execFileSync: vi.fn(),
}));

const roots: string[] = [];
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  for (const root of roots) removeTemporaryDirectory(root);
  roots.length = 0;
});

it.each(['no-developer-tools', 'no-interpreter', 'relative-developer-path'])(
  'never launches the Python install stub when %s',
  condition => {
    vi.stubGlobal('process', { ...process, platform: 'darwin' });
    const root = createTemporaryDirectory();
    roots.push(root);
    const run = vi.mocked(childProcess.execFileSync).mockImplementation(file => {
      if (file !== '/usr/bin/xcode-select') throw new Error('Python stub must not launch');
      if (condition === 'no-developer-tools') throw new Error('No selected developer directory');
      return condition === 'relative-developer-path' ? 'relative/developer\n' : `${root}\n`;
    });
    expect(readNativeParent()).toBeUndefined();
    expect(
      run.mock.calls.map(call => call[0]),
      'Preflight must precede any interpreter launch',
    ).toEqual(['/usr/bin/xcode-select']);
  },
);

it('uses the actual selected installed interpreter with bounded private process input', () => {
  vi.stubGlobal('process', { ...process, platform: 'darwin' });
  const developer = createTemporaryDirectory();
  roots.push(developer);
  const python = nodePath.join(developer, 'usr/bin/python3');
  mkdirSync(nodePath.dirname(python), { recursive: true });
  writeFileSync(python, '# fixture interpreter; the external process seam is substituted\n');
  chmodSync(python, 0o755);
  const resolvedPython = realpathSync(python);
  const native = {
    serverPid: process.pid,
    parentPid: process.ppid,
    serverExecutable: '/native/opencode',
    parentExecutable: '/native/opencode',
    serverArguments: ['serve', '--stdio', '--port', '0'],
    parentArguments: ['run', '--standalone', 'private prompt'],
  };
  const run = vi.mocked(childProcess.execFileSync).mockImplementation(file => {
    if (file === '/usr/bin/xcode-select') return `${developer}\n`;
    if (file === resolvedPython) return JSON.stringify(native);
    throw new Error('Unexpected external executable');
  });
  expect(readNativeParent()).toEqual(native);
  expect(run.mock.calls.map(call => call[0])).toEqual(['/usr/bin/xcode-select', resolvedPython]);
  expect(run.mock.calls[1]?.[1]).toEqual([
    '-I',
    '-c',
    expect.any(String),
    String(process.pid),
    String(process.ppid),
  ]);
  expect(run.mock.calls[1]?.[2]).toMatchObject({
    timeout: 4000,
    maxBuffer: 32_768,
    env: { PATH: '/usr/bin:/bin' },
    stdio: ['ignore', 'pipe', 'ignore'],
  });
});
