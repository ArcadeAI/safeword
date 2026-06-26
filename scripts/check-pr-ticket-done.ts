#!/usr/bin/env bun
/**
 * PR guard: if a ready PR includes a safeword ticket.md, the ticket closure
 * must ride that same PR.
 *
 * The workflow skips draft PRs. This script stays deliberately dumb: it receives
 * the PR changed-file list and checks the corresponding ticket.md frontmatter in
 * the current checkout.
 */

import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

interface Violation {
  ticketDirectory: string;
  reason: string;
}

function parseChangedFilesPath(arguments_: string[]): string | null {
  const index = arguments_.indexOf('--changed-files');
  if (index === -1) return null;
  return arguments_[index + 1] ?? null;
}

function changedTicketDirectories(changedFiles: string[]): string[] {
  const directories = new Set<string>();

  for (const file of changedFiles) {
    const match = /^(\.project|\.safeword-project)\/tickets\/([^/]+)\/ticket\.md$/.exec(file);
    if (!match) continue;

    const root = match[1];
    const folder = match[2];
    if (!root || !folder || folder === 'completed' || folder === 'tmp') continue;

    directories.add(`${root}/tickets/${folder}`);
  }

  return [...directories].sort();
}

function frontmatterValue(content: string, key: string): string | null {
  const frontmatterMatch = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!frontmatterMatch) return null;

  const pattern = new RegExp(`^${key}:\\s*([^\\n#]+)`, 'm');
  const valueMatch = pattern.exec(frontmatterMatch[1] ?? '');
  return valueMatch?.[1]?.trim() ?? null;
}

function validateTicketDirectory(
  projectDirectory: string,
  ticketDirectory: string,
): Violation | null {
  const ticketPath = nodePath.join(projectDirectory, ticketDirectory, 'ticket.md');
  if (!existsSync(ticketPath)) {
    return { ticketDirectory, reason: 'ticket.md is missing' };
  }

  const content = readFileSync(ticketPath, 'utf8');
  const status = frontmatterValue(content, 'status');
  if (status === 'done') return null;

  return {
    ticketDirectory,
    reason: `ticket.md has status: ${status ?? '(missing)'}`,
  };
}

const changedFilesPath = parseChangedFilesPath(process.argv.slice(2));
if (!changedFilesPath) {
  process.stderr.write('Usage: bun scripts/check-pr-ticket-done.ts --changed-files <path>\n');
  process.exit(2);
}

const changedFiles = readFileSync(changedFilesPath, 'utf8')
  .split('\n')
  .map(line => line.trim())
  .filter(Boolean);

const violations = changedTicketDirectories(changedFiles)
  .map(ticketDirectory => validateTicketDirectory(process.cwd(), ticketDirectory))
  .filter((violation): violation is Violation => violation !== null);

if (violations.length === 0) process.exit(0);

process.stderr.write('Safeword ticket closure must ride the ready PR.\n\n');
for (const violation of violations) {
  process.stderr.write(`  ${violation.ticketDirectory}/ticket.md: ${violation.reason}\n`);
}
process.stderr.write(
  '\nBefore marking the PR ready to merge, run /verify, let the done gate flip the ticket to `status: done`, and include that ticket.md change in this PR.\n',
);
process.exit(1);
