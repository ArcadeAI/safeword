import { describe, expect, it } from 'vitest';

import {
  readPyprojectDependencies,
  readPyprojectName,
  readUvWorkspaceMembers,
} from '../../src/utils/pyproject-manifest.js';

describe('readPyprojectName', () => {
  it('reads the [project] name', () => {
    expect(readPyprojectName('[project]\nname = "my-pkg"\nversion = "1.0"\n')).toBe('my-pkg');
  });

  it('returns undefined when there is no [project] name', () => {
    expect(readPyprojectName('[tool.poetry]\nname = "x"\n')).toBeUndefined();
  });
});

describe('readUvWorkspaceMembers', () => {
  it('reads the [tool.uv.workspace] members array', () => {
    const toml =
      '[tool.uv.workspace]\nmembers = ["packages/*", "libs/*"]\nexclude = ["packages/seeds"]\n';
    expect(readUvWorkspaceMembers(toml)).toEqual(['packages/*', 'libs/*']);
  });

  it('returns undefined when there is no [tool.uv.workspace] table', () => {
    expect(readUvWorkspaceMembers('[project]\nname = "solo"\n')).toBeUndefined();
  });
});

describe('readPyprojectDependencies', () => {
  it('extracts the distribution name from each PEP 508 specifier', () => {
    const toml = [
      '[project]',
      'name = "app"',
      'dependencies = [',
      '  "requests>=2.0",',
      '  "numpy",',
      '  "foo[extra]>=1; python_version < \'3.9\'",',
      ']',
      '',
    ].join('\n');
    expect(readPyprojectDependencies(toml)).toEqual(['requests', 'numpy', 'foo']);
  });

  it('is empty when there are no [project] dependencies', () => {
    expect(readPyprojectDependencies('[project]\nname = "app"\n')).toEqual([]);
  });
});
