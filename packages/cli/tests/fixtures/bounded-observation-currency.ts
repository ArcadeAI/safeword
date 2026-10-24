import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import {
  createObserverCandidate,
  expectCompleteObservation,
  type ObserverCandidate,
  type ObserverCommand,
  runObserverCli,
} from './bounded-observation.js';

const ticket = '.project/tickets/T3E4NS-keep-bounded-planning-reviews-trustworthy/ticket.md';
const audit =
  '.project/tickets/PPHQN5-observe-bounded-delivery-proof/evidence/observer-audit-summary.md';
export const requiredSource = 'packages/cli/tests/integration/planning-scope-review.test.ts';

export interface RetainedObserverProof {
  candidate: ObserverCandidate;
  observation: ObserverCommand;
  report: Buffer;
  terminal: Buffer;
}

export function candidateGit(candidate: ObserverCandidate, argv: string[]): string {
  return execFileSync('git', argv, {
    cwd: candidate.root,
    env: candidate.environment,
    encoding: 'utf8',
  }).trim();
}

export function candidateBytes(candidate: ObserverCandidate, paths: string[] = []): string {
  const files = candidateGit(candidate, ['ls-files', '-z', '--', ...paths])
    .split('\0')
    .filter(Boolean);
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file).update('\0');
    hash.update(readFileSync(nodePath.join(candidate.root, file))).update('\0');
  }
  return hash.digest('hex');
}

function commitChangedInput(candidate: ObserverCandidate): void {
  candidateGit(candidate, ['add', '--all']);
  candidateGit(candidate, [
    '-c',
    'core.hooksPath=/dev/null',
    '-c',
    'commit.gpgsign=false',
    '-c',
    'user.name=SYNTHETIC_OBSERVER',
    '-c',
    'user.email=observer@example.invalid',
    'commit',
    '--quiet',
    '-m',
    'Controlled observation currency change',
  ]);
  candidate.commit = candidateGit(candidate, ['rev-parse', 'HEAD']);
}

export function retainSuccessfulProof(candidate: ObserverCandidate): RetainedObserverProof {
  const observation = runObserverCli(candidate, ['proof', 'observe-bounded-delivery']);
  expectCompleteObservation(observation, candidate);
  const reportPath = observation.output.data?.report_path;
  assert.ok(reportPath);
  return {
    candidate,
    observation,
    report: readFileSync(reportPath),
    terminal: readFileSync(nodePath.join(nodePath.dirname(reportPath), 'terminal.json')),
  };
}

export function currencyCandidate(change: string): RetainedObserverProof {
  const candidate = createObserverCandidate();
  try {
    const retained = retainSuccessfulProof(candidate);
    switch (change) {
      case 'a committed edit to required assertion source': {
        appendFileSync(
          nodePath.join(candidate.root, requiredSource),
          '\n// Controlled source edit.\n',
        );
        commitChangedInput(candidate);
        break;
      }
      case "a committed edit to the ticket's accepted scope": {
        const path = nodePath.join(candidate.root, ticket);
        const original = readFileSync(path, 'utf8');
        assert.equal(original.split('\nscope:\n').length, 2);
        writeFileSync(
          path,
          original.replace('\nscope:\n', '\nscope:\n  - controlled scope expansion\n'),
        );
        commitChangedInput(candidate);
        break;
      }
      case 'an appended Work Log entry with all bound fields unchanged': {
        appendFileSync(
          nodePath.join(candidate.root, ticket),
          '\n- Controlled audit-only Work Log entry.\n',
        );
        break;
      }
      case 'a new audit summary that is not a loaded execution input': {
        writeFileSync(nodePath.join(candidate.root, audit), 'Controlled non-input audit output.\n');
        break;
      }
      default: {
        throw new Error(`Unknown accepted currency example ${change}`);
      }
    }
    return retained;
  } catch (error) {
    candidate.dispose();
    throw error;
  }
}

export function verifyRetainedProof(retained: RetainedObserverProof): ObserverCommand {
  const id = retained.observation.output.data?.attempt_id;
  assert.ok(id);
  return runObserverCli(retained.candidate, ['proof', 'verify-bounded-delivery', id]);
}

export function expectRetainedBytes(
  retained: RetainedObserverProof,
  report = retained.report,
): void {
  const path = retained.observation.output.data?.report_path;
  assert.ok(path);
  assert.deepEqual(
    readFileSync(path),
    report,
    'Retain the report bytes without rewriting evidence',
  );
  const terminalPath = nodePath.join(nodePath.dirname(path), 'terminal.json');
  assert.deepEqual(
    readFileSync(terminalPath),
    retained.terminal,
    'Read-only verification cannot rewrite the authenticated terminal record',
  );
}
