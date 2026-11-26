import { lstatSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import nodePath from 'node:path';

export async function publishFreshDirectory(
  output: string,
  generate: (stagingDirectory: string) => Promise<void>,
): Promise<void> {
  try {
    lstatSync(output);
    throw new Error(`Output already exists: ${output}`);
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
  }
  const parent = nodePath.dirname(output);
  mkdirSync(parent, { recursive: true });
  const staging = mkdtempSync(nodePath.join(parent, `.${nodePath.basename(output)}.tmp-`));
  let published = false;
  try {
    await generate(staging);
    renameSync(staging, output);
    published = true;
  } finally {
    if (!published) rmSync(staging, { recursive: true, force: true });
  }
}
