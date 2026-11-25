import { realpathSync } from 'node:fs';

import { expect, it } from 'vitest';

import { dedicatedRuntime } from '../../../opencode-v2-plugin/src/native-activation.js';
import type { NativeParent } from '../../../opencode-v2-plugin/src/native-parent.js';

const facts = (): NativeParent => ({
  serverPid: process.pid,
  parentPid: process.ppid,
  serverExecutable: realpathSync(process.execPath),
  parentExecutable: realpathSync(process.execPath),
  serverArguments: ['serve', '--stdio', '--port', '0'],
  parentArguments: [
    'run',
    '--standalone',
    '--auto',
    '--format',
    'json',
    '--model',
    'fixture/model',
    'private prompt',
  ],
});
it('requires positive dedicated CLI and TUI arguments, never prompt text or environment labels', () => {
  expect(dedicatedRuntime(facts())).toBe('CLI');
  expect(
    dedicatedRuntime({
      ...facts(),
      parentArguments: ['--standalone', '--auto', '--prompt', 'private prompt'],
    }),
  ).toBe('TUI');
  expect(
    dedicatedRuntime({
      ...facts(),
      parentArguments: ['run', '--standalone', 'private prompt --prompt --remote'],
    }),
  ).toBe('CLI');
});
it.each([
  undefined,
  { ...facts(), parentPid: 1 },
  { ...facts(), serverPid: process.pid + 1 },
  { ...facts(), parentPid: process.ppid + 1 },
  { ...facts(), parentExecutable: '/foreign/opencode' },
  { ...facts(), serverExecutable: '/foreign/opencode', parentExecutable: '/foreign/opencode' },
  { ...facts(), serverArguments: ['serve', '--stdio'] },
  { ...facts(), parentArguments: ['run', '--auto', 'prompt'] },
  { ...facts(), parentArguments: ['--standalone'] },
  { ...facts(), parentArguments: ['--standalone', '--auto'] },
  { ...facts(), parentArguments: ['--standalone', '--prompt'] },
  { ...facts(), parentArguments: ['--standalone', '--prompt', 'prompt', '--remote'] },
  { ...facts(), parentArguments: ['run', '--standalone', '--standalone', 'prompt'] },
  { ...facts(), parentArguments: ['run', '--standalone', '--format', 'unknown', 'prompt'] },
  { ...facts(), parentArguments: ['run', '--standalone', 'first', 'second'] },
  { ...facts(), parentArguments: ['attach', '--standalone', '--prompt', 'prompt'] },
])('keeps missing, foreign, shared and ambiguous topology unknown %#', candidate => {
  expect(dedicatedRuntime(candidate)).toBe('unknown');
});
