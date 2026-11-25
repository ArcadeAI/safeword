import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import {
  prepareElectronMonitor,
  requireElectronMonitor,
} from '../../src/review/retrospective-electron-monitor.js';

const marker = (kind: string, pid = 41, extra = {}) => ({ schema_version: 1, kind, pid, ...extra });
const complete = [marker('main-ready'), marker('armed'), marker('closed')];

it('accepts complete monitoring for every launched application', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-monitor-'));
  try {
    const events = path.join(directory, 'events');
    const records = [...complete, ...complete.map(record => ({ ...record, pid: 42 }))];
    writeFileSync(events, `${records.map(record => JSON.stringify(record)).join('\n')}\n`);
    expect(() => {
      requireElectronMonitor(events);
    }).not.toThrow();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it.each([
  ['no launched monitor', []],
  ['missing main startup', complete.slice(1)],
  ['missing renderer arming', [complete[0], complete[2]]],
  ['incomplete teardown', complete.slice(0, 2)],
  ['another unmonitored application', [...complete, marker('main-ready', 42)]],
  ['mismatched process identity', [...complete.slice(0, 2), marker('closed', 42)]],
  ['an unknown event', [...complete, marker('unknown')]],
  ['an invalid process identity', [...complete, marker('armed', -1)]],
  ['a missing schema', [...complete, { kind: 'armed', pid: 41 }]],
  ['an invalid event object', [...complete, 'not an object']],
  ['a malformed error', [...complete, marker('error')]],
])('refuses %s as complete monitoring', (_name, records) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-monitor-'));
  try {
    const events = path.join(directory, 'events');
    writeFileSync(events, records.map(record => JSON.stringify(record)).join('\n'));
    expect(() => {
      requireElectronMonitor(events);
    }).toThrow(/monitor/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it.each(['main exception', 'renderer exception', 'renderer crash'])(
  'refuses a recorded %s despite complete lifecycle markers',
  reason => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-monitor-'));
    try {
      const events = path.join(directory, 'events');
      writeFileSync(
        events,
        [...complete, marker('error', 41, { message: reason })]
          .map(record => JSON.stringify(record))
          .join('\n'),
      );
      expect(() => {
        requireElectronMonitor(events);
      }).toThrow(reason);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

it('refuses missing and malformed event files', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-monitor-'));
  try {
    const events = path.join(directory, 'events');
    expect(() => {
      requireElectronMonitor(events);
    }).toThrow();
    writeFileSync(events, '{invalid');
    expect(() => {
      requireElectronMonitor(events);
    }).toThrow();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it.each([false, true])(
  'records an actual child-process exception without suppressing normal handling (handler=%s)',
  handled => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-monitor-'));
    try {
      const report = path.join(directory, 'report');
      const monitor = prepareElectronMonitor(directory, report);
      const script = `
        Object.defineProperty(process.versions, 'electron', {value:'fixture'});
        process.type = 'browser';
        require(${JSON.stringify(`${report}.monitor.cjs`)});
        ${handled ? "process.on('uncaughtException', () => {});" : ''}
        setImmediate(() => { throw new Error('controlled main-process exception'); });
      `;
      const result = spawnSync(process.execPath, ['--eval', script], {
        env: { ...process.env, NODE_OPTIONS: '' },
        encoding: 'utf8',
        timeout: 10_000,
      });
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(handled ? 0 : 1);
      appendFileSync(
        monitor.events,
        [marker('armed', result.pid), marker('closed', result.pid)]
          .map(record => `${JSON.stringify(record)}\n`)
          .join(''),
      );
      expect(() => {
        requireElectronMonitor(monitor.events);
      }).toThrow('controlled main-process exception');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
