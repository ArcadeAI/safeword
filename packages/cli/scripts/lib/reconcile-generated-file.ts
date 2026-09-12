import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

interface ReconcileGeneratedFileOptions {
  check: boolean;
  content: string;
  outputPath: string;
}

export type GeneratedFileReconciliation = 'current' | 'stale' | 'updated';

/** Resolve a direct generator's optional output without consuming an importing script's argv. */
export function generatedOutputPath(defaultPath: string, generatorEntrypoint: string): string {
  const invokedEntrypoint = process.argv[1];
  if (
    invokedEntrypoint === undefined ||
    nodePath.resolve(invokedEntrypoint) !== nodePath.resolve(generatorEntrypoint)
  ) {
    return defaultPath;
  }

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
  writeFileSync(outputPath, content);
  return 'updated';
}
