import { readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { format, resolveConfig } from 'prettier';

import { EXECUTION_PLAN_ADMISSION_EVIDENCE } from '../src/review/execution-plan-admission.generated.js';
import {
  type ExecutionPlanAdmissionEvidence,
  type ExecutionPlanConformanceResult,
  renderExecutionPlanAdmissionEvidence,
} from '../src/review/execution-plan-conformance.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const outputPath = nodePath.join(packageRoot, 'src/review/execution-plan-admission.generated.ts');

function resultsFromEvidence(
  evidence: ExecutionPlanAdmissionEvidence,
): ExecutionPlanConformanceResult[] {
  return evidence.identities.flatMap(identity =>
    identity.case_ids.map(caseId => ({
      case_id: caseId,
      reviewer: identity.reviewer,
      ...(identity.model !== undefined && { model: identity.model }),
      passed: true,
    })),
  );
}

function resultPaths(args: readonly string[]): string[] {
  const paths: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== '--results') continue;
    const path = args[index + 1];
    if (path === undefined) throw new Error('--results requires a JSON file path');
    paths.push(path);
    index += 1;
  }
  return paths;
}

function readResults(paths: readonly string[]): ExecutionPlanConformanceResult[] {
  return paths.flatMap(path => {
    const value: unknown = JSON.parse(readFileSync(nodePath.resolve(path), 'utf8'));
    if (!Array.isArray(value)) throw new Error(`Execution Plan results must be an array: ${path}`);
    return value as ExecutionPlanConformanceResult[];
  });
}

const checkOnly = process.argv.includes('--check');
const argumentsAfterScript = process.argv.slice(2);
const results = checkOnly
  ? resultsFromEvidence(EXECUTION_PLAN_ADMISSION_EVIDENCE)
  : readResults(resultPaths(argumentsAfterScript));
const unformatted = renderExecutionPlanAdmissionEvidence(results);
const prettierConfig = await resolveConfig(outputPath);
const output = await format(unformatted, { ...prettierConfig, parser: 'typescript' });

if (checkOnly) {
  if (readFileSync(outputPath, 'utf8') !== output) {
    throw new Error('Generated Execution Plan admission evidence is stale');
  }
  console.log('Generated Execution Plan admission evidence is current.');
} else {
  if (readFileSync(outputPath, 'utf8') !== output) writeFileSync(outputPath, output);
  console.log('Generated Execution Plan admission evidence from complete passing matrices.');
}
