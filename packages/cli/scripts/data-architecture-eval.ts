#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import {
  buildColdStartPrompt,
  createEvaluationRecord,
  type EvaluationCase,
  type EvaluationContract,
  type EvaluationRecord,
  type EvaluationResponse,
  verifyEvaluationCorpus,
  verifyEvaluationCorpusSafety,
  verifyEvaluationRecord,
} from './lib/data-architecture-eval.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const defaultCorpusDirectory = nodePath.join(packageRoot, 'tests/fixtures/data-architecture-eval');
const defaultGuidePath = nodePath.join(packageRoot, 'templates/guides/data-architecture-guide.md');

function flagValue(arguments_: readonly string[], flag: string, fallback: string): string {
  const index = arguments_.indexOf(flag);
  return index === -1 ? fallback : (arguments_[index + 1] ?? fallback);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function loadInputs(arguments_: readonly string[]): {
  canonicalGuide: string;
  cases: EvaluationCase[];
  contract: EvaluationContract;
  corpusDirectory: string;
} {
  const guidePath = nodePath.resolve(flagValue(arguments_, '--guide', defaultGuidePath));
  const corpusDirectory = nodePath.resolve(
    flagValue(arguments_, '--corpus', defaultCorpusDirectory),
  );
  return {
    canonicalGuide: readFileSync(guidePath, 'utf8'),
    cases: readJson(nodePath.join(corpusDirectory, 'cases.json')) as EvaluationCase[],
    contract: readJson(nodePath.join(corpusDirectory, 'contract.json')) as EvaluationContract,
    corpusDirectory,
  };
}

function adapterArgv(arguments_: readonly string[]): string[] {
  const index = arguments_.indexOf('--adapter');
  if (index === -1 || arguments_[index + 1] === undefined) {
    throw new Error('record requires --adapter followed by a structured command argv.');
  }
  return arguments_.slice(index + 1);
}

function recordResponse(
  adapter: readonly string[],
  prompt: string,
  caseId: string,
): EvaluationResponse {
  const workingDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-data-eval-'));
  try {
    const result = spawnSync(adapter[0], adapter.slice(1), {
      cwd: workingDirectory,
      encoding: 'utf8',
      input: prompt,
      timeout: 120_000,
    });
    if (result.error !== undefined) throw result.error;
    if (result.status !== 0) {
      throw new Error(`Adapter failed for ${caseId}: ${result.stderr.trim()}`);
    }
    const parsed = JSON.parse(result.stdout) as {
      readonly decisionIds?: readonly string[];
      readonly proofFactIds?: readonly string[];
      readonly structured_output?: EvaluationResponse;
    };
    return parsed.structured_output ?? (parsed as EvaluationResponse);
  } finally {
    rmSync(workingDirectory, { recursive: true, force: true });
  }
}

function record(arguments_: readonly string[]): void {
  const input = loadInputs(arguments_);
  const adapter = adapterArgv(arguments_);
  const records = input.cases.map(evaluationCase => {
    const prompt = buildColdStartPrompt(input.canonicalGuide, evaluationCase);
    const evaluationRecord = createEvaluationRecord({
      canonicalGuide: input.canonicalGuide,
      contract: input.contract,
      evaluationCase,
      response: recordResponse(adapter, prompt, evaluationCase.id),
    });
    const result = verifyEvaluationRecord({
      canonicalGuide: input.canonicalGuide,
      contract: input.contract,
      evaluationCase,
      record: evaluationRecord,
    });
    if (!result.accepted) {
      throw new Error(
        result.diagnostics.map(diagnostic => `[${evaluationCase.id}] ${diagnostic}`).join('\n'),
      );
    }
    return evaluationRecord;
  });
  const recordsPath = nodePath.join(input.corpusDirectory, 'records.json');
  const safety = verifyEvaluationCorpusSafety({ cases: input.cases, records });
  if (!safety.accepted) throw new Error(safety.diagnostics.join('\n'));
  const temporaryPath = `${recordsPath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(records, undefined, 2)}\n`, { mode: 0o600 });
  renameSync(temporaryPath, recordsPath);
  process.stdout.write(`Recorded ${records.length} data architecture evaluation records.\n`);
}

function verify(arguments_: readonly string[]): void {
  const input = loadInputs(arguments_);
  const records = readJson(
    nodePath.join(input.corpusDirectory, 'records.json'),
  ) as EvaluationRecord[];
  const result = verifyEvaluationCorpus({
    canonicalGuide: input.canonicalGuide,
    cases: input.cases,
    contract: input.contract,
    records,
  });
  const safety = verifyEvaluationCorpusSafety({ cases: input.cases, records });
  const diagnostics = [...result.diagnostics, ...safety.diagnostics];
  if (diagnostics.length > 0) {
    process.stderr.write(`${diagnostics.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }
  const suffix = records.length === 1 ? 'record' : 'records';
  process.stdout.write(`Verified ${records.length} data architecture evaluation ${suffix}.\n`);
}

const [mode, ...arguments_] = process.argv.slice(2);
try {
  if (mode === 'record') record(arguments_);
  else if (mode === 'verify') verify(arguments_);
  else throw new Error('Usage: data-architecture-eval.ts <record|verify> [options]');
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
