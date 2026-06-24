/**
 * Unit tests for the architecture shape-fingerprint (ticket QD5DTT, Slice 1).
 * Covers the "fingerprint captures shape, not noise" rule from
 * features/architecture-state-docs.feature — written as the metamorphic
 * Scenario Outline: a structural change moves the hash; semantics-preserving
 * noise leaves it unchanged. Temp-dir fixtures.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { shapeFingerprint } from '../../src/utils/architecture-fingerprint.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const context: { directory: string } = { directory: '' };

function writePackageJson(directory: string, dependencies: Record<string, string>): void {
  writeFileSync(
    nodePath.join(directory, 'package.json'),
    JSON.stringify({ name: 'fixture', dependencies }, undefined, 2),
  );
}

/** Scaffold a baseline project with one of each shape input. */
function scaffoldBaseline(directory: string): void {
  mkdirSync(nodePath.join(directory, 'src', 'auth'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, 'src', 'auth', 'index.ts'),
    '// auth module\nexport {};\n',
  );
  writePackageJson(directory, { 'left-pad': '1.0.0' });
  writeFileSync(
    nodePath.join(directory, '.dependency-cruiser.cjs'),
    "module.exports = { forbidden: [{ name: 'no-app-in-domain', from: {}, to: {} }] };\n",
  );
  mkdirSync(nodePath.join(directory, 'db'), { recursive: true });
  writeFileSync(nodePath.join(directory, 'db', 'schema.sql'), 'CREATE TABLE t (id int);\n');
}

type ChangeResult = 'moves' | 'does not move';

const changes: { change: string; apply: (directory: string) => void; result: ChangeResult }[] = [
  {
    change: 'adding a top-level module',
    apply: directory => mkdirSync(nodePath.join(directory, 'src', 'billing'), { recursive: true }),
    result: 'moves',
  },
  {
    change: 'adding a dependency',
    apply: directory => {
      writePackageJson(directory, { 'left-pad': '1.0.0', 'right-pad': '1.0.0' });
    },
    result: 'moves',
  },
  {
    change: 'changing a dependency-cruiser boundary rule',
    apply: directory => {
      writeFileSync(
        nodePath.join(directory, '.dependency-cruiser.cjs'),
        "module.exports = { forbidden: [{ name: 'no-infra-in-domain', from: {}, to: {} }] };\n",
      );
    },
    result: 'moves',
  },
  {
    change: 'adding a schema file',
    apply: directory => {
      writeFileSync(nodePath.join(directory, 'db', 'extra.sql'), 'CREATE TABLE u (id int);\n');
    },
    result: 'moves',
  },
  {
    change: 'bumping only a dependency version',
    apply: directory => {
      writePackageJson(directory, { 'left-pad': '2.0.0' });
    },
    result: 'does not move',
  },
  {
    change: 'editing only a comment in a source file',
    apply: directory => {
      writeFileSync(
        nodePath.join(directory, 'src', 'auth', 'index.ts'),
        '// auth module — now with a different comment\nexport {};\n',
      );
    },
    result: 'does not move',
  },
];

beforeEach(() => {
  context.directory = createTemporaryDirectory();
  scaffoldBaseline(context.directory);
});

afterEach(() => {
  removeTemporaryDirectory(context.directory);
});

describe('shapeFingerprint — captures shape, not noise', () => {
  it.each(changes)('$change → $result', ({ apply, result }) => {
    const before = shapeFingerprint(context.directory);

    apply(context.directory);
    const after = shapeFingerprint(context.directory);

    if (result === 'moves') {
      expect(after).not.toBe(before);
    } else {
      expect(after).toBe(before);
    }
  });
});

