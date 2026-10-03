import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { measureRelayDrainThroughput } from './relay-drain-measurement.js';

function outputPath(arguments_: string[]): string {
  const flag = arguments_.indexOf('--output');
  const value = flag === -1 ? undefined : arguments_[flag + 1];
  if (flag === -1 || value === undefined || value.trim().length === 0) {
    throw new Error('usage: measure-relay-drain-throughput --output <artifact.json>');
  }
  return path.resolve(value);
}

// Real clock and real waits: this produces readiness evidence, so it must
// measure the machine it runs on.
const output = outputPath(process.argv.slice(2));
const artifact = await measureRelayDrainThroughput();
await writeFile(output, `${JSON.stringify(artifact, undefined, 2)}\n`, 'utf8');
