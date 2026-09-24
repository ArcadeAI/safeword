#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import {
  buildColdStartPrompt,
  createAblationRecord,
  createEvaluationRecord,
  deriveNamedAblation,
  type EvaluationCase,
  type EvaluationContract,
  type EvaluationRecord,
  type EvaluationResponse,
  type StoredAblationRecord,
  verifyEvaluationCorpus,
  verifyEvaluationCorpusSafety,
  verifyEvaluationRecord,
  verifyStoredAblation,
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
  const adapter = arguments_.slice(index + 1);
  const misplacedFlag = adapter.find(argument => argument === '--guide' || argument === '--corpus');
  if (misplacedFlag !== undefined) {
    throw new Error(`${misplacedFlag} must appear before --adapter.`);
  }
  return adapter;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(entry => typeof entry === 'string');
}

function structuredOutput(value: unknown): unknown {
  return typeof value === 'object' && value !== null && 'structured_output' in value
    ? value.structured_output
    : value;
}

function parseAdapterResponse(stdout: string, caseId: string): EvaluationResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout) as unknown;
  } catch (error) {
    throw new Error(`Adapter response parsing failed for ${caseId}.`, { cause: error });
  }
  const candidate = structuredOutput(parsed);
  if (typeof candidate !== 'object' || candidate === null) {
    throw new Error(`Adapter response validation failed for ${caseId}: expected an object.`);
  }
  const decisionIds = 'decisionIds' in candidate ? candidate.decisionIds : undefined;
  const proofFactIds = 'proofFactIds' in candidate ? candidate.proofFactIds : undefined;
  if (!isStringArray(decisionIds) || !isStringArray(proofFactIds)) {
    throw new Error(
      `Adapter response validation failed for ${caseId}: expected decisionIds and proofFactIds string arrays.`,
    );
  }
  return { decisionIds, proofFactIds };
}

function recordResponse(
  adapter: readonly string[],
  prompt: string,
  caseId: string,
): EvaluationResponse {
  const command = adapter[0];
  if (command === undefined) throw new Error('Adapter command is empty.');
  const workingDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-data-eval-'));
  try {
    const result = spawnSync(command, adapter.slice(1), {
      cwd: workingDirectory,
      encoding: 'utf8',
      input: prompt,
      timeout: 120_000,
    });
    if (result.error !== undefined) {
      throw new Error(`Adapter process failed for ${caseId}: ${result.error.message}`);
    }
    if (result.status !== 0) {
      throw new Error(`Adapter failed for ${caseId}: ${result.stderr.trim()}`);
    }
    return parseAdapterResponse(result.stdout, caseId);
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
  const safety = verifyEvaluationCorpusSafety({ cases: input.cases, contract: input.contract });
  if (!safety.accepted) throw new Error(safety.diagnostics.join('\n'));
  const pendingWrites: { path: string; value: unknown }[] = [{ path: recordsPath, value: records }];

  const ablationConfig = input.contract.ablation;
  if (ablationConfig !== undefined) {
    const evaluationCase = input.cases.find(item => item.id === ablationConfig.caseId);
    const fullGuideRecord = records.find(item => item.caseId === ablationConfig.caseId);
    if (evaluationCase === undefined || fullGuideRecord === undefined) {
      throw new Error(
        `Ablation case ${ablationConfig.caseId} is missing from the evaluation corpus.`,
      );
    }
    const ablatedGuide = deriveNamedAblation(input.canonicalGuide, ablationConfig.id);
    if (ablatedGuide === undefined) {
      throw new Error(`Canonical guide does not define one ${ablationConfig.id} transform.`);
    }
    const storedAblation: StoredAblationRecord = {
      ablationId: ablationConfig.id,
      caseId: evaluationCase.id,
      record: createAblationRecord({
        guide: ablatedGuide,
        evaluationCase,
        contract: input.contract,
        response: recordResponse(
          adapter,
          buildColdStartPrompt(ablatedGuide, evaluationCase),
          `${evaluationCase.id}:ablation`,
        ),
      }),
    };
    const result = verifyStoredAblation({
      canonicalGuide: input.canonicalGuide,
      contract: input.contract,
      evaluationCase,
      fullGuideRecord,
      stored: storedAblation,
    });
    if (!result.accepted) {
      throw new Error(result.diagnostics.map(diagnostic => `[ablation] ${diagnostic}`).join('\n'));
    }
    pendingWrites.push({
      path: nodePath.join(input.corpusDirectory, 'ablation-record.json'),
      value: storedAblation,
    });
  }

  for (const pending of pendingWrites) {
    writeFileSync(`${pending.path}.tmp`, `${JSON.stringify(pending.value, undefined, 2)}\n`, {
      mode: 0o600,
    });
  }
  for (const pending of pendingWrites) renameSync(`${pending.path}.tmp`, pending.path);
  process.stdout.write(
    `Recorded ${records.length} data architecture evaluation records${ablationConfig === undefined ? '' : ' and 1 ablation record'}.\n`,
  );
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
  const safety = verifyEvaluationCorpusSafety({ cases: input.cases, contract: input.contract });
  const diagnostics = [...result.diagnostics, ...safety.diagnostics];
  const ablationConfig = input.contract.ablation;
  if (ablationConfig !== undefined) {
    const evaluationCase = input.cases.find(item => item.id === ablationConfig.caseId);
    const fullGuideRecord = records.find(item => item.caseId === ablationConfig.caseId);
    if (evaluationCase === undefined || fullGuideRecord === undefined) {
      diagnostics.push(`Ablation case ${ablationConfig.caseId} is missing from the corpus.`);
    } else {
      const stored = readJson(
        nodePath.join(input.corpusDirectory, 'ablation-record.json'),
      ) as StoredAblationRecord;
      const ablation = verifyStoredAblation({
        canonicalGuide: input.canonicalGuide,
        contract: input.contract,
        evaluationCase,
        fullGuideRecord,
        stored,
      });
      diagnostics.push(...ablation.diagnostics.map(diagnostic => `[ablation] ${diagnostic}`));
    }
  }
  if (diagnostics.length > 0) {
    process.stderr.write(`${diagnostics.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }
  const suffix = records.length === 1 ? 'record' : 'records';
  process.stdout.write(
    `Verified ${records.length} data architecture evaluation ${suffix}${ablationConfig === undefined ? '' : ' and 1 ablation record'}.\n`,
  );
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
