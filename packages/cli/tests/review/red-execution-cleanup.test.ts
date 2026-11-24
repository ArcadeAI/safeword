/* eslint-disable unicorn/prefer-event-target -- ChildProcess and its streams use Node EventEmitter. */
import type * as ChildProcessModule from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({ spawn: vi.fn(), taskkill: vi.fn() }));
vi.mock('node:child_process', async original => ({
  ...(await original<typeof ChildProcessModule>()),
  spawn: boundary.spawn,
  spawnSync: boundary.taskkill,
}));

import { executeNoShellCommand } from '../../src/review/red-execution.js';

// eslint-disable-next-line unicorn/no-null -- ChildProcess close uses null when no signal terminated it.
const noSignal = null;

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function childFixture() {
  const child = Object.assign(new EventEmitter(), {
    pid: 123_456,
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    kill: vi.fn(),
  });
  boundary.spawn.mockReturnValue(child);
  boundary.taskkill.mockReturnValue({ status: 0 });
  return child;
}

it('does not taskkill an exited Windows proof PID that could have been reused', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'safeword-exited-proof-'));
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  if (descriptor === undefined) throw new Error('Process platform descriptor is unavailable');
  const child = childFixture();
  try {
    Object.defineProperty(process, 'platform', { ...descriptor, value: 'win32' });
    const pending = executeNoShellCommand({
      projectRoot: root,
      cwd: '.',
      argv: ['fixture'],
      timeoutMs: 1000,
    });
    child.emit('close', 0, noSignal);
    const result = await pending;
    expect(result.termination).toEqual({ exitCode: 0, signal: noSignal, timedOut: false });
    expect(boundary.taskkill).not.toHaveBeenCalled();
    expect(child.kill).not.toHaveBeenCalled();
  } finally {
    Object.defineProperty(process, 'platform', descriptor);
    rmSync(root, { recursive: true, force: true });
  }
});

it('retains the owned POSIX process-group sweep after normal proof exit', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'safeword-exited-group-'));
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  if (descriptor === undefined) throw new Error('Process platform descriptor is unavailable');
  const child = childFixture();
  const signal = vi.spyOn(process, 'kill').mockReturnValue(true);
  try {
    Object.defineProperty(process, 'platform', { ...descriptor, value: 'darwin' });
    const pending = executeNoShellCommand({
      projectRoot: root,
      cwd: '.',
      argv: ['fixture'],
      timeoutMs: 1000,
    });
    child.emit('close', 0, noSignal);
    const result = await pending;
    expect(result.termination.exitCode).toBe(0);
    expect(signal).toHaveBeenCalledWith(-child.pid, 'SIGKILL');
    expect(boundary.taskkill).not.toHaveBeenCalled();
  } finally {
    Object.defineProperty(process, 'platform', descriptor);
    rmSync(root, { recursive: true, force: true });
  }
});