describe('shapeFingerprint — Go module dependencies (ticket ZD70P1)', () => {
  function writeGoModule(directory: string, requires: string[]): void {
    const indented = requires.map(requireLine => `\t${requireLine}`).join('\n');
    const block = requires.length === 0 ? '' : `\nrequire (\n${indented}\n)\n`;
    writeFileSync(
      nodePath.join(directory, 'go.mod'),
      `module example.com/app\n\ngo 1.22\n${block}`,
    );
  }

  function scaffoldGo(directory: string, requires: string[]): void {
    mkdirSync(nodePath.join(directory, 'cmd', 'server'), { recursive: true });
    writeGoModule(directory, requires);
  }

  it('moves when a go.mod require is added', () => {
    scaffoldGo(context.directory, ['github.com/a/one v1.0.0']);
    const before = shapeFingerprint(context.directory);

    writeGoModule(context.directory, ['github.com/a/one v1.0.0', 'github.com/b/two v1.0.0']);

    expect(shapeFingerprint(context.directory)).not.toBe(before);
  });

  it('moves when a go.mod require is removed', () => {
    scaffoldGo(context.directory, ['github.com/a/one v1.0.0', 'github.com/b/two v1.0.0']);
    const before = shapeFingerprint(context.directory);

    writeGoModule(context.directory, ['github.com/a/one v1.0.0']);

    expect(shapeFingerprint(context.directory)).not.toBe(before);
  });

  it('does not move when only a require version is bumped (versions excluded)', () => {
    scaffoldGo(context.directory, ['github.com/a/one v1.0.0']);
    const before = shapeFingerprint(context.directory);

    writeGoModule(context.directory, ['github.com/a/one v2.0.0']);

    expect(shapeFingerprint(context.directory)).toBe(before);
  });

  it('reads a single-line require directive', () => {
    scaffoldGo(context.directory, []);
    writeFileSync(
      nodePath.join(context.directory, 'go.mod'),
      'module example.com/app\n\ngo 1.22\n',
    );
    const before = shapeFingerprint(context.directory);

    writeFileSync(
      nodePath.join(context.directory, 'go.mod'),
      'module example.com/app\n\ngo 1.22\n\nrequire github.com/a/one v1.0.0\n',
    );

    expect(shapeFingerprint(context.directory)).not.toBe(before);
  });

  it('reads every require block, not just the first (go mod tidy splits indirect deps)', () => {
    mkdirSync(nodePath.join(context.directory, 'cmd', 'server'), { recursive: true });
    // The `go mod tidy` default on Go 1.17+: direct deps in one block, indirect
    // deps in a SECOND block. A change confined to the indirect block must still
    // move the fingerprint, or drift in indirect deps goes undetected.
    const twoBlock = (indirect: string): string =>
      `module example.com/app\n\ngo 1.22\n\nrequire (\n\tgithub.com/a/one v1.0.0\n)\n\nrequire (\n\t${indirect} // indirect\n)\n`;
    writeFileSync(nodePath.join(context.directory, 'go.mod'), twoBlock('golang.org/x/text v0.3.0'));
    const before = shapeFingerprint(context.directory);

    writeFileSync(
      nodePath.join(context.directory, 'go.mod'),
      twoBlock('golang.org/x/tools v0.1.0'),
    );

    expect(shapeFingerprint(context.directory)).not.toBe(before);
  });
});

describe('shapeFingerprint — Cargo dependencies (ticket YKFA5X)', () => {
  function writeCargo(directory: string, dependencies: string[]): void {
    const block = dependencies.length === 0 ? '' : `\n[dependencies]\n${dependencies.join('\n')}\n`;
    writeFileSync(nodePath.join(directory, 'Cargo.toml'), `[package]\nname = "app"\n${block}`);
  }

  function scaffoldCrate(directory: string, dependencies: string[]): void {
    mkdirSync(nodePath.join(directory, 'src'), { recursive: true });
    writeFileSync(nodePath.join(directory, 'src', 'config.rs'), '// rust\n');
    writeCargo(directory, dependencies);
  }

  it('moves when a Cargo dependency is added', () => {
    scaffoldCrate(context.directory, ['serde = "1.0"']);
    const before = shapeFingerprint(context.directory);

    writeCargo(context.directory, ['serde = "1.0"', 'tokio = "1"']);

    expect(shapeFingerprint(context.directory)).not.toBe(before);
  });

  it('moves when a Cargo dependency is removed', () => {
    scaffoldCrate(context.directory, ['serde = "1.0"', 'tokio = "1"']);
    const before = shapeFingerprint(context.directory);

    writeCargo(context.directory, ['serde = "1.0"']);

    expect(shapeFingerprint(context.directory)).not.toBe(before);
  });

  it('does not move when only a Cargo dependency version is bumped (versions excluded)', () => {
    scaffoldCrate(context.directory, ['serde = "1.0"']);
    const before = shapeFingerprint(context.directory);

    writeCargo(context.directory, ['serde = "2.0"']);

    expect(shapeFingerprint(context.directory)).toBe(before);
  });
});

describe('shapeFingerprint — Python dependencies (ticket HWSEPV)', () => {
  function writePyproject(directory: string, dependencies: string[]): void {
    const quoted = dependencies.map(dependency => `"${dependency}"`).join(', ');
    const dependencies_ = dependencies.length === 0 ? '' : `dependencies = [${quoted}]\n`;
    writeFileSync(
      nodePath.join(directory, 'pyproject.toml'),
      `[project]\nname = "app"\n${dependencies_}`,
    );
  }

  function scaffoldPython(directory: string, dependencies: string[]): void {
    mkdirSync(nodePath.join(directory, 'src'), { recursive: true });
    writeFileSync(nodePath.join(directory, 'src', 'api.py'), '');
    writePyproject(directory, dependencies);
  }

  it('moves when a pyproject dependency is added', () => {
    scaffoldPython(context.directory, ['requests>=2.0']);
    const before = shapeFingerprint(context.directory);

    writePyproject(context.directory, ['requests>=2.0', 'numpy']);

    expect(shapeFingerprint(context.directory)).not.toBe(before);
  });

  it('moves when a pyproject dependency is removed', () => {
    scaffoldPython(context.directory, ['requests>=2.0', 'numpy']);
    const before = shapeFingerprint(context.directory);

    writePyproject(context.directory, ['requests>=2.0']);

    expect(shapeFingerprint(context.directory)).not.toBe(before);
  });

  it('does not move when only a version constraint changes (versions excluded)', () => {
    scaffoldPython(context.directory, ['requests>=2.0']);
    const before = shapeFingerprint(context.directory);

    writePyproject(context.directory, ['requests>=3.0']);

    expect(shapeFingerprint(context.directory)).toBe(before);
  });
});
