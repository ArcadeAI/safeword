import { describe, expect, it } from 'vitest';

import {
  claudeDenialReason,
  extractFilePath,
  mapCursorToolName,
  toCursorDecision,
} from '../../templates/hooks/cursor/gate-adapter.js';

describe('Cursor gate adapter helpers (T3DV1K)', () => {
  describe('mapCursorToolName', () => {
    it('maps the Cursor edit tool to Claude Write', () => {
      expect(mapCursorToolName('Write')).toBe('Write');
    });

    it('maps the Cursor shell tool to Claude Bash', () => {
      expect(mapCursorToolName('Shell')).toBe('Bash');
    });

    it('returns undefined for tools the gate does not handle', () => {
      expect(mapCursorToolName('Read')).toBeUndefined();
      expect(mapCursorToolName('Grep')).toBeUndefined();
      expect(mapCursorToolName(undefined)).toBeUndefined();
    });
  });

  describe('extractFilePath', () => {
    it('reads the documented file_path field', () => {
      expect(extractFilePath({ file_path: 'src/app.ts' })).toBe('src/app.ts');
    });

    it('tolerates alternate path field names', () => {
      expect(extractFilePath({ path: 'src/a.ts' })).toBe('src/a.ts');
      expect(extractFilePath({ target_file: 'src/b.ts' })).toBe('src/b.ts');
    });

    it('returns undefined when no path is present', () => {
      expect(extractFilePath({})).toBeUndefined();
      expect(extractFilePath(undefined)).toBeUndefined();
      expect(extractFilePath({ file_path: '' })).toBeUndefined();
    });
  });

  describe('claudeDenialReason', () => {
    it('extracts the reason from a deny payload', () => {
      const stdout = JSON.stringify({
        hookSpecificOutput: {
          permissionDecision: 'deny',
          permissionDecisionReason: 'no test-definitions.md',
        },
      });
      expect(claudeDenialReason(stdout)).toBe('no test-definitions.md');
    });

    it('treats empty, allow, and malformed output as allow (undefined)', () => {
      expect(claudeDenialReason('')).toBeUndefined();
      expect(claudeDenialReason(' '.repeat(3))).toBeUndefined();
      expect(
        claudeDenialReason(JSON.stringify({ hookSpecificOutput: { permissionDecision: 'allow' } })),
      ).toBeUndefined();
      expect(claudeDenialReason('not json')).toBeUndefined();
    });

    it('falls back to a generic reason when deny carries no string reason', () => {
      const stdout = JSON.stringify({ hookSpecificOutput: { permissionDecision: 'deny' } });
      expect(claudeDenialReason(stdout)).toBe('Safeword denied this action.');
    });
  });

  describe('toCursorDecision', () => {
    it('allows when there is no denial reason', () => {
      expect(toCursorDecision(undefined)).toEqual({ permission: 'allow' });
    });

    it('denies with the reason on both user and agent channels', () => {
      expect(toCursorDecision('blocked')).toEqual({
        permission: 'deny',
        user_message: 'blocked',
        agent_message: 'blocked',
      });
    });
  });
});
