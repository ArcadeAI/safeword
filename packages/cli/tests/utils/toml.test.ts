import { describe, expect, it } from 'vitest';

import {
  isTomlTableEmptyArray,
  readTomlTableArray,
  readTomlTableString,
} from '../../src/utils/toml.js';

describe('readTomlTableArray', () => {
  it('reads a multi-line array scoped to its table', () => {
    const toml = [
      '[tool.uv.workspace]',
      'members = [',
      '    "packages/*",',
      '    "app",',
      ']',
      '',
    ].join('\n');
    expect(readTomlTableArray(toml, 'tool.uv.workspace', 'members')).toEqual(['packages/*', 'app']);
  });

  it('reads a single-line array', () => {
    expect(
      readTomlTableArray(
        '[project]\ndependencies = ["requests", "numpy"]\n',
        'project',
        'dependencies',
      ),
    ).toEqual(['requests', 'numpy']);
  });

  it('returns undefined when the table is absent', () => {
    expect(
      readTomlTableArray('[project]\nname = "x"\n', 'tool.uv.workspace', 'members'),
    ).toBeUndefined();
  });

  it('returns undefined when the key is absent in the table', () => {
    expect(
      readTomlTableArray('[tool.uv.workspace]\nexclude = ["a"]\n', 'tool.uv.workspace', 'members'),
    ).toBeUndefined();
  });

  it('does not read a same-named key from a different table', () => {
    const toml = [
      '[other]',
      'members = ["WRONG"]',
      '',
      '[tool.uv.workspace]',
      'members = ["right/*"]',
      '',
    ].join('\n');
    expect(readTomlTableArray(toml, 'tool.uv.workspace', 'members')).toEqual(['right/*']);
  });

  it('does not let a comment closing bracket truncate the array', () => {
    const toml = '[workspace]\nmembers = [\n  "a", # crates[] note\n  "b",\n]\n';
    expect(readTomlTableArray(toml, 'workspace', 'members')).toEqual(['a', 'b']);
  });
});

describe('readTomlTableString', () => {
  it('reads a string value scoped to its table', () => {
    expect(
      readTomlTableString('[project]\nname = "my-pkg"\nversion = "1"\n', 'project', 'name'),
    ).toBe('my-pkg');
  });

  it('returns undefined when the table is absent', () => {
    expect(readTomlTableString('[tool.poetry]\nname = "x"\n', 'project', 'name')).toBeUndefined();
  });

  it('does not mistake a [[bin]] name for the table key', () => {
    const toml = '[project]\nname = "real"\n\n[[tool.x.bin]]\nname = "wrong"\n';
    expect(readTomlTableString(toml, 'project', 'name')).toBe('real');
  });
});

describe('readTomlTableArray / readTomlTableString — # inside a quoted value (HWSEPV review)', () => {
  it('keeps array entries after a value containing a # (a PEP 508 url dep)', () => {
    const toml = [
      '[project]',
      'dependencies = [',
      '  "requests>=2.0",',
      '  "mylib @ git+https://h/r.git#egg=mylib",',
      '  "numpy",',
      ']',
      '',
    ].join('\n');
    expect(readTomlTableArray(toml, 'project', 'dependencies')).toEqual([
      'requests>=2.0',
      'mylib @ git+https://h/r.git#egg=mylib',
      'numpy',
    ]);
  });

  it('reads a string value that itself contains a #', () => {
    expect(readTomlTableString('[project]\nname = "a#b"\n', 'project', 'name')).toBe('a#b');
  });

  it('still strips a real trailing comment after a quoted value', () => {
    expect(readTomlTableString('[project]\nname = "real" # the name\n', 'project', 'name')).toBe(
      'real',
    );
  });
});

describe('isTomlTableEmptyArray (UWP4XK review nit — empty vs unparseable)', () => {
  it('is true for a well-formed empty array (inline, spaced, and multi-line)', () => {
    expect(isTomlTableEmptyArray('[workspace]\nmembers = []\n', 'workspace', 'members')).toBe(true);
    expect(isTomlTableEmptyArray('[workspace]\nmembers = [ ]\n', 'workspace', 'members')).toBe(
      true,
    );
    expect(isTomlTableEmptyArray('[workspace]\nmembers = [\n]\n', 'workspace', 'members')).toBe(
      true,
    );
  });

  it('is false for a non-empty array (read normally, never "empty")', () => {
    expect(
      isTomlTableEmptyArray('[workspace]\nmembers = ["crates/*"]\n', 'workspace', 'members'),
    ).toBe(false);
  });

  it('is false for a malformed value — a string, or an array left unclosed (still unreadable)', () => {
    expect(
      isTomlTableEmptyArray('[workspace]\nmembers = "crates/*"\n', 'workspace', 'members'),
    ).toBe(false);
    expect(isTomlTableEmptyArray('[workspace]\nmembers = [\n', 'workspace', 'members')).toBe(false);
  });

  it('is false when the table or the key is absent', () => {
    expect(isTomlTableEmptyArray('[project]\nname = "x"\n', 'workspace', 'members')).toBe(false);
    expect(isTomlTableEmptyArray('[workspace]\nexclude = []\n', 'workspace', 'members')).toBe(
      false,
    );
  });

  it('is table-scoped — an empty array in the target table, not a same-named key elsewhere', () => {
    const toml = '[other]\nmembers = ["x"]\n\n[workspace]\nmembers = []\n';
    expect(isTomlTableEmptyArray(toml, 'workspace', 'members')).toBe(true);
  });
});
