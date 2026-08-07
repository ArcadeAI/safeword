import { readFile } from 'node:fs/promises';

import {
  type SpikeState,
  type SpikeTopology,
  teardownPreview,
  validateSpikeReport,
  validateSpikeTopology,
  writeSpikeStateAtomic,
} from '../src/spike-safety.js';

async function readText(filePath: string): Promise<string> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI paths are explicit operator inputs and reads are non-mutating.
  return readFile(filePath, 'utf8');
}

async function readStdin(): Promise<string> {
  let input = '';
  for await (const chunk of process.stdin) input += String(chunk);
  return input;
}

async function main(): Promise<void> {
  const command = Reflect.get(process.argv, 2) as string | undefined;
  const filePath = Reflect.get(process.argv, 3) as string | undefined;
  if (filePath === undefined) throw new Error('a state or report path is required');
  if (command === 'record-state') {
    await writeSpikeStateAtomic(filePath, JSON.parse(await readStdin()) as SpikeState);
    process.stdout.write('state recorded\n');
    return;
  }
  if (command === 'teardown-preview') {
    const state = JSON.parse(await readText(filePath)) as SpikeState;
    process.stdout.write(`${teardownPreview(state).join(' ')}\n`);
    return;
  }
  if (command === 'validate-topology') {
    const state = JSON.parse(await readText(filePath)) as SpikeState;
    validateSpikeTopology(JSON.parse(await readStdin()) as SpikeTopology, state);
    process.stdout.write('topology valid\n');
    return;
  }
  if (command === 'validate-report') {
    validateSpikeReport(await readText(filePath), JSON.parse(await readStdin()) as string[]);
    process.stdout.write('report valid\n');
    return;
  }
  throw new Error('expected record-state, teardown-preview, validate-topology, or validate-report');
}

await main();
