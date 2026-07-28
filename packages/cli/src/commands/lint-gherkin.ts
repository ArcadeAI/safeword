/**
 * `safeword lint-gherkin` — parser-backed Gherkin checks without pulling the
 * legacy `gherkin-lint` dependency tree into customer repos.
 */

import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { collectExecutableFeatureFiles } from '../utils/feature-source.js';
import { findGherkinLintIssues, type GherkinLintIssue } from '../utils/gherkin-feature.js';

export function lintGherkin(files: string[]): Promise<void> {
  const result = observeGherkinLint(process.cwd(), files);
  for (const error of result.errors) console.error(error.message);
  if (!result.ok) process.exit(1);
  return Promise.resolve();
}

export function observeGherkinLint(cwd: string, files: readonly string[]): CliResult {
  const featureFiles =
    files.length === 0 ? discoverFeatureFiles(cwd) : resolveInputFiles(cwd, files);
  const issues = featureFiles.flatMap(file => lintFile(cwd, file));
  if (issues.length === 0) {
    return createResult({
      state: 'healthy',
      data: { command: 'project lint-gherkin', files: featureFiles.length, arguments: files },
    });
  }

  return createResult({
    state: 'failed',
    errors: issues.map(issue => ({
      code: issue.code,
      message: issue.message,
      retryable: false,
    })),
    data: { command: 'project lint-gherkin', files: featureFiles.length, arguments: files },
  });
}

function resolveInputFiles(cwd: string, files: readonly string[]): string[] {
  return files.map(file => nodePath.resolve(cwd, file));
}

function discoverFeatureFiles(cwd: string): string[] {
  return collectExecutableFeatureFiles(cwd);
}

function lintFile(cwd: string, filePath: string): { code: string; message: string }[] {
  if (!existsSync(filePath)) {
    return [
      {
        code: 'GHERKIN_FILE_NOT_FOUND',
        message: `${formatPath(cwd, filePath)}: file not found [file-exists]`,
      },
    ];
  }

  const content = readFileSync(filePath, 'utf8');
  return findGherkinLintIssues(content, { filePath }).map(issue => ({
    code: `GHERKIN_${issue.rule.toUpperCase().replaceAll('-', '_')}`,
    message: formatIssue(cwd, filePath, issue),
  }));
}

function formatIssue(cwd: string, filePath: string, issue: GherkinLintIssue): string {
  const location =
    issue.line === undefined
      ? formatPath(cwd, filePath)
      : `${formatPath(cwd, filePath)}:${issue.line}`;
  return `${location}: ${issue.message} [${issue.rule}]`;
}

function formatPath(cwd: string, filePath: string): string {
  return nodePath.relative(cwd, filePath) || nodePath.basename(filePath);
}
