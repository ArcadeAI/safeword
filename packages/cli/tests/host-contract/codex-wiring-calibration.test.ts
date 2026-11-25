import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { calibrationView } from '../../scripts/check-codex-wiring-calibration.js';
import corpus from '../fixtures/host-contract/codex-wiring-calibration.json' with { type: 'json' };
import { controlledGrader } from '../helpers/codex-controlled-grader.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it.each(['correct', 'wrong', 'unavailable'])(
  'runs the real fixed24 driver with controlled process outcomes: %s (nonreceipt)',
  mode => {
    const root = mkdtempSync(path.join(tmpdir(), 'calibration-process-control-'));
    roots.push(root);
    const responses = corpus.cases.flatMap(sample => [sample.expected, sample.expected]);
    if (mode === 'wrong') responses[0] = !responses[0];
    const control = controlledGrader(root, {
      responses,
      fault: mode === 'unavailable' ? 'missing-model' : 'ok',
    });
    roots.push(control.bin);
    const output = path.join(root, 'result.json');
    const repo = path.resolve(import.meta.dirname, '../../../..');
    const run = spawnSync(
      path.join(repo, 'scripts/dev'),
      [
        'bun',
        path.join(repo, 'packages/cli/scripts/check-codex-wiring-calibration.ts'),
        '--require-targets',
        '--output',
        output,
        ...(mode === 'unavailable' ? [] : ['--auth-profile', control.authProfile]),
      ],
      { env: control.environment, encoding: 'utf8', timeout: 170_000 },
    );
    expect(run.error, run.stderr).toBeUndefined();
    const completedExit = mode === 'wrong' ? 2 : 0;
    expect(run.status, run.stderr).toBe(mode === 'unavailable' ? 3 : completedExit);
    const result = JSON.parse(readFileSync(output, 'utf8'));
    expect(result.attempts).toHaveLength(mode === 'unavailable' ? 1 : 24);
    expect(result.complete).toBe(mode !== 'unavailable');
    expect(result.passed).toBe(mode === 'correct');
    expect(result.declared_candidate_baseline.observed).toBe(false);
    const count = readFileSync(path.join(control.bin, 'sequence.json'), 'utf8');
    expect(JSON.parse(count)).toBe(result.attempts.length);
    expect(
      new Set(
        result.attempts.map((attempt: { binding: { project: string } }) => attempt.binding.project),
      ).size,
    ).toBe(result.attempts.length);
    for (const attempt of result.attempts)
      expect(existsSync(path.join(attempt.binding.profile, 'auth.json'))).toBe(false);
    expect(readFileSync(path.join(control.authProfile, 'auth.json'), 'utf8')).toBe(
      '{"nonreceipt":"opaque-control"}',
    );
    if (mode === 'correct') {
      const validation = spawnSync(
        path.join(repo, 'scripts/dev'),
        [
          'bun',
          path.join(
            repo,
            'packages/cli/tests/fixtures/host-contract/validate-isolated-calibration.mjs',
          ),
          output,
          control.authProfile,
        ],
        { env: control.environment, encoding: 'utf8', timeout: 60_000 },
      );
      expect(validation.status, validation.stderr).toBe(0);
      expect(JSON.parse(validation.stdout)).toEqual({
        authenticated: 24,
        rejected: 9,
        nonreceipt: true,
      });
    }
  },
  180_000,
);

it.each([false, true])('rejects output in a hashed input root before dispatch, alias=%s', alias => {
  const repo = path.resolve(import.meta.dirname, '../../../..');
  const root = mkdtempSync(
    path.join(repo, 'packages/cli/tests/fixtures/host-contract/output-control-'),
  );
  roots.push(root);
  const control = controlledGrader(root);
  roots.push(control.bin);
  const outside = mkdtempSync(path.join(tmpdir(), 'calibration-output-alias-'));
  roots.push(outside);
  symlinkSync(root, path.join(outside, 'alias'));
  const output = path.join(alias ? path.join(outside, 'alias') : root, 'result.json');
  const run = spawnSync(
    path.join(repo, 'scripts/dev'),
    [
      'bun',
      path.join(repo, 'packages/cli/scripts/check-codex-wiring-calibration.ts'),
      '--require-targets',
      '--output',
      output,
      '--auth-profile',
      control.authProfile,
    ],
    { env: control.environment, encoding: 'utf8', timeout: 15_000 },
  );
  expect(run.status).not.toBe(0);
  expect(existsSync(output)).toBe(false);
  expect(readdirSync(root).some(file => file.startsWith('wiring-calibration-'))).toBe(false);
  expect(existsSync(path.join(control.bin, 'observations.jsonl'))).toBe(false);
});
it('delivers every fixed synthetic claim without labels, arms or model cues', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'calibration-view-control-'));
  roots.push(root);
  const ids = new Set<string>();
  for (const [index, sample] of corpus.cases.entries()) {
    const directory = path.join(root, String(index));
    mkdirSync(directory);
    const text = calibrationView(directory, index);
    const view = JSON.parse(text);
    expect(Object.keys(view)).toEqual(['claim', 'projects']);
    const project = view.projects[0];
    expect(Object.keys(project)).toEqual(['id', 'files', 'review']);
    expect(Object.keys(project.files)).toEqual(['clamp.js', 'clamp.test.js']);
    expect(project.review.findings.map((finding: { message: string }) => finding.message)).toEqual(
      sample.messages,
    );
    for (const cue of [
      sample.id,
      'claude-opus-5',
      'gpt-6-astra',
      'defective',
      'covered',
      'expected',
    ])
      expect(text).not.toContain(cue);
    ids.add(project.id);
  }
  expect(ids.size).toBe(12);
  expect(corpus.repetitions).toBe(2);
});
