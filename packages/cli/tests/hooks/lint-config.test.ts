/**
 * Unit tests for lint-config presence detection (ticket 1J6JKP). Pure
 * functions over a directory listing — prefix-match so new eslint/prettier
 * config extensions are covered without enumerating every filename (the drift
 * that caused this ticket: `eslint.config.ts` / `.prettierrc.yaml` were missed).
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  detectAlternativeFormatter,
  detectEslintConfig,
  detectPrettierConfig,
  hostFormatsSqlWithPrettier,
  projectOwnsAlternativeFormatter,
  shouldWarnMissingPrettier,
  sqlFixOptedIn,
} from '../../templates/hooks/lib/lint-config.js';

describe('detectEslintConfig', () => {
  it('detects every flat-config extension', () => {
    for (const file of [
      'eslint.config.js',
      'eslint.config.mjs',
      'eslint.config.cjs',
      'eslint.config.ts',
      'eslint.config.mts',
      'eslint.config.cts',
    ]) {
      expect(detectEslintConfig([file])).toBe(true);
    }
  });

  it('detects legacy .eslintrc variants', () => {
    for (const file of ['.eslintrc', '.eslintrc.json', '.eslintrc.js', '.eslintrc.yaml']) {
      expect(detectEslintConfig([file])).toBe(true);
    }
  });

  it('is false when no eslint config is present', () => {
    expect(detectEslintConfig(['README.md', 'package.json', 'tsconfig.json'])).toBe(false);
  });
});

describe('detectPrettierConfig', () => {
  it('detects .prettierrc and all its extensions', () => {
    for (const file of [
      '.prettierrc',
      '.prettierrc.json',
      '.prettierrc.yaml',
      '.prettierrc.yml',
      '.prettierrc.toml',
      '.prettierrc.json5',
      '.prettierrc.ts',
      '.prettierrc.mjs',
    ]) {
      expect(detectPrettierConfig([file])).toBe(true);
    }
  });

  it('detects prettier.config.* variants', () => {
    for (const file of ['prettier.config.js', 'prettier.config.cjs', 'prettier.config.mts']) {
      expect(detectPrettierConfig([file])).toBe(true);
    }
  });

  it('is false when no prettier config is present', () => {
    expect(detectPrettierConfig(['foo.js', 'package.json'])).toBe(false);
  });
});

describe('disabled/backup configs are not treated as present', () => {
  // A config renamed to `.bak` (a common "disable it" gesture, and how the E2E
  // hook test simulates a missing config) must NOT count — the tool won't load
  // it. This is why detection matches exact known filenames, not a loose prefix.
  it('ignores .bak-suffixed eslint/prettier configs', () => {
    expect(detectEslintConfig(['eslint.config.mjs.bak'])).toBe(false);
    expect(detectEslintConfig(['.eslintrc.json.bak'])).toBe(false);
    expect(detectPrettierConfig(['.prettierrc.bak'])).toBe(false);
    expect(detectPrettierConfig(['prettier.config.js.bak'])).toBe(false);
  });

  it('ignores unrelated extensions on the config base', () => {
    expect(detectPrettierConfig(['.prettierrc.local'])).toBe(false);
    expect(detectEslintConfig(['eslint.config.backup'])).toBe(false);
  });
});

describe('detectAlternativeFormatter', () => {
  // A non-Prettier JS/TS formatter owns the repo's formatting → the lint hook
  // must skip Prettier rather than fight it (ticket V7GGJZ). Exact-filename
  // match, mirroring ALTERNATIVE_FORMATTER_FILES in presets/typescript/detect.ts.
  it('detects Biome and legacy Rome configs', () => {
    for (const file of ['biome.json', 'biome.jsonc', 'rome.json']) {
      expect(detectAlternativeFormatter([file])).toBe(true);
    }
  });

  it('detects dprint configs (with and without leading dot)', () => {
    for (const file of ['dprint.json', '.dprint.json', 'dprint.jsonc', '.dprint.jsonc']) {
      expect(detectAlternativeFormatter([file])).toBe(true);
    }
  });

  it('detects oxfmt configs (rc + all 6 config extensions)', () => {
    for (const file of [
      '.oxfmtrc.json',
      '.oxfmtrc.jsonc',
      'oxfmt.config.js',
      'oxfmt.config.cjs',
      'oxfmt.config.mjs',
      'oxfmt.config.ts',
      'oxfmt.config.cts',
      'oxfmt.config.mts',
    ]) {
      expect(detectAlternativeFormatter([file])).toBe(true);
    }
  });

  it('detects deno configs', () => {
    for (const file of ['deno.json', 'deno.jsonc']) {
      expect(detectAlternativeFormatter([file])).toBe(true);
    }
  });

  it('is false for prettier-only or no formatter', () => {
    expect(detectAlternativeFormatter(['.prettierrc', 'package.json'])).toBe(false);
    expect(detectAlternativeFormatter(['README.md', 'tsconfig.json'])).toBe(false);
  });

  it('ignores disabled/backup alternative-formatter configs', () => {
    expect(detectAlternativeFormatter(['biome.json.bak'])).toBe(false);
    expect(detectAlternativeFormatter(['deno.json.disabled'])).toBe(false);
  });
});

describe('projectOwnsAlternativeFormatter', () => {
  // The gate the lint hook uses to decide whether to skip Prettier: reads the
  // project root and reports whether a non-Prettier formatter owns it (V7GGJZ).
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'lint-owns-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('is true when a non-Prettier formatter owns the repo', () => {
    for (const config of ['biome.json', 'dprint.json', '.oxfmtrc.json', 'deno.json']) {
      const owned = mkdtempSync(path.join(tmpdir(), 'lint-owns-'));
      writeFileSync(path.join(owned, config), '{}');
      expect(projectOwnsAlternativeFormatter(owned)).toBe(true);
      rmSync(owned, { recursive: true, force: true });
    }
  });

  it('is true when an alternative formatter and a Prettier config both exist (alternative wins)', () => {
    writeFileSync(path.join(directory, 'biome.json'), '{}');
    writeFileSync(path.join(directory, '.prettierrc'), '{}');

    expect(projectOwnsAlternativeFormatter(directory)).toBe(true);
  });

  it('is false for a greenfield repo (no formatter)', () => {
    writeFileSync(path.join(directory, 'package.json'), '{}');

    expect(projectOwnsAlternativeFormatter(directory)).toBe(false);
  });

  it('is false when only a Prettier config is present (safeword formats with their config)', () => {
    writeFileSync(path.join(directory, '.prettierrc'), '{}');

    expect(projectOwnsAlternativeFormatter(directory)).toBe(false);
  });

  it('is false (does not throw) for a nonexistent directory', () => {
    expect(projectOwnsAlternativeFormatter(path.join(directory, 'nope'))).toBe(false);
  });
});

describe('hostFormatsSqlWithPrettier', () => {
  // The gate the SQL branch uses to defer to a host that formats SQL itself
  // via prettier-plugin-sql (#636/#638): host prettier runs, sqlfluff doesn't.
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'sql-owns-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('is true when prettier-plugin-sql is installed in node_modules', () => {
    mkdirSync(path.join(directory, 'node_modules', 'prettier-plugin-sql'), { recursive: true });

    expect(hostFormatsSqlWithPrettier(directory)).toBe(true);
  });

  it('is false without the plugin (other node_modules content does not count)', () => {
    mkdirSync(path.join(directory, 'node_modules', 'prettier'), { recursive: true });

    expect(hostFormatsSqlWithPrettier(directory)).toBe(false);
  });

  it('is false (does not throw) for a nonexistent directory', () => {
    expect(hostFormatsSqlWithPrettier(path.join(directory, 'nope'))).toBe(false);
  });
});

describe('sqlFixOptedIn', () => {
  // Edit-time `sqlfluff fix` rewrites files beyond the agent's intended edit,
  // so it's opt-in via `.safeword/config.json` → sql.fix (#638). Anything
  // other than an explicit true reads as "off".
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'sql-fix-'));
    mkdirSync(path.join(directory, '.safeword'), { recursive: true });
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  const writeConfig = (content: string): void => {
    writeFileSync(path.join(directory, '.safeword', 'config.json'), content);
  };

  it('is true only when sql.fix is explicitly true', () => {
    writeConfig(JSON.stringify({ installedPacks: ['sql'], sql: { fix: true } }));

    expect(sqlFixOptedIn(directory)).toBe(true);
  });

  it('is false when sql.fix is absent, false, or non-boolean', () => {
    writeConfig(JSON.stringify({ installedPacks: ['sql'] }));
    expect(sqlFixOptedIn(directory)).toBe(false);

    writeConfig(JSON.stringify({ sql: { fix: false } }));
    expect(sqlFixOptedIn(directory)).toBe(false);

    writeConfig(JSON.stringify({ sql: { fix: 'yes' } }));
    expect(sqlFixOptedIn(directory)).toBe(false);
  });

  it('is false when config.json is missing or malformed', () => {
    expect(sqlFixOptedIn(path.join(directory, 'nope'))).toBe(false);

    writeConfig('{not json');
    expect(sqlFixOptedIn(directory)).toBe(false);
  });
});

describe('shouldWarnMissingPrettier', () => {
  // The session lint check must not nag a Biome/dprint/oxfmt/deno shop to install
  // Prettier — they deliberately don't use it (ticket V7GGJZ, DEV4.AC1).
  it('warns when neither a Prettier config nor an alternative formatter is present', () => {
    expect(shouldWarnMissingPrettier(['package.json', 'tsconfig.json'])).toBe(true);
  });

  it('does not warn when an alternative formatter owns the repo', () => {
    expect(shouldWarnMissingPrettier(['biome.json'])).toBe(false);
    expect(shouldWarnMissingPrettier(['deno.json'])).toBe(false);
  });

  it('does not warn when a Prettier config is present', () => {
    expect(shouldWarnMissingPrettier(['.prettierrc'])).toBe(false);
  });
});
