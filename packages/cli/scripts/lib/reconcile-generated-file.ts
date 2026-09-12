import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

interface ReconcileGeneratedFileOptions {
  check: boolean;
  content: string;
  outputPath: string;
}

export type GeneratedFileReconciliation = 'current' | 'stale' | 'updated';

interface GeneratedRubricOptions {
  content: string;
  defaultOutputPath: string;
  generateCommand: string;
  generatorEntrypoint: string;
  label: string;
}

function isDirectGeneratorInvocation(generatorEntrypoint: string): boolean {
  const invokedEntrypoint = process.argv[1];
  return (
    invokedEntrypoint !== undefined &&
    realpathSync(invokedEntrypoint) === realpathSync(generatorEntrypoint)
  );
}

/** Resolve a direct generator's optional output without consuming an importing script's argv. */
function generatedOutputPath(defaultPath: string, generatorEntrypoint: string): string {
  if (!isDirectGeneratorInvocation(generatorEntrypoint)) return defaultPath;

  let outputPath = defaultPath;
  for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (argument === '--check') continue;
    if (argument !== '--output') throw new Error(`Unknown argument: ${argument}`);
    const requestedPath = process.argv[index + 1];
    if (requestedPath === undefined || requestedPath.startsWith('-')) {
      throw new Error('--output requires a path');
    }
    outputPath = nodePath.resolve(requestedPath);
    index += 1;
  }
  return outputPath;
}

/** Verify generated output in check mode, or update it without touching an identical file. */
export function reconcileGeneratedFile({
  check,
  content,
  outputPath,
}: ReconcileGeneratedFileOptions): GeneratedFileReconciliation {
  const stale = !existsSync(outputPath) || readFileSync(outputPath, 'utf8') !== content;
  if (check) return stale ? 'stale' : 'current';
  if (!stale) return 'current';
  mkdirSync(nodePath.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, content);
  return 'updated';
}

/** Reconcile one generated runtime rubric and report its stable CLI result. */
export function runGeneratedRubric(options: GeneratedRubricOptions): void {
  const outputPath = generatedOutputPath(options.defaultOutputPath, options.generatorEntrypoint);
  const check =
    isDirectGeneratorInvocation(options.generatorEntrypoint) && process.argv.includes('--check');
  const reconciliation = reconcileGeneratedFile({
    check,
    content: options.content,
    outputPath,
  });
  const description = `Generated ${options.label} runtime rubric at ${outputPath}`;

  if (reconciliation === 'stale') {
    console.error(`${description} is stale; run ${options.generateCommand}`);
    process.exitCode = 1;
  } else if (check) {
    console.log(`${description} is current.`);
  } else if (reconciliation === 'current') {
    const sentenceLabel = `${options.label[0]?.toUpperCase()}${options.label.slice(1)}`;
    console.log(`${sentenceLabel} runtime rubric is already current.`);
  } else {
    console.log(`Generated the ${options.label} runtime rubric.`);
  }
}
