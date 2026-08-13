import { spawnSync } from 'node:child_process';
import console from 'node:console';
import nodePath from 'node:path';
import process from 'node:process';

const scriptDirectory = import.meta.dirname;
const cliRoot = nodePath.resolve(scriptDirectory, '..');
const liveSmokeArguments = [
  'run',
  '--config',
  'vitest.live.config.ts',
  '--maxWorkers=1',
  '--no-file-parallelism',
  'tests/smoke/retro-dedup.live.test.ts',
  'tests/smoke/reconcile.live.test.ts',
];

if (process.argv.length === 2) {
  const localBinDirectory = nodePath.join(cliRoot, 'node_modules', '.bin');
  const pathKey = Object.keys(process.env).find(key => key.toUpperCase() === 'PATH') ?? 'PATH';
  const result = spawnSync('vitest', liveSmokeArguments, {
    cwd: cliRoot,
    env: {
      ...process.env,
      [pathKey]: `${process.env[pathKey] ?? ''}${nodePath.delimiter}${localBinDirectory}`,
    },
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.signal) {
    console.error(`vitest terminated with signal ${result.signal}`);
    process.exitCode = 1;
  } else {
    process.exitCode = result.status ?? 1;
  }
} else {
  console.error('test:smoke:live:github accepts no arguments.');
  process.exitCode = 2;
}
