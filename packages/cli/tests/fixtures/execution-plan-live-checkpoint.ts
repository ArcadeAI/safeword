import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

function atomicJson(path: string, value: unknown): void {
  mkdirSync(nodePath.dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, undefined, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

/** Result replacement commits only after its raw observations and input metadata exist. */
export function writeExecutionCheckpoint(
  path: string,
  results: readonly unknown[],
  outputs: readonly unknown[],
  metadata: unknown,
): void {
  atomicJson(`${path}.outputs.json`, outputs);
  atomicJson(`${path}.metadata.json`, metadata);
  atomicJson(path, results);
}
