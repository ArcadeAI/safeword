import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

/** Follow the actual installed asset's declaration; never substitute a project CLI. */
export function codexRuntimePath(asset: string, expectedRuntime: string): string {
  const body = readFileSync(asset, 'utf8');
  assert.ok(
    body.includes(
      'Before each shell block, assign SAFEWORD_PLUGIN_RUNTIME to that resolved absolute file path in a separate shell statement ending with a semicolon',
    ),
    'Missing generated runtime binding instruction',
  );
  const link = /\[the bundled Safeword runtime\]\(([^)]+)\)/u.exec(body)?.[1];
  assert.ok(link && !nodePath.isAbsolute(link), 'Missing relative packaged runtime declaration');
  const runtime = nodePath.resolve(nodePath.dirname(asset), link);
  assert.equal(runtime, expectedRuntime, 'Installed asset points outside its expected runtime');
  return runtime;
}

/** Apply the generated introduction's separate assignment before the actual shell block. */
export function codexRuntimeBinding(asset: string, expectedRuntime: string): string {
  const runtime = codexRuntimePath(asset, expectedRuntime);
  const quoted = runtime.replaceAll("'", String.raw`'\''`);
  return `SAFEWORD_PLUGIN_RUNTIME='${quoted}'; `;
}
