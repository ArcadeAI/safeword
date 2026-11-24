import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Fixed instrumentation outside the immutable project archives; never caller-supplied code. */
export function prepareElectronMonitor(snapshot: string, report: string) {
  const events = `${report}.events.jsonl`;
  const preload = `${report}.monitor.cjs`;
  const playwright = path.join(snapshot, 'node_modules/playwright');
  writeFileSync(events, '', { flag: 'wx', mode: 0o600 });
  writeFileSync(
    preload,
    String.raw`
const fs = require('node:fs');
const events = ${JSON.stringify(events)};
const record = (kind, pid, message) => fs.appendFileSync(events, JSON.stringify({
  schema_version: 1, kind, pid, ...(message === undefined ? {} : {message: String(message).slice(0, 2000)})
}) + '\n');
if (process.versions.electron) {
  if (process.type === 'browser') {
    process.on('uncaughtExceptionMonitor', error => record('error', process.pid, error.stack || error));
    record('main-ready', process.pid);
  }
} else {
  const electron = require(${JSON.stringify(playwright)})._electron;
  const launch = electron.launch;
  electron.launch = async (options = {}) => {
    const app = await launch.call(electron, {...options, args: ['-r', __filename, ...(options.args || [])]});
    const pid = app.process().pid;
    try {
      const records = fs.readFileSync(events, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
      if (!records.some(entry => entry.kind === 'main-ready' && entry.pid === pid))
        throw new Error('Electron main exception monitor did not start.');
      const context = app.context();
      context.on('weberror', event => record('error', pid, event.error().stack || event.error()));
      const seen = new WeakSet();
      const observe = page => {
        if (seen.has(page)) return;
        seen.add(page);
        page.on('crash', () => record('error', pid, 'Electron renderer crashed.'));
      };
      context.on('page', observe);
      for (const page of app.windows()) {
        observe(page);
        for (const error of await page.pageErrors()) record('error', pid, error.stack || error);
      }
      const close = app.close.bind(app);
      app.close = async (...args) => {
        const result = await close(...args);
        record('closed', pid);
        return result;
      };
      record('armed', pid);
      return app;
    } catch (error) {
      record('error', pid, error.stack || error);
      try { await app.close(); }
      catch (cleanup) { throw new AggregateError([error, cleanup], 'Electron monitor setup and cleanup failed.'); }
      throw error;
    }
  };
}
`,
    { flag: 'wx', mode: 0o600 },
  );
  return { events, nodeOptions: `--require ${JSON.stringify(preload)}` };
}

function monitorEvent(line: string): { kind: string; pid: number; message?: unknown } {
  const record = JSON.parse(line) as Record<string, unknown>;
  if (
    record === null ||
    typeof record !== 'object' ||
    record.schema_version !== 1 ||
    typeof record.kind !== 'string' ||
    typeof record.pid !== 'number' ||
    !Number.isSafeInteger(record.pid) ||
    record.pid <= 0
  )
    throw new Error('Electron exception monitor telemetry is malformed.');
  return { kind: record.kind, pid: record.pid, message: record.message };
}

/** Require positive coverage for every launched main process, including completed teardown. */
export function requireElectronMonitor(events: string): void {
  const ready = new Set<number>();
  const armed = new Set<number>();
  const closed = new Set<number>();
  const groups = new Map([
    ['main-ready', ready],
    ['armed', armed],
    ['closed', closed],
  ]);
  const lines = readFileSync(events, 'utf8').trim().split('\n').filter(Boolean);
  for (const line of lines) {
    const record = monitorEvent(line);
    if (record.kind === 'error') {
      if (typeof record.message !== 'string')
        throw new Error('Electron exception monitor error is malformed.');
      throw new Error(`Electron uncaught exception or renderer crash: ${record.message}`);
    }
    const group = groups.get(record.kind);
    if (group === undefined) throw new Error('Electron exception monitor event kind is malformed.');
    group.add(record.pid);
  }
  if (
    ready.size === 0 ||
    ready.size !== armed.size ||
    ready.size !== closed.size ||
    [...ready].some(pid => !armed.has(pid) || !closed.has(pid))
  )
    throw new Error('Electron exception monitor coverage is incomplete.');
}
