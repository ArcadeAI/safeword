import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

it('retains completed raw observations when the worker is killed before teardown', () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'execution-checkpoint-'));
  const path = nodePath.join(root, 'results.json');
  const helper = nodePath.resolve(
    import.meta.dirname,
    '../fixtures/execution-plan-live-checkpoint.ts',
  );
  const results = [
    { case_id: 'completed', reviewer: 'claude', model: 'claude-opus-5', passed: true },
  ];
  const outputs = [{ case_id: 'completed', output: { verdict: 'approve' } }];
  const metadata = { schema_version: 1, contract_sha256: 'contract', corpus_sha256: 'corpus' };
  try {
    const child = spawnSync(
      'bun',
      [
        '--eval',
        `
      import { writeExecutionCheckpoint } from ${JSON.stringify(helper)};
      writeExecutionCheckpoint(${JSON.stringify(path)}, ${JSON.stringify(results)}, ${JSON.stringify(outputs)}, ${JSON.stringify(metadata)});
      process.kill(process.pid, 'SIGKILL');
    `,
      ],
      { encoding: 'utf8' },
    );
    expect(child.signal, child.stderr).toBe('SIGKILL');
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(results);
    expect(JSON.parse(readFileSync(`${path}.outputs.json`, 'utf8'))).toEqual(outputs);
    expect(JSON.parse(readFileSync(`${path}.metadata.json`, 'utf8'))).toEqual(metadata);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
