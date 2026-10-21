import { spawnSync } from 'node:child_process';
import { realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { type GoLintConfig, prepareGoLintConfig } from '../go-lint/config.js';
import { type GoLintOutput, goLintProcess } from '../go-lint/process.js';

export interface GoLintResult {
  warnings: string[];
  errors?: string;
  diagnosticContext?: string;
}
interface GoLintOptions {
  file?: string;
  projectRoot?: string;
  originalCwd?: string;
}

function within(file: string, root: string): boolean {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
function configPathInterpolation(cwd: string): boolean {
  const version = spawnSync('golangci-lint', ['version', '--short'], {
    cwd,
    encoding: 'utf8',
    timeout: 10_000,
  });
  const match = /^v?(\d+)\.(\d+)\./.exec(version.stdout.trim());
  if (version.error || version.status !== 0 || !match) {
    throw new Error('Cannot preserve Go lint policy: golangci-lint version could not be resolved');
  }
  // v2.0 expands only base-path; config-path was introduced in v2.1.
  return Number(match[1]) > 2 || (Number(match[1]) === 2 && Number(match[2]) >= 1);
}
function context(options: GoLintOptions) {
  if (!options.file || !options.projectRoot || !options.originalCwd) {
    throw new Error(
      'Go lint helper requires --file, --project-root and --original-cwd; update Safeword if hooks and runtime differ',
    );
  }
  const root = realpathSync(options.projectRoot);
  const file = realpathSync(options.file);
  if (!within(file, root)) {
    throw new Error(
      `Edited file ${file} resolves outside the Safeword project root ${root}; Go lint and formatting were skipped.`,
    );
  }
  return { root, file, cwd: path.dirname(file), originalCwd: realpathSync(options.originalCwd) };
}
function configWarnings(config: GoLintConfig, root: string): string[] {
  if (!config.source) {
    return [
      'Go Safeword config is missing — linting with golangci-lint defaults, not Safeword rules. Run `safeword install` to install it.',
    ];
  }
  if (!within(config.source, path.join(root, '.safeword'))) {
    return [
      `Go Safeword config is missing — linting with customer config ${config.source}. Run \`safeword install\` to layer Safeword rules.`,
    ];
  }
  return [];
}
function failure(command: string, result: GoLintOutput): string {
  const detail = result.stderr || result.stdout || `exit ${result.code} with no diagnostic output`;
  return `golangci-lint ${command} failed: ${detail}`;
}
function diagnostics(result: GoLintOutput, file: string, cwd: string): Partial<GoLintResult> {
  if (result.code === 0 || !result.stdout) return {};
  return {
    errors: result.stdout,
    diagnosticContext: `Go lint findings for package ${cwd} after editing ${file}. These findings may predate this edit; sibling files were not auto-fixed.`,
  };
}
function saveTextReport(config: GoLintConfig, output: string, warnings: string[]): void {
  if (!config.textReport) return;
  try {
    writeFileSync(config.textReport, `${output}\n`);
  } catch (error) {
    warnings.push(`Go lint report could not be written: ${String(error)}`);
  }
}

/** Internal hook action: load a whole package without widening the source edits. */
export async function goLint(options: GoLintOptions): Promise<GoLintResult> {
  const warnings: string[] = [];
  let config: GoLintConfig | undefined;
  let runner: ReturnType<typeof goLintProcess> | undefined;
  let findings: Partial<GoLintResult> = {};
  try {
    const { root, file, cwd, originalCwd } = context(options);
    config = prepareGoLintConfig(file, root, originalCwd, configPathInterpolation(originalCwd));
    warnings.push(...configWarnings(config, root));
    runner = goLintProcess(config.cleanup);
    const formatted = await runner.run(['fmt', ...config.args, file], cwd);
    if (formatted.code !== 0) warnings.push(failure('fmt', formatted));
    const checked = await runner.run(
      ['run', ...config.args, '--path-prefix', config.base, '.'],
      cwd,
    );
    saveTextReport(config, checked.stdout, warnings);
    findings = diagnostics(checked, file, cwd);
    if (checked.code !== 0 && !checked.stdout) warnings.push(failure('run', checked));
    if (checked.stderr) warnings.push(checked.stderr);
  } catch (error) {
    warnings.push(
      `Go lint could not run: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    runner?.dispose();
    try {
      config?.cleanup();
    } catch (error) {
      warnings.push(`Go lint temporary config cleanup failed: ${String(error)}`);
    }
  }
  return { warnings, ...findings };
}
