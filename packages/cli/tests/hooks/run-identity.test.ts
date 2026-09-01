import { describe, expect, it } from 'vitest';

import { getRunStorageKey, resolveRunIdentity } from '../../templates/hooks/lib/run-identity.js';

describe('run identity normalization (WHFTDK)', () => {
  it('normalizes Claude session_id into the shared identity contract', () => {
    const identity = resolveRunIdentity(
      { session_id: 'claude-session' },
      { runtime: 'claude', env: {} },
    );

    expect(identity.runtime).toBe('claude');
    expect(identity.sessionKey).toBe('claude-session');
    expect(identity.turnKey).toBeNull();
    expect(identity.source).toBe('input.session_id');
    expect(getRunStorageKey(identity)).toBe('claude-claude-session');
  });

  it('normalizes Codex session_id and turn_id into durable and turn keys', () => {
    const identity = resolveRunIdentity(
      { session_id: 'codex-session', turn_id: 'turn-42' },
      { runtime: 'codex', env: {} },
    );

    expect(identity).toEqual({
      runtime: 'codex',
      sessionKey: 'codex-session',
      turnKey: 'turn-42',
      source: 'input.session_id',
    });
    expect(getRunStorageKey(identity)).toBe('codex-codex-session');
  });

  it('normalizes OpenCode session_id and turn_id without colliding with other runtimes', () => {
    const identity = resolveRunIdentity(
      { session_id: 'shared-session', turn_id: 'turn-9' },
      { runtime: 'opencode', env: {} },
    );

    expect(identity).toEqual({
      runtime: 'opencode',
      sessionKey: 'shared-session',
      turnKey: 'turn-9',
      source: 'input.session_id',
    });
    expect(getRunStorageKey(identity)).toBe('opencode-shared-session');
  });

  it('falls back to CODEX_THREAD_ID as a Codex session when the payload omits session_id', () => {
    const identity = resolveRunIdentity(
      { turn_id: 'per-turn-id' },
      { runtime: 'codex', env: { CODEX_THREAD_ID: 'desktop-thread' } },
    );

    expect(identity).toEqual({
      runtime: 'codex',
      sessionKey: 'desktop-thread',
      turnKey: 'per-turn-id',
      source: 'CODEX_THREAD_ID',
    });
    expect(getRunStorageKey(identity)).toBe('codex-desktop-thread');
  });

  it('keeps a Codex payload session_id ahead of CODEX_THREAD_ID', () => {
    const identity = resolveRunIdentity(
      { session_id: 'hook-session' },
      { runtime: 'codex', env: { CODEX_THREAD_ID: 'desktop-thread' } },
    );

    expect(identity.sessionKey).toBe('hook-session');
    expect(identity.source).toBe('input.session_id');
  });

  it('does not treat a Codex turn id as a session when no durable identity is available', () => {
    const identity = resolveRunIdentity({ turn_id: 'per-turn-id' }, { runtime: 'codex', env: {} });

    expect(identity.sessionKey).toBeNull();
    expect(identity.turnKey).toBe('per-turn-id');
    expect(identity.source).toBe('missing');
  });

  it('does not let CODEX_THREAD_ID override an explicitly selected non-Codex runtime', () => {
    const identity = resolveRunIdentity(
      {},
      { runtime: 'claude', env: { CODEX_THREAD_ID: 'desktop-thread' } },
    );

    expect(identity.runtime).toBe('claude');
    expect(identity.sessionKey).toBeNull();
    expect(identity.turnKey).toBeNull();
    expect(identity.source).toBe('missing');
  });

  it('keeps a detected Claude environment ahead of CODEX_THREAD_ID', () => {
    const identity = resolveRunIdentity(
      {},
      {
        env: { CLAUDE_SESSION_ID: 'claude-session', CODEX_THREAD_ID: 'desktop-thread' },
      },
    );

    expect(identity.runtime).toBe('claude');
    expect(identity.sessionKey).toBe('claude-session');
  });

  it('normalizes Cursor conversation_id and generation_id into durable and turn keys', () => {
    const identity = resolveRunIdentity({
      conversation_id: 'cursor-conversation',
      generation_id: 'generation-7',
    });

    expect(identity).toEqual({
      runtime: 'cursor',
      sessionKey: 'cursor-conversation',
      turnKey: 'generation-7',
      source: 'input.conversation_id',
    });
    expect(getRunStorageKey(identity)).toBe('cursor-cursor-conversation');
  });

  it('keeps identical raw ids distinct by runtime when computing storage keys', () => {
    const rawId = 'same-id';
    const keys = [
      getRunStorageKey(resolveRunIdentity({ session_id: rawId }, { runtime: 'claude', env: {} })),
      getRunStorageKey(resolveRunIdentity({ session_id: rawId }, { runtime: 'codex', env: {} })),
      getRunStorageKey(resolveRunIdentity({ session_id: rawId }, { runtime: 'opencode', env: {} })),
      getRunStorageKey(
        resolveRunIdentity({ conversation_id: rawId }, { runtime: 'cursor', env: {} }),
      ),
    ];

    expect(new Set(keys).size).toBe(4);
    expect(keys).toEqual(['claude-same-id', 'codex-same-id', 'opencode-same-id', 'cursor-same-id']);
  });

  it('reports unknown when no durable runtime identity is available', () => {
    const identity = resolveRunIdentity({}, { env: {} });

    expect(identity.runtime).toBe('unknown');
    expect(identity.sessionKey).toBeNull();
    expect(identity.turnKey).toBeNull();
    expect(identity.source).toBe('missing');
    expect(getRunStorageKey(identity)).toBeNull();
  });
});
