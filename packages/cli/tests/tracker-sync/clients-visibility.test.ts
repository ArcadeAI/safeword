import { describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));

import { execFileSync } from 'node:child_process';

import { buildWriterRegistry, resolveRepoVisibility } from '../../src/tracker-sync/clients.js';

/**
 * resolveRepoVisibility (JS5K5G AC10) — locks the public/private collapse and the
 * catch→undefined fail-safe the egress warning depends on. child_process is
 * mocked so no real `gh` is invoked.
 */
const mockExec = vi.mocked(execFileSync);

describe('resolveRepoVisibility', () => {
  it('returns undefined when no repo is configured', () => {
    expect(resolveRepoVisibility(undefined)).toBeUndefined();
  });

  it('maps gh PUBLIC to public', () => {
    mockExec.mockReturnValue('PUBLIC\n');
    expect(resolveRepoVisibility('acme/repo')).toBe('public');
  });

  it('maps gh PRIVATE to private', () => {
    mockExec.mockReturnValue('PRIVATE\n');
    expect(resolveRepoVisibility('acme/repo')).toBe('private');
  });

  it('returns undefined when gh fails (caller treats unknown as warn-worthy)', () => {
    mockExec.mockImplementation(() => {
      throw new Error('gh: command not found');
    });
    expect(resolveRepoVisibility('acme/repo')).toBeUndefined();
  });
});

describe('GitHub graph projection client', () => {
  it('uses gh issue edit graph flags for type, parent, and blocked-by refs', async () => {
    mockExec.mockReturnValue('');
    const writer = buildWriterRegistry('github', { repo: 'acme/repo' }).github;

    await writer.projectGraph(
      { provider: 'github', id: '42' },
      {
        title: 'Wire it up',
        body: 'banner',
        issueType: 'feature',
        labels: ['type:feature'],
        state: 'open',
      },
      {
        parent: { provider: 'github', id: '100' },
        blockedBy: [{ provider: 'github', id: '7' }],
      },
    );

    expect(mockExec).toHaveBeenCalledWith(
      'gh',
      [
        'issue',
        'edit',
        '42',
        '--type',
        'feature',
        '--parent',
        '100',
        '--add-blocked-by',
        '7',
        '--repo',
        'acme/repo',
      ],
      { encoding: 'utf8' },
    );
  });

  it('retries graph projection without --type when the repo has no matching issue type', async () => {
    const typeError = Object.assign(new Error('issue type not found'), {
      stderr: Buffer.from('issue type not found'),
    });
    mockExec.mockImplementationOnce(() => {
      throw typeError;
    });
    mockExec.mockReturnValue('');
    const writer = buildWriterRegistry('github', { repo: 'acme/repo' }).github;

    await writer.projectGraph(
      { provider: 'github', id: '42' },
      {
        title: 'Wire it up',
        body: 'banner',
        issueType: 'feature',
        labels: ['type:feature'],
        state: 'open',
      },
      { parent: { provider: 'github', id: '100' }, blockedBy: [] },
    );

    expect(mockExec).toHaveBeenLastCalledWith(
      'gh',
      ['issue', 'edit', '42', '--parent', '100', '--repo', 'acme/repo'],
      { encoding: 'utf8' },
    );
  });
});
