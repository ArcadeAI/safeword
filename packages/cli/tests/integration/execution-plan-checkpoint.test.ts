import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

it.each([true, false])(
  'checks retained metadata before any reviewer launch (matching: %s)',
  matching => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'execution-reuse-'));
    const path = nodePath.join(root, 'results.json');
    const marker = nodePath.join(root, 'launched');
    const helper = nodePath.resolve(
      import.meta.dirname,
      '../fixtures/execution-plan-live-checkpoint.ts',
    );
    const metadata = {
      schema_version: 1,
      contract_sha256: 'contract',
      corpus_sha256: 'corpus',
      reviewer: 'claude',
      requested_model: 'claude-opus-5',
    };
    const expected = { ...metadata, contract_sha256: matching ? 'contract' : 'changed-contract' };
    writeFileSync(
      path,
      JSON.stringify([
        { case_id: 'completed', reviewer: 'claude', model: 'claude-opus-5', passed: true },
      ]),
    );
    writeFileSync(`${path}.metadata.json`, JSON.stringify(metadata));
    writeFileSync(
      `${path}.outputs.json`,
      JSON.stringify([
        {
          case_id: 'completed',
          dispatch_mode: 'headless',
          output: { verdict: 'approve' },
          confirmed_model: { provider: 'anthropic', model: 'claude-opus-5' },
        },
      ]),
    );
    try {
      const child = spawnSync(
        'bun',
        [
          '--eval',
          `
      import { readExecutionCheckpoint } from ${JSON.stringify(helper)};
      import { writeFileSync } from 'node:fs';
      try {
        const retained = readExecutionCheckpoint(${JSON.stringify(path)}, ${JSON.stringify(expected)}, ['completed']);
        if (retained.results.length !== 1) throw new Error('Missing retained result');
        writeFileSync(${JSON.stringify(marker)}, 'would launch');
      } catch (error) { console.error(error.message); process.exit(2); }
    `,
        ],
        { encoding: 'utf8' },
      );
      expect(child.status, child.stderr).toBe(matching ? 0 : 2);
      expect(existsSync(marker)).toBe(matching);
      if (!matching) expect(child.stderr).toContain('Retained conformance metadata mismatch');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);
