import { describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));

import { execFileSync } from 'node:child_process';

import { resolveRepoVisibility } from '../../src/tracker-sync/clients.js';

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
