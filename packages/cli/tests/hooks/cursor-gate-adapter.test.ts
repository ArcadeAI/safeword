import { describe, expect, it } from 'vitest';

import {
  classifyDoneTransition,
  claudeDenialReason,
  decideFromGate,
  detectDoneTransition,
  extractFilePath,
  extractWriteContent,
  GATE_UNAVAILABLE_REASON,
  mapCursorToolName,
  parseTicketType,
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
    it('pins Cursor Write path payload to file_path', () => {
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

  describe('extractWriteContent (AKNWZK done-edit)', () => {
    it('pins Cursor Write content payload to content', () => {
      expect(extractWriteContent({ content: '---\nstatus: done\n---\n' })).toBe(
        '---\nstatus: done\n---\n',
      );
    });

    it('tolerates alternate content field names', () => {
      expect(extractWriteContent({ contents: 'b' })).toBe('b');
      expect(extractWriteContent({ new_string: 'c' })).toBe('c');
    });

    it('reads Cursor file-edit new_string entries as a documented fallback', () => {
      expect(extractWriteContent({ edits: [{ new_string: 'status: done' }] })).toBe('status: done');
    });

    it('falls back to the longest multi-line string under an unknown field name', () => {
      const body = 'line one\nline two\nstatus: done\n';
      expect(extractWriteContent({ mystery_field: body, file_path: 'x/ticket.md' })).toBe(body);
    });

    it('returns undefined when there is no content-like value', () => {
      expect(extractWriteContent({ file_path: 'x/ticket.md' })).toBeUndefined();
      expect(extractWriteContent({})).toBeUndefined();
      expect(extractWriteContent(undefined)).toBeUndefined();
    });
  });

  describe('detectDoneTransition (AKNWZK done-edit)', () => {
    it('matches frontmatter that closes the ticket', () => {
      expect(detectDoneTransition('---\nstatus: done\n---')).toBe(true);
      expect(detectDoneTransition('---\nstatus: "done"\n---')).toBe(true);
      expect(detectDoneTransition('---\nstatus: done # verified manually\n---')).toBe(true);
    });

    it('does NOT match entering the done phase (phase: done, still in progress)', () => {
      expect(detectDoneTransition('---\nphase: done\nstatus: in_progress\n---')).toBe(false);
    });

    it('does NOT match prose mentioning done or other statuses', () => {
      expect(detectDoneTransition('We are status: in_progress and nearly done')).toBe(false);
      expect(detectDoneTransition('status: blocked')).toBe(false);
      expect(detectDoneTransition(undefined)).toBe(false);
    });

    it('classifies unreadable content as unknown and non-done statuses as not closing', () => {
      expect(classifyDoneTransition({ content: undefined })).toBe('unknown');
      expect(classifyDoneTransition({ content: '---\nstatus:\n---' })).toBe('not_done');
      expect(classifyDoneTransition({ content: '---\nstatus: done-ish\n---' })).toBe('not_done');
    });

    it('treats known and legacy non-done statuses as readable but not closing', () => {
      expect(classifyDoneTransition({ content: '---\nstatus: open\n---' })).toBe('not_done');
      expect(classifyDoneTransition({ content: '---\nstatus: cancelled\n---' })).toBe('not_done');
      expect(classifyDoneTransition({ content: '---\nstatus: superseded\n---' })).toBe('not_done');
      expect(classifyDoneTransition({ content: '---\nstatus: wontfix\n---' })).toBe('not_done');
      expect(classifyDoneTransition({ content: '---\nstatus: backlog\n---' })).toBe('not_done');
      expect(classifyDoneTransition({ content: '---\nstatus: pending\n---' })).toBe('not_done');
      expect(classifyDoneTransition({ content: '---\nstatus: complete\n---' })).toBe('not_done');
    });
  });

  describe('parseTicketType (AKNWZK done-edit)', () => {
    it('reads the type frontmatter', () => {
      expect(parseTicketType('---\ntype: feature\n---')).toBe('feature');
      expect(parseTicketType('---\ntype: task\n---')).toBe('task');
      expect(parseTicketType('---\ntype: Feature\n---')).toBe('feature');
    });

    it('returns undefined when type is absent', () => {
      expect(parseTicketType('---\nstatus: done\n---')).toBeUndefined();
      expect(parseTicketType(undefined)).toBeUndefined();
    });
  });

  describe('decideFromGate (ANAXG4 fail-closed)', () => {
    it('denies when the gate failed to run (crash / never started)', () => {
      // The whole point of ANAXG4: a broken gate must block, not silently allow.
      // stdout is empty here precisely because the gate crashed before emitting.
      expect(decideFromGate({ stdout: '', failed: true })).toEqual({
        permission: 'deny',
        user_message: GATE_UNAVAILABLE_REASON,
        agent_message: GATE_UNAVAILABLE_REASON,
      });
    });

    it('denies on failure even if partial stdout leaked before the crash', () => {
      expect(decideFromGate({ stdout: 'half-written', failed: true }).permission).toBe('deny');
    });

    it('allows when the gate ran cleanly and stayed silent', () => {
      expect(decideFromGate({ stdout: '', failed: false })).toEqual({ permission: 'allow' });
    });

    it('passes through a clean denial verdict from the gate', () => {
      const stdout = JSON.stringify({
        hookSpecificOutput: { permissionDecision: 'deny', permissionDecisionReason: 'no tests' },
      });
      expect(decideFromGate({ stdout, failed: false })).toEqual({
        permission: 'deny',
        user_message: 'no tests',
        agent_message: 'no tests',
      });
    });
  });
});
