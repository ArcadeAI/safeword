import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { gunzipSync } from 'node:zlib';

import {
  EXECUTION_PLAN_CONFORMANCE_CASES,
  executionPlanConformanceDigests,
  type ExecutionPlanConformanceResult,
} from '../../../packages/cli/src/review/execution-plan-conformance.js';

const root = nodePath.resolve(import.meta.dirname, '../../..');
const checkpoint = 'f821a6689';
const inputs = ['runtime.ts', 'contract.ts', 'evidence-record.ts', 'review-rubric.ts',
  'quality-rubric.generated.ts', 'execution-plan-rubric.generated.ts', 'execution-plan-conformance.ts']
  .map(name => `packages/cli/src/review/${name}`);
inputs.push('packages/cli/src/execution-plan/delivery-checklist.ts');

function requireProof(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function argument(name: string): string {
  const value = process.argv[process.argv.indexOf(name) + 1];
  requireProof(process.argv.includes(name) && value !== undefined, `${name} requires a path`);
  return nodePath.resolve(root, value);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function packetConstructor(source: string): string {
  const match = /function packetFor\([\s\S]*?\n\}\n/u.exec(source);
  requireProof(match !== null, 'Missing packetFor constructor');
  return match[0];
}

function preservedFirst(): ExecutionPlanConformanceResult[] {
  const path = argument('--first');
  const directory = nodePath.dirname(path);
  const manifest = readJson(nodePath.join(directory, 'manifest.json')) as {
    files: { path: string; sha256_uncompressed: string; uncompressed_bytes: number }[];
  };
  for (const name of ['execution-first-case.json.gz', 'execution-first-case.json.outputs.json.gz', 'execution-first-case.log.gz']) {
    const bytes = gunzipSync(readFileSync(nodePath.join(directory, name)));
    const entry = manifest.files.find(file => file.path === name);
    requireProof(entry?.sha256_uncompressed === createHash('sha256').update(bytes).digest('hex') &&
      entry.uncompressed_bytes === bytes.length, `Preserved archive differs: ${name}`);
  }
  const first = JSON.parse(gunzipSync(readFileSync(path)).toString()) as ExecutionPlanConformanceResult[];
  requireProof(first.length === 1 && first[0]?.case_id === 'one-coherent-change' &&
    first[0].reviewer === 'claude' && first[0].model === 'claude-opus-5' && first[0].passed,
    'Preserved first observation does not match its retained identity');
  execFileSync('git', ['diff', '--exit-code', checkpoint, '--', ...inputs], { cwd: root });
  const harness = 'packages/cli/tests/smoke/execution-plan.live.test.ts';
  const earlier = execFileSync('git', ['show', `${checkpoint}:${harness}`], { cwd: root, encoding: 'utf8' });
  requireProof(packetConstructor(earlier) === packetConstructor(readFileSync(nodePath.join(root, harness), 'utf8')),
    'Changed packet constructor prevents first-case reuse');
  console.log('Preserved first-case archive and unchanged inputs verified; historical model confirmation remains unretained.');
  return first;
}

function currentMatrix(path: string, reviewer: string, model: string, ids: readonly string[]): ExecutionPlanConformanceResult[] {
  const results = readJson(path) as ExecutionPlanConformanceResult[];
  const metadata = readJson(`${path}.metadata.json`) as Record<string, unknown>;
  const outputs = readJson(`${path}.outputs.json`) as {
    case_id: string; confirmed_model?: { provider: string; model: string };
  }[];
  const digests = executionPlanConformanceDigests();
  requireProof(metadata.schema_version === 1 && metadata.reviewer === reviewer && metadata.requested_model === model &&
    metadata.contract_sha256 === digests.contract_sha256 && metadata.corpus_sha256 === digests.corpus_sha256,
    `Current metadata does not match ${reviewer}/${model}`);
  requireProof(Array.isArray(results) && results.length === ids.length &&
    new Set(results.map(result => result.case_id)).size === ids.length &&
    results.every(result => ids.includes(result.case_id) && result.reviewer === reviewer && result.model === model && result.passed),
    `Missing, duplicate or failing observations: ${path}`);
  requireProof(Array.isArray(outputs) && outputs.length === ids.length &&
    new Set(outputs.map(output => output.case_id)).size === ids.length &&
    outputs.every(output => ids.includes(output.case_id) && output.confirmed_model?.model === model &&
      output.confirmed_model.provider === (reviewer === 'claude' ? 'anthropic' : 'openai')),
    `Missing exact model confirmation or raw observations: ${path}`);
  return results;
}

const first = preservedFirst();
if (!process.argv.includes('--check-first-only')) {
  const ids = EXECUTION_PLAN_CONFORMANCE_CASES.map(testCase => testCase.id);
  currentMatrix(argument('--claude'), 'claude', 'claude-opus-5', ids.filter(id => id !== 'one-coherent-change'));
  currentMatrix(argument('--codex'), 'codex', 'gpt-6-astra', ids);
  const verified = nodePath.join(root, '.project/tmp/5139-first-case-verified.json');
  mkdirSync(nodePath.dirname(verified), { recursive: true });
  writeFileSync(verified, `${JSON.stringify(first, undefined, 2)}\n`, { mode: 0o600 });
  execFileSync(nodePath.join(root, 'scripts/dev'), ['bun', 'packages/cli/scripts/generate-execution-plan-admission.ts',
    '--results', verified, '--results', argument('--claude'), '--results', argument('--codex')], { cwd: root, stdio: 'inherit' });
}
