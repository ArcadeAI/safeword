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

import { lookupGlossaryReference, parseGlossary, validateGlossary } from './glossary.js';

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

  describe('R3.5: empty term name produces an error', () => {
    it('flags a level-2 header with no name', () => {
      const content = ['##', '**Definition:** Orphan definition with no term.'].join('\n');
      const parsed = parseGlossary(content);

      const errors = validateGlossary(parsed);

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            line: 1,
            message: expect.stringContaining('missing term name'),
          }),
        ]),
      );
    });
  });

  describe('R3.4: alias that shadows an existing term name produces an error', () => {
    it('flags an alias colliding with a declared term name', () => {
      const content = [
        '## Tool',
        '**Definition:** A capability.',
        '**Aliases:** Widget',
        '',
        '## Widget',
        '**Definition:** A separate, real term.',
      ].join('\n');
      const parsed = parseGlossary(content);

      const errors = validateGlossary(parsed);

      const shadowErrors = errors.filter(error => error.message.includes('shadows term'));
      expect(shadowErrors).toHaveLength(1);
      // Error references Tool's entry line (where the offending alias lives).
      expect(shadowErrors[0]?.line).toBe(1);
      expect(shadowErrors[0]?.message).toContain('Widget');
    });
  });

  describe('R3.3: duplicate alias across terms produces errors pointing at both lines', () => {
    it('emits one error per duplicate alias, each referencing the other line', () => {
      const content = [
        '## Tool',
        '**Definition:** A capability.',
        '**Aliases:** Function',
        '',
        '## Capability',
        '**Definition:** Another thing.',
        '**Aliases:** Function',
      ].join('\n');
      const parsed = parseGlossary(content);

      const errors = validateGlossary(parsed);

      const aliasErrors = errors.filter(error => error.message.includes('duplicate alias'));
      expect(aliasErrors).toHaveLength(2);
      expect(aliasErrors.map(error => error.line).toSorted((a, b) => a - b)).toEqual([1, 5]);
      expect(aliasErrors.find(error => error.line === 1)?.message).toContain('5');
      expect(aliasErrors.find(error => error.line === 5)?.message).toContain('1');
    });
  });

  describe('R3.2: duplicate term name produces errors pointing at both lines', () => {
    it('emits one error per duplicate, each referencing the other line', () => {
      const content = [
        '## Tool',
        '**Definition:** First.',
        '',
        '## Tool',
        '**Definition:** Second.',
      ].join('\n');
      const parsed = parseGlossary(content);

      const errors = validateGlossary(parsed);

      const dupeErrors = errors.filter(error => error.message.includes('duplicate term'));
      expect(dupeErrors).toHaveLength(2);
      expect(dupeErrors.map(error => error.line).toSorted((a, b) => a - b)).toEqual([1, 4]);
      // Each error references the other's line.
      expect(dupeErrors.find(error => error.line === 1)?.message).toContain('4');
      expect(dupeErrors.find(error => error.line === 4)?.message).toContain('1');
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

describe('lookupGlossaryReference — pure resolution', () => {
  const sample = parseGlossary(
    [
      '## Tool',
      '**Definition:** A capability.',
      '**Aliases:** Function, Capability',
      '',
      '## Toolkit',
      '**Definition:** A collection of tools.',
    ].join('\n'),
  );

  describe('R7.1: exact term match returns valid', () => {
    it('resolves an exact name to a valid match', () => {
      const result = lookupGlossaryReference(sample, 'Tool');
      expect(result.status).toBe('valid');
      if (result.status !== 'valid') return;
      expect(result.match.name).toBe('Tool');
    });
  });
});
