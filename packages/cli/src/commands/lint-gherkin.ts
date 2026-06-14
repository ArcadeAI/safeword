/**
 * `safeword lint-gherkin` — parser-backed Gherkin checks without pulling the
 * legacy `gherkin-lint` dependency tree into customer repos.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { findGherkinLintIssues, type GherkinLintIssue } from '../utils/gherkin-feature.js';

export function lintGherkin(files: string[]): Promise<void> {
  lintGherkinSync(files);
  return Promise.resolve();
}

function lintGherkinSync(files: readonly string[]): void {
  const cwd = process.cwd();
  const featureFiles =
    files.length === 0 ? discoverFeatureFiles(cwd) : resolveInputFiles(cwd, files);
  const output = featureFiles.flatMap(file => lintFile(cwd, file));

  if (output.length === 0) return;

  for (const line of output) {
    console.error(line);
  }
  process.exit(1);
}

function resolveInputFiles(cwd: string, files: readonly string[]): string[] {
  return files.map(file => nodePath.resolve(cwd, file));
}

function discoverFeatureFiles(cwd: string): string[] {
  return [
    ...collectFeatureFiles(nodePath.join(cwd, 'features')),
    ...collectPackageFeatureFiles(nodePath.join(cwd, 'packages')),
  ];
}

function collectPackageFeatureFiles(packagesDirectory: string): string[] {
  if (!existsSync(packagesDirectory)) return [];
  return readdirSync(packagesDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .flatMap(entry =>
      collectFeatureFiles(nodePath.join(packagesDirectory, entry.name, 'features')),
    );
}

function collectFeatureFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = nodePath.join(directory, entry.name);
    if (entry.isDirectory()) return collectFeatureFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.feature') ? [fullPath] : [];
  });
}

function lintFile(cwd: string, filePath: string): string[] {
  if (!existsSync(filePath)) {
    return [`${formatPath(cwd, filePath)}: file not found [file-exists]`];
  }

  const content = readFileSync(filePath, 'utf8');
  return findGherkinLintIssues(content, { filePath }).map(issue =>
    formatIssue(cwd, filePath, issue),
  );
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
