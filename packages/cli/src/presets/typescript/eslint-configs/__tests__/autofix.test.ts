/**
 * Tests for ESLint auto-fix - Story 3: Auto-fix Works
 *
 * Verifies that:
 * - Import sorting is auto-fixable
 * - Code style rules are auto-fixable
 * - After fix, no fixable errors remain
 */

import { fileURLToPath } from 'node:url';

import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

import { recommended } from '../recommended.js';

const linter = new Linter({ configType: 'flat' });

// Absolute path under __tests__ so sonarjs test-aware rules can resolve a topDir.
const MJS_FILE = fileURLToPath(new URL('inline.mjs', import.meta.url));

/**
 * Run verifyAndFix and return results.
 * @param code - Source code to lint and fix
 * @param filename - Filename for config matching
 */
function lintAndFix(code: string, filename = MJS_FILE) {
  return linter.verifyAndFix(code, recommended, { filename });
}

/**
 * Check if code has fixable errors.
 * @param code - Source code to check
 * @param filename - Filename for config matching
 */
function hasFixableErrors(code: string, filename = MJS_FILE) {
  return linter.verify(code, recommended, { filename }).some(r => r.fix !== undefined);
}

describe('Story 3: Auto-fix Works', () => {
  describe('import sorting', () => {
    it('fixes unsorted imports', () => {
      const messyCode = `import { z } from 'zod';
import { a } from 'alpha';
import fs from 'node:fs';

export const x = 1;
`;

      const result = lintAndFix(messyCode);

      // Should have been fixed
      expect(result.fixed).toBe(true);

      // Imports should now be sorted: node builtins, then packages alphabetically
      expect(result.output).toContain("import fs from 'node:fs'");
      const nodeImportIndex = result.output.indexOf("import fs from 'node:fs'");
      const alphaImportIndex = result.output.indexOf("import { a } from 'alpha'");
      const zodImportIndex = result.output.indexOf("import { z } from 'zod'");

      // node:fs should come first, then alpha, then zod
      expect(nodeImportIndex).toBeLessThan(alphaImportIndex);
      expect(alphaImportIndex).toBeLessThan(zodImportIndex);
    });

    it('leaves already-sorted imports unchanged', () => {
      const cleanCode = `import fs from 'node:fs';

import { a } from 'alpha';
import { z } from 'zod';

export const x = 1;
`;

      // Verify no import sorting fixes needed
      expect(hasFixableErrors(cleanCode)).toBe(false);
    });
  });

  describe('code style rules', () => {
    it('fixes no-unneeded-ternary: x ? true : false → x', () => {
      const messyCode = `export const isValid = someCondition ? true : false;
`;

      const result = lintAndFix(messyCode);

      expect(result.fixed).toBe(true);
      expect(result.output).not.toContain('? true : false');
    });

    it('fixes prefer-template: string concatenation → template literal', () => {
      const messyCode = `export const greeting = 'Hello ' + name + '!';
`;

      const result = lintAndFix(messyCode);

      expect(result.fixed).toBe(true);
      // ESLint's prefer-template auto-fix preserves spacing from original concatenation
      expect(result.output).toContain('`Hello ${');
      expect(result.output).toContain('name');
      expect(result.output).toContain('}!`');
    });

    it('fixes dot-notation: obj["prop"] → obj.prop', () => {
      const messyCode = `export const value = obj["property"];
`;

      const result = lintAndFix(messyCode);

      expect(result.fixed).toBe(true);
      expect(result.output).toContain('obj.property');
      expect(result.output).not.toContain('obj["property"]');
    });

    it('fixes object-shorthand: { foo: foo } → { foo }', () => {
      const messyCode = `const foo = 1;
export const obj = { foo: foo };
`;

      const result = lintAndFix(messyCode);

      expect(result.fixed).toBe(true);
      expect(result.output).toContain('{ foo }');
    });

    it('fixes prefer-object-spread: Object.assign → spread', () => {
      const messyCode = `export const merged = Object.assign({}, defaults, options);
`;

      const result = lintAndFix(messyCode);

      expect(result.fixed).toBe(true);
      expect(result.output).toContain('...defaults');
      expect(result.output).toContain('...options');
      expect(result.output).not.toContain('Object.assign');
    });

    it('fixes arrow-body-style: removes unnecessary block', () => {
      const messyCode = `export const add = (a, b) => { return a + b; };
`;

      const result = lintAndFix(messyCode);

      expect(result.fixed).toBe(true);
      expect(result.output).toContain('=> a + b');
      expect(result.output).not.toContain('{ return');
    });
  });

  describe('after fix, no fixable errors remain', () => {
    it('messy code has no fixable errors after fix', () => {
      const messyCode = `import { z } from 'zod';
import { a } from 'alpha';

const foo = 1;
export const obj = { foo: foo };
export const isValid = someCondition ? true : false;
export const greeting = 'Hello ' + name + '!';
`;

      // First, verify messy code HAS fixable errors
      expect(hasFixableErrors(messyCode)).toBe(true);

      // Fix it
      const result = lintAndFix(messyCode);
      expect(result.fixed).toBe(true);

      // After fix, should have no more fixable errors
      expect(hasFixableErrors(result.output)).toBe(false);
    });
  });
});
