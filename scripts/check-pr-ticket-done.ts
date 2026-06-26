#!/usr/bin/env bun
/**
 * PR guard: if a ready PR includes ticket completion evidence, the ticket
 * closure must ride that same PR.
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

interface Advisory {
  ticketDirectory: string;
  status: string;
}

interface TicketChange {
  ticketDirectory: string;
  ticketRecordChanged: boolean;
  verifyArtifactChanged: boolean;
}

interface TicketState {
  status: string | null;
  phase: string | null;
}

function parseChangedFilesPath(arguments_: string[]): string | null {
  const index = arguments_.indexOf('--changed-files');
  if (index === -1) return null;
  return arguments_[index + 1] ?? null;
}

function changedActiveTickets(changedFiles: string[]): TicketChange[] {
  const changes = new Map<string, TicketChange>();

  for (const file of changedFiles) {
    const match =
      /^(\.project|\.safeword-project)\/tickets\/([^/]+)\/(ticket\.md|verify\.md)$/.exec(file);
    if (!match) continue;

    const root = match[1];
    const folder = match[2];
    const filename = match[3];
    if (!root || !folder || folder === 'completed' || folder === 'tmp') continue;

    const ticketDirectory = `${root}/tickets/${folder}`;
    const change =
      changes.get(ticketDirectory) ??
      ({
        ticketDirectory,
        ticketRecordChanged: false,
        verifyArtifactChanged: false,
      } satisfies TicketChange);

    if (filename === 'ticket.md') change.ticketRecordChanged = true;
    if (filename === 'verify.md') change.verifyArtifactChanged = true;
    changes.set(ticketDirectory, change);
  }

  return [...changes.values()].sort((left, right) =>
    left.ticketDirectory.localeCompare(right.ticketDirectory),
  );
}

function frontmatterValue(content: string, key: string): string | null {
  const frontmatterMatch = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!frontmatterMatch) return null;

  const pattern = new RegExp(`^${key}:\\s*([^\\n#]+)`, 'm');
  const valueMatch = pattern.exec(frontmatterMatch[1] ?? '');
  return valueMatch?.[1]?.trim() ?? null;
}

function readTicketState(projectDirectory: string, ticketDirectory: string): TicketState | null {
  const ticketPath = nodePath.join(projectDirectory, ticketDirectory, 'ticket.md');
  if (!existsSync(ticketPath)) {
    return null;
  }

  const content = readFileSync(ticketPath, 'utf8');
  return {
    status: frontmatterValue(content, 'status'),
    phase: frontmatterValue(content, 'phase'),
  };
}

function validateTicketChange(
  projectDirectory: string,
  change: TicketChange,
): { violation: Violation | null; advisory: Advisory | null } {
  const ticketState = readTicketState(projectDirectory, change.ticketDirectory);
  if (!ticketState) {
    return {
      violation: { ticketDirectory: change.ticketDirectory, reason: 'ticket.md is missing' },
      advisory: null,
    };
  }

  if (ticketState.status === 'done') return { violation: null, advisory: null };

  if (ticketState.status === 'in_progress' && ticketState.phase === 'done') {
    return {
      violation: {
        ticketDirectory: change.ticketDirectory,
        reason: 'ticket.md has status: in_progress, phase: done',
      },
      advisory: null,
    };
  }

  if (ticketState.status === 'in_progress' && change.verifyArtifactChanged) {
    return {
      violation: {
        ticketDirectory: change.ticketDirectory,
        reason: 'verify.md changed but ticket.md still has status: in_progress',
      },
      advisory: null,
    };
  }

  return {
    violation: null,
    advisory: change.ticketRecordChanged
      ? {
          ticketDirectory: change.ticketDirectory,
          status: ticketState.status ?? '(missing)',
        }
      : null,
  };
}

function workflowCommandValue(value: string): string {
  return value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
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

const results = changedActiveTickets(changedFiles).map(change =>
  validateTicketChange(process.cwd(), change),
);
const violations = results
  .map(result => result.violation)
  .filter((violation): violation is Violation => violation !== null);
const advisories = results
  .map(result => result.advisory)
  .filter((advisory): advisory is Advisory => advisory !== null);

for (const advisory of advisories) {
  process.stdout.write(
    `::warning file=${advisory.ticketDirectory}/ticket.md,title=Safeword ticket still open::${workflowCommandValue(
      `This PR edits ${advisory.ticketDirectory}/ticket.md and leaves it at status: ${advisory.status}. If this PR completes the work, run /verify and include the done flip.`,
    )}\n`,
  );
}

if (violations.length === 0) process.exit(0);

process.stderr.write('Safeword ticket closure must ride the ready PR.\n\n');
for (const violation of violations) {
  process.stderr.write(`  ${violation.ticketDirectory}/ticket.md: ${violation.reason}\n`);
}
process.stderr.write(
  '\nThis PR includes completion evidence for the ticket. Before marking it ready to merge, run /verify, let the done gate flip the ticket to `status: done`, and include that ticket.md change in this PR.\n',
);
process.exit(1);
