import { describe, expect, it } from 'vitest';

import {
  readCargoDependencyNames,
  readCargoPackageName,
  readCargoWorkspaceMembers,
} from '../../src/utils/cargo-manifest.js';

describe('readCargoWorkspaceMembers', () => {
  it('reads a multi-line members array', () => {
    const toml = ['[workspace]', 'members = [', '    "crates/*",', '    "app",', ']', ''].join(
      '\n',
    );
    expect(readCargoWorkspaceMembers(toml)).toEqual(['crates/*', 'app']);
  });

  it('reads a single-line members array', () => {
    const toml = '[workspace]\nmembers = ["crates/*", "tools/cli"]\n';
    expect(readCargoWorkspaceMembers(toml)).toEqual(['crates/*', 'tools/cli']);
  });

  it('returns undefined when there is no [workspace] table', () => {
    const toml = '[package]\nname = "solo"\n\n[dependencies]\nserde = "1"\n';
    expect(readCargoWorkspaceMembers(toml)).toBeUndefined();
  });

  it('returns undefined when [workspace] has no members', () => {
    const toml = '[workspace]\nresolver = "2"\n';
    expect(readCargoWorkspaceMembers(toml)).toBeUndefined();
  });

  it('tolerates comments and a trailing comma in the array', () => {
    const toml = '[workspace]\nmembers = [\n  "a", # the a crate\n  "b",\n]\n';
    expect(readCargoWorkspaceMembers(toml)).toEqual(['a', 'b']);
  });

  it('reads members from the [workspace] table, not a metadata members key', () => {
    const toml = [
      '[package.metadata.bundle]',
      'members = ["META/wrong"]',
      '',
      '[workspace]',
      'members = ["crates/*"]',
      '',
    ].join('\n');
    expect(readCargoWorkspaceMembers(toml)).toEqual(['crates/*']);
  });

  it('does not drop members after a comment containing a closing bracket', () => {
    const toml = '[workspace]\nmembers = [\n  "a", # see crates[] note\n  "b",\n  "c",\n]\n';
    expect(readCargoWorkspaceMembers(toml)).toEqual(['a', 'b', 'c']);
  });
});

describe('readCargoPackageName', () => {
  it('reads the [package] name', () => {
    expect(readCargoPackageName('[package]\nname = "my-crate"\nversion = "0.1.0"\n')).toBe(
      'my-crate',
    );
  });

  it('returns undefined when there is no [package] table', () => {
    expect(readCargoPackageName('[workspace]\nmembers = ["a"]\n')).toBeUndefined();
  });

  it('does not mistake a [[bin]] name for the package name', () => {
    const toml = '[package]\nname = "real"\n\n[[bin]]\nname = "a-binary"\n';
    expect(readCargoPackageName(toml)).toBe('real');
  });
});

describe('readCargoDependencyNames', () => {
  it('collects keys across dependencies, dev-dependencies, and build-dependencies', () => {
    const toml = [
      '[package]',
      'name = "c"',
      '[dependencies]',
      'serde = "1.0"',
      'tokio = { version = "1", features = ["full"] }',
      '[dev-dependencies]',
      'mockall = "0.11"',
      '[build-dependencies]',
      'cc = "1.0"',
      '',
    ].join('\n');
    expect(readCargoDependencyNames(toml).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'cc',
      'mockall',
      'serde',
      'tokio',
    ]);
  });

  it('reads a [dependencies.<name>] sub-table as the dependency name', () => {
    const toml = '[dependencies.serde]\nversion = "1"\nfeatures = ["derive"]\n';
    expect(readCargoDependencyNames(toml)).toEqual(['serde']);
  });

  it('handles a quoted dependency key', () => {
    const toml = '[dependencies]\n"some-dep" = "1.0"\n';
    expect(readCargoDependencyNames(toml)).toEqual(['some-dep']);
  });

  it('excludes versions and is empty when there are no dependency tables', () => {
    expect(readCargoDependencyNames('[package]\nname = "c"\n')).toEqual([]);
  });

  it('does not collect keys from a non-dependency table', () => {
    const toml = '[package]\nname = "c"\nversion = "0.1.0"\nedition = "2021"\n';
    expect(readCargoDependencyNames(toml)).toEqual([]);
  });
});
