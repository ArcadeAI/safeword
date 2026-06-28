/**
 * Provider routing for `ticket new` (KKNFZA TB1.AC1): provider:none (or an
 * unsupported provider) stays on the local-id path; a configured GitHub/Linear
 * provider goes issue-first — `create` normally, `adopt` when `--issue` names an
 * existing key. Pure decision over config + options; no fs, no network.
 */

import { describe, expect, it } from 'vitest';

import { resolveCreationMode } from '../../src/commands/ticket-creation-mode.js';

describe('resolveCreationMode (tracker-identity-and-join.TB1.AC1)', () => {
  // no_tracker_is_local_as_today — provider:none routes to the local path
  it('routes provider:none to the local path', () => {
    expect(resolveCreationMode({ provider: 'none' }, {})).toEqual({ mode: 'local' });
  });

  // an unsupported provider is treated as none (sync-tracker AC1 parity)
  it('treats an unsupported provider as local', () => {
    expect(resolveCreationMode({ provider: 'jira' }, {})).toEqual({ mode: 'local' });
  });

  it('routes a configured GitHub provider with no --issue to create', () => {
    expect(resolveCreationMode({ provider: 'github' }, {})).toEqual({ mode: 'create' });
  });

  // existing_issue_is_adopted — --issue routes to adopt with that key
  it('routes --issue to adopt with the given key', () => {
    expect(resolveCreationMode({ provider: 'github' }, { issue: 'ENG-45' })).toEqual({
      mode: 'adopt',
      key: 'ENG-45',
    });
  });

  it('routes a Linear provider with --issue to adopt', () => {
    expect(resolveCreationMode({ provider: 'linear' }, { issue: '#7' })).toEqual({
      mode: 'adopt',
      key: '#7',
    });
  });

  // --issue with no connected provider is still local (nothing to adopt against)
  it('ignores --issue when no provider is configured', () => {
    expect(resolveCreationMode({ provider: 'none' }, { issue: 'ENG-45' })).toEqual({
      mode: 'local',
    });
  });
});
