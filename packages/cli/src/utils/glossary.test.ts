/**
 * Unit tests for glossary parsing, validation, and lookup (ticket YR6C49).
 *
 * Covers the pure-function scenarios in
 * `.safeword-project/tickets/YR6C49/test-definitions.md` — entry-shape
 * parsing, skip-mask semantics, structural validation, and lookup
 * (exact/alias/case-mismatch/unknown).
 *
 * Integration tests for `safeword setup` / `safeword check` glossary
 * behavior live under `tests/commands/`. File-IO behavior for
 * `validateGlossaryReference` lives under
 * `tests/utils/glossary-ref.test.ts` (sibling — separate file because
 * it needs filesystem fixtures).
 */

import { describe, expect, it } from 'vitest';

import { parseGlossary, validateGlossary } from './glossary.js';

describe('validateGlossary — structural errors', () => {
  describe('R3.1: missing **Definition:** produces an error', () => {
    it('error message mentions "missing Definition" and points at the header line', () => {
      const content = ['## Tool', '', 'This block has no Definition line.'].join('\n');
      const parsed = parseGlossary(content);

      const errors = validateGlossary(parsed);

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            line: 1,
            message: expect.stringContaining('missing Definition'),
          }),
        ]),
      );
    });
  });
});

describe('parseGlossary — skip-mask (non-term content)', () => {
  describe('R2.3: inline <!-- ... --> on header line is stripped from name', () => {
    it('returns clean name without comment text', () => {
      const content = [
        '## Tool <!-- legacy note -->',
        '',
        '**Definition:** A single callable capability.',
      ].join('\n');

      const entries = parseGlossary(content);

      expect(entries).toHaveLength(1);
      const [entry] = entries;
      expect(entry).toBeDefined();
      if (!entry) return;
      expect(entry.name).toBe('Tool');
    });
  });

  describe('R2.2: header inside HTML comment block is not parsed as a term', () => {
    it('treats <!-- ... --> region as opaque', () => {
      const content = [
        '## Tool',
        '',
        '**Definition:** A single callable capability.',
        '',
        '<!--',
        '## CommentedTerm',
        '**Definition:** This is commented out and should not be parsed.',
        '-->',
      ].join('\n');

      const entries = parseGlossary(content);

      expect(entries.map(entry => entry.name)).toEqual(['Tool']);
    });
  });

  describe('R2.1: header inside fenced code block is not parsed as a term', () => {
    it('treats triple-backtick fenced content as opaque', () => {
      const content = [
        '## Tool',
        '',
        '**Definition:** A single callable capability.',
        '',
        'Example markdown:',
        '',
        '```markdown',
        '## Example',
        '**Definition:** This is inside a code fence and should not be parsed.',
        '```',
      ].join('\n');

      const entries = parseGlossary(content);

      expect(entries.map(entry => entry.name)).toEqual(['Tool']);
    });
  });
});

describe('parseGlossary — canonical entry shapes', () => {
  describe('R1.1: minimal entry (Term + Definition only)', () => {
    it('parses to one entry with name and definition; optional fields absent', () => {
      const content = ['## Tool', '', '**Definition:** A single callable capability.'].join('\n');

      const entries = parseGlossary(content);

      expect(entries).toHaveLength(1);
      const [entry] = entries;
      expect(entry).toBeDefined();
      if (!entry) return;
      expect(entry.name).toBe('Tool');
      expect(entry.definition).toBe('A single callable capability.');
      expect(entry.usedIn).toBeUndefined();
      expect(entry.example).toBeUndefined();
      expect(entry.doNotConfuseWith).toBeUndefined();
      expect(entry.aliases).toEqual([]);
    });
  });

  describe('R1.5: arcade **Used in**: (colon outside bold) parses identically', () => {
    it('captures usedIn the same way as the colon-inside variant', () => {
      const content = [
        '## Tool',
        '',
        '**Definition:** A single callable capability.',
        '**Used in**: Engine, MCP servers',
      ].join('\n');

      const entries = parseGlossary(content);

      expect(entries).toHaveLength(1);
      const [entry] = entries;
      expect(entry).toBeDefined();
      if (!entry) return;
      expect(entry.usedIn).toBe('Engine, MCP servers');
    });
  });

  describe('R1.6: multi-line field value accumulates continuation lines', () => {
    it('joins wrapped Definition lines with spaces; blank line terminates the field', () => {
      const content = [
        '## Tool',
        '',
        '**Definition:** A single callable capability exposed by Arcade — for example,',
        '`GitHub.CreateIssue` or `Slack.SendMessage`. Each tool has a typed input schema,',
        'executes a specific operation, and returns a structured result.',
        '',
        '**Used in:** Engine, MCP servers.',
      ].join('\n');

      const entries = parseGlossary(content);

      expect(entries).toHaveLength(1);
      const [entry] = entries;
      expect(entry).toBeDefined();
      if (!entry) return;
      expect(entry.definition).toBe(
        'A single callable capability exposed by Arcade — for example, ' +
          '`GitHub.CreateIssue` or `Slack.SendMessage`. Each tool has a typed input schema, ' +
          'executes a specific operation, and returns a structured result.',
      );
      // Blank line terminated the Definition — Used in is a separate field.
      expect(entry.usedIn).toBe('Engine, MCP servers.');
    });
  });

  describe('R1.4: unknown **Field:** is tolerated', () => {
    it('does not error and does not surface unknown field as parsed content', () => {
      const content = [
        '## Tool',
        '',
        '**Definition:** A single callable capability.',
        '**SomeFutureField:** speculative value',
      ].join('\n');

      const entries = parseGlossary(content);

      expect(entries).toHaveLength(1);
      const [entry] = entries;
      expect(entry).toBeDefined();
      if (!entry) return;
      // Definition still captured normally.
      expect(entry.definition).toBe('A single callable capability.');
      // Unknown field not surfaced on any known property.
      expect((entry as Record<string, unknown>).someFutureField).toBeUndefined();
      expect((entry as Record<string, unknown>).SomeFutureField).toBeUndefined();
    });
  });

  describe('R1.3: aliases line parses into list', () => {
    it('splits comma-separated aliases and trims whitespace per item', () => {
      const content = [
        '## Tool',
        '',
        '**Definition:** A single callable capability.',
        '**Aliases:** Function, Capability',
      ].join('\n');

      const entries = parseGlossary(content);

      expect(entries).toHaveLength(1);
      const [entry] = entries;
      expect(entry).toBeDefined();
      if (!entry) return;
      expect(entry.aliases).toEqual(['Function', 'Capability']);
    });
  });

  describe('R1.2: rich entry (all 4 optional fields populated)', () => {
    it('captures Definition, Used in, Example, and Do not confuse with', () => {
      const content = [
        '## Tool',
        '',
        '**Definition:** A single callable capability.',
        '**Used in:** Engine, MCP servers.',
        '**Example:** `When the agent calls "GitHub.CreateIssue"`',
        '**Do not confuse with:** Toolkit — a tool is a single operation.',
      ].join('\n');

      const entries = parseGlossary(content);

      expect(entries).toHaveLength(1);
      const [entry] = entries;
      expect(entry).toBeDefined();
      if (!entry) return;
      expect(entry.name).toBe('Tool');
      expect(entry.definition).toBe('A single callable capability.');
      expect(entry.usedIn).toBe('Engine, MCP servers.');
      expect(entry.example).toBe('`When the agent calls "GitHub.CreateIssue"`');
      expect(entry.doNotConfuseWith).toBe('Toolkit — a tool is a single operation.');
    });
  });
});
