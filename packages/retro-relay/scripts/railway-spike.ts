import { readFile } from 'node:fs/promises';

import { type SpikeState, teardownPreview, validateSpikeReport } from '../src/spike-safety.js';

async function readText(filePath: string): Promise<string> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI paths are explicit operator inputs and reads are non-mutating.
  return readFile(filePath, 'utf8');
}

async function main(): Promise<void> {
  const command = Reflect.get(process.argv, 2) as string | undefined;
  const filePath = Reflect.get(process.argv, 3) as string | undefined;
  if (filePath === undefined) throw new Error('a state or report path is required');
  if (command === 'teardown-preview') {
    const state = JSON.parse(await readText(filePath)) as SpikeState;
    process.stdout.write(`${teardownPreview(state).join(' ')}\n`);
    return;
  }
  if (command === 'validate-report') {
    validateSpikeReport(await readText(filePath));
    process.stdout.write('report valid\n');
    return;
  }
  throw new Error('expected teardown-preview or validate-report');
}

await main();
