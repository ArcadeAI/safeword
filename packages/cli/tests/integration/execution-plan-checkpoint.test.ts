import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import {
  readExecutionCheckpoint,
  writeExecutionCheckpoint,
} from '../fixtures/execution-plan-live-checkpoint.js';

it.each([
  {
    label: 'missing confirmation',
    change: { confirmed_model: undefined },
    message: 'exact model confirmation',
  },
  {
    label: 'wrong model',
    change: { confirmed_model: { provider: 'anthropic', model: 'other-model' } },
    message: 'exact model confirmation',
  },
  {
    label: 'wrong provider',
    change: { confirmed_model: { provider: 'openai', model: 'claude-opus-5' } },
    message: 'exact model confirmation',
  },
  {
    label: 'unpaired output',
    change: { case_id: 'different-case' },
    message: 'exact model confirmation',
  },
  { label: 'CLI output', change: { dispatch_mode: 'cli' }, message: 'headless' },
  { label: 'replayed output', change: { dispatch_mode: 'replay' }, message: 'headless' },
])('rejects retained passing evidence with $label', ({ change, message }) => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'execution-provenance-'));
  const path = nodePath.join(root, 'results.json');
  const identity = {
    schema_version: 1,
    contract_sha256: 'contract',
    corpus_sha256: 'corpus',
    reviewer: 'claude',
    requested_model: 'claude-opus-5',
  };
  const result = { case_id: 'completed', reviewer: 'claude', model: 'claude-opus-5', passed: true };
  const output = {
    case_id: 'completed',
    dispatch_mode: 'headless',
    output: { verdict: 'approve' },
    confirmed_model: { provider: 'anthropic', model: 'claude-opus-5' },
  };
  try {
    writeExecutionCheckpoint(path, [result], [output], identity);
    expect(readExecutionCheckpoint(path, identity, ['completed']).results).toEqual([result]);
    writeExecutionCheckpoint(path, [result], [{ ...output, ...change }], identity);
    expect(() => readExecutionCheckpoint(path, identity, ['completed'])).toThrow(message);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

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

it.each(['metadata', 'results'])('refuses mixed generations after a %s write fails', stage => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'execution-interrupted-write-'));
  const path = nodePath.join(root, 'results.json');
  const identity = {
    schema_version: 1,
    contract_sha256: 'contract',
    corpus_sha256: 'corpus',
    reviewer: 'claude',
    requested_model: 'claude-opus-5',
  };
  const result = (case_id: string) => ({
    case_id,
    reviewer: 'claude',
    model: 'claude-opus-5',
    passed: true,
  });
  const output = (case_id: string) => ({
    case_id,
    dispatch_mode: 'headless',
    output: { verdict: 'approve' },
    confirmed_model: { provider: 'anthropic', model: 'claude-opus-5' },
  });
  try {
    writeExecutionCheckpoint(path, [result('old')], [output('old')], identity);
    expect(readExecutionCheckpoint(path, identity, ['old', 'new']).results).toEqual([
      result('old'),
    ]);
    const original = readFileSync(path, 'utf8');
    // Force an actual filesystem failure after raw outputs have been replaced.
    const target = stage === 'metadata' ? `${path}.metadata.json` : path;
    mkdirSync(`${target}.${process.pid}.tmp`);
    expect(() => {
      writeExecutionCheckpoint(path, [result('new')], [output('new')], identity);
    }).toThrow();
    expect(readFileSync(path, 'utf8')).toBe(original);
    expect(() => readExecutionCheckpoint(path, identity, ['old', 'new'])).toThrow(
      'exact model confirmation',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it.each([
  { label: 'matching', overrides: {}, launches: true, message: '' },
  {
    label: 'changed contract',
    overrides: { contract_sha256: 'changed-contract' },
    launches: false,
    message: 'Retained conformance metadata mismatch',
  },
  {
    label: 'acceptance',
    overrides: { corpus_kind: 'acceptance' },
    launches: false,
    message: 'exact headless conformance',
  },
  {
    label: 'CLI',
    overrides: { dispatch_mode: 'cli' },
    launches: false,
    message: 'exact headless conformance',
  },
  {
    label: 'runtime default',
    overrides: { requested_model: undefined },
    launches: false,
    message: 'exact headless conformance',
  },
  {
    label: 'replay',
    overrides: { mode: 'replay' },
    launches: false,
    message: 'exact headless conformance',
  },
])(
  'checks retained metadata before any reviewer launch ($label)',
  ({ overrides, launches, message }) => {
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
    const expected = { ...metadata, ...overrides };
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
      expect(child.status, child.stderr).toBe(launches ? 0 : 2);
      expect(existsSync(marker)).toBe(launches);
      if (!launches) expect(child.stderr).toContain(message);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);
