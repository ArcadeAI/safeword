import { describe, expect, it, vi } from 'vitest';

import type { SmokeCommandExecutor } from '../../scripts/run-pr-review-disposable-smoke.js';
import {
  cleanupSmokeResources,
  createSmokeCommandClients,
  resolveSmokeConfig,
} from '../../scripts/run-pr-review-disposable-smoke.js';

describe('advisory PR review disposable smoke boundary', () => {
  it('binds both tokens to the fixed sandbox repositories', () => {
    const config = resolveSmokeConfig({
      GH_TOKEN: 'base-token',
      SAFEWORD_PR_REVIEW_SMOKE_FORK_TOKEN: 'fork-token',
    });

    expect(config).toEqual({
      baseRepo: 'ArcadeAI/safeword-pr-review-smoke-base',
      baseToken: 'base-token',
      forkOwner: 'TheMostlyGreat',
      forkRepo: 'TheMostlyGreat/safeword-pr-review-smoke-base',
      forkToken: 'fork-token',
    });
  });

  it('fails before any command when either installation token is missing', () => {
    expect(() => resolveSmokeConfig({ GH_TOKEN: 'base-token' })).toThrow(
      'GH_TOKEN and SAFEWORD_PR_REVIEW_SMOKE_FORK_TOKEN are required',
    );
  });

  it('routes GitHub and Git mutations through the token for their repository', () => {
    const execute = vi.fn<SmokeCommandExecutor>(() => 'ok');
    const clients = createSmokeCommandClients(execute, 'base-token', 'fork-token');

    clients.baseGh(['api', 'repos/ArcadeAI/safeword-pr-review-smoke-base']);
    clients.forkGh(['api', 'repos/TheMostlyGreat/safeword-pr-review-smoke-base']);
    clients.baseGit(['push', 'origin', 'main'], '/base');
    clients.forkGit(['push', 'origin', 'smoke'], '/fork');

    expect(execute).toHaveBeenNthCalledWith(
      1,
      'gh',
      ['api', 'repos/ArcadeAI/safeword-pr-review-smoke-base'],
      expect.objectContaining({ env: expect.objectContaining({ GH_TOKEN: 'base-token' }) }),
    );
    expect(execute).toHaveBeenNthCalledWith(
      2,
      'gh',
      ['api', 'repos/TheMostlyGreat/safeword-pr-review-smoke-base'],
      expect.objectContaining({ env: expect.objectContaining({ GH_TOKEN: 'fork-token' }) }),
    );
    expect(execute).toHaveBeenNthCalledWith(
      3,
      'git',
      ['push', 'origin', 'main'],
      expect.objectContaining({ cwd: '/base' }),
    );
    expect(execute).toHaveBeenNthCalledWith(
      4,
      'git',
      ['push', 'origin', 'smoke'],
      expect.objectContaining({ cwd: '/fork' }),
    );
    expect(execute.mock.calls[2]?.[2]?.env?.GIT_CONFIG_VALUE_0).toContain(
      Buffer.from('x-access-token:base-token').toString('base64'),
    );
    expect(execute.mock.calls[3]?.[2]?.env?.GIT_CONFIG_VALUE_0).toContain(
      Buffer.from('x-access-token:fork-token').toString('base64'),
    );
  });

  it('attempts every cleanup action and reports all failures', () => {
    const baseGh = vi.fn(() => {
      throw new Error('close failed');
    });
    const forkGh = vi.fn(() => {
      throw new Error('branch failed');
    });
    const removeDirectory = vi.fn(() => {
      throw new Error('directory failed');
    });

    const errors = cleanupSmokeResources({
      baseGh,
      baseRepo: 'ArcadeAI/safeword-pr-review-smoke-base',
      branch: 'smoke-branch',
      directory: '/tmp/smoke',
      forkGh,
      forkRepo: 'TheMostlyGreat/safeword-pr-review-smoke-base',
      pullNumber: 42,
      removeDirectory,
    });

    expect(baseGh).toHaveBeenCalledWith([
      'pr',
      'close',
      '42',
      '--repo',
      'ArcadeAI/safeword-pr-review-smoke-base',
    ]);
    expect(forkGh).toHaveBeenCalledWith([
      'api',
      '--method',
      'DELETE',
      'repos/TheMostlyGreat/safeword-pr-review-smoke-base/git/refs/heads/smoke-branch',
    ]);
    expect(removeDirectory).toHaveBeenCalledWith('/tmp/smoke');
    expect(errors.map(error => error.message)).toEqual([
      'close pull request: close failed',
      'delete fork branch: branch failed',
      'remove local fixture: directory failed',
    ]);
  });
});
