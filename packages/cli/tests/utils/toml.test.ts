import { describe, expect, it } from 'vitest';

import { readTomlTableArray, readTomlTableString } from '../../src/utils/toml.js';

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
