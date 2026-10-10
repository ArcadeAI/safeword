import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseFrontmatter } from '../../templates/hooks/lib/hierarchy.js';
import {
  createReviewedDispositionProject,
  suggestion,
  target,
  ticketId,
} from '../fixtures/planning-disposition.js';
import { cleanupTrustedReviewerDirectories } from '../review-fixtures.js';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
  cleanupTrustedReviewerDirectories();
});

async function reviewedProject() {
  return createReviewedDispositionProject(roots);
}

describe('user-owned planning review disposition', () => {
  it('preserves long ticket lists for the installed hook reader after a decline', async () => {
    const project = await reviewedProject();
    const longScope =
      'Preserve the authenticated approval of a planning review even when a contributor has written a detailed implementation note about the accepted behavior.';
    writeFileSync(
      project.ticketPath,
      readFileSync(project.ticketPath, 'utf8').replace(
        '  - preserve current approval',
        () =>
          `  - ${longScope}\n  - preserve current approval\nphase_skips:\n  - 'intake → define-behavior: approved scope already exists'\n  - 'scenario-gate → plan-implementation: accepted scenarios already exist'`,
      ),
    );
    const fresh = await project.run(['review', 'run', 'quality-review', target]);
    expect(fresh.exitCode, fresh.stdout).toBe(0);
    const reviewId = (JSON.parse(fresh.stdout).data as { review_id: string }).review_id;

    const confirmed = project.terminal('y', reviewId);
    expect(confirmed.status, `${confirmed.stdout}\n${confirmed.stderr}`).toBe(0);
    const frontmatter = readFileSync(project.ticketPath, 'utf8').split('---', 2)[1] ?? '';
    const parsed = parseFrontmatter(frontmatter);
    expect(parsed.scope).toEqual([longScope, 'preserve current approval']);
    expect(parsed.phase_skips).toHaveLength(2);
  });

  it('leaves an authenticated optional finding pending in noninteractive mode', async () => {
    const project = await reviewedProject();
    const before = readFileSync(project.ticketPath, 'utf8');
    const result = await project.run([
      'ticket',
      'record-review-disposition',
      ticketId,
      project.reviewId,
      '1',
      '--reason',
      'Outside the accepted scope.',
    ]);
    const output = JSON.parse(result.stdout);
    expect(output.state).toBe('action_required');
    expect(output.data).toMatchObject({ status: 'pending', review_id: project.reviewId });
    expect(JSON.stringify(output)).toContain(suggestion);
    expect(readFileSync(project.ticketPath, 'utf8')).toBe(before);
  });
  it('records an explicit local decline and stales the matching review', async () => {
    const project = await reviewedProject();
    const before = readFileSync(project.ticketPath, 'utf8');
    const refused = project.terminal('n', project.reviewId);
    expect(refused.stdout, refused.stderr).toContain('"status":"pending"');
    expect(readFileSync(project.ticketPath, 'utf8')).toBe(before);
    const confirmed = project.terminal('y', project.reviewId);
    expect(confirmed.status, `${confirmed.stdout}\n${confirmed.stderr}`).toBe(0);
    expect(readFileSync(project.ticketPath, 'utf8')).toContain('review_dispositions:');
    const status = await project.run(['review', 'status', project.reviewId]);
    expect(JSON.parse(status.stdout).data.status).toBe('stale');
    const fresh = await project.run(['review', 'run', 'quality-review', target]);
    expect(fresh.exitCode, `${fresh.stdout}\n${fresh.stderr}`).toBe(0);
    expect(fresh.stdout).toContain(
      `The user decline for ${suggestion} is current in ticket context.`,
    );
    expect(fresh.stdout).toContain(suggestion);
    writeFileSync(
      project.ticketPath,
      readFileSync(project.ticketPath, 'utf8').replace(
        'preserve current approval',
        'expand approval',
      ),
    );
    const changedBoundary = await project.run(['review', 'run', 'quality-review', target]);
    expect(changedBoundary.exitCode, `${changedBoundary.stdout}\n${changedBoundary.stderr}`).toBe(
      0,
    );
    expect(changedBoundary.stdout).toContain(
      `The user decline for ${suggestion} is superseded in ticket context.`,
    );
  });
  it('leaves the ticket untouched when another disposition writer owns its lock', async () => {
    const project = await reviewedProject();
    const before = readFileSync(project.ticketPath, 'utf8');
    writeFileSync(`${project.ticketPath}.review-disposition.lock`, String(process.pid));
    const result = project.terminal('y', project.reviewId);
    expect(result.stdout).toContain('REVIEW_DISPOSITION_WRITE_UNAVAILABLE');
    expect(readFileSync(project.ticketPath, 'utf8')).toBe(before);
    expect(readFileSync(`${project.ticketPath}.review-disposition.lock`, 'utf8')).toBe(
      String(process.pid),
    );
  });
  it('recovers a crashed disposition writer on retry', async () => {
    const project = await reviewedProject();
    const deadWriter = spawnSync(
      process.execPath,
      ['-e', 'process.stdout.write(String(process.pid))'],
      {
        encoding: 'utf8',
      },
    );
    expect(deadWriter.status).toBe(0);
    const lock = `${project.ticketPath}.review-disposition.lock`;
    writeFileSync(lock, deadWriter.stdout);
    const result = project.terminal('y', project.reviewId);
    expect(result.stdout).toContain('recorded');
    expect(readFileSync(project.ticketPath, 'utf8')).toContain('review_dispositions:');
    expect(existsSync(lock)).toBe(false);
  });
});
