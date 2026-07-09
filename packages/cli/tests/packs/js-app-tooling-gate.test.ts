import { describe, expect, it } from 'vitest';

import type { ProjectType } from '../../src/packs/types';
import { computePackagesToInstall } from '../../src/reconcile';
import type { ProjectContext } from '../../src/schema';
import { SAFEWORD_SCHEMA } from '../../src/schema';

function projectType(over: Partial<ProjectType>): ProjectType {
  return {
    typescript: false,
    react: false,
    nextjs: false,
    astro: false,
    vitest: false,
    playwright: false,
    tailwind: false,
    tanstackQuery: false,
    publishableLibrary: false,
    shell: false,
    hasJsSource: false,
    existingLinter: false,
    existingFormatter: false,
    existingPrettierConfig: false,
    existingEslintConfig: undefined,
    legacyEslint: false,
    existingRuffConfig: undefined,
    existingMypyConfig: false,
    existingImportLinterConfig: false,
    existingGolangciConfig: undefined,
    existingClippyConfig: undefined,
    existingSqlfluffConfig: undefined,
    existingCucumberHarness: undefined,
    scaffoldBddLane: true,
    ...over,
  } as ProjectType;
}

function ctxWith(pt: ProjectType): ProjectContext {
  return {
    cwd: '/x',
    projectType: pt,
    developmentDeps: {},
    productionDeps: {},
    isGitRepo: true,
    languages: { javascript: true, python: true, golang: false, rust: false, sql: false },
    namespaceRoot: '.project',
  };
}

describe('JS-app-only tooling is gated on real JS source (BE7C7B)', () => {
  it('omits knip + dependency-cruiser when there is no JS source', () => {
    const packages = computePackagesToInstall(
      SAFEWORD_SCHEMA,
      projectType({ hasJsSource: false }),
      {},
    );
    expect(packages).not.toContain('knip');
    expect(packages).not.toContain('dependency-cruiser');
  });

  it('installs knip + dependency-cruiser for a real JS project', () => {
    const packages = computePackagesToInstall(
      SAFEWORD_SCHEMA,
      projectType({ hasJsSource: true }),
      {},
    );
    expect(packages).toContain('knip');
    expect(packages).toContain('dependency-cruiser');
  });

  it('still installs the BDD lane (@cucumber/cucumber, tsx) regardless of JS source', () => {
    const packages = computePackagesToInstall(
      SAFEWORD_SCHEMA,
      projectType({ hasJsSource: false }),
      {},
    );
    expect(packages).toContain('@cucumber/cucumber');
    expect(packages).toContain('tsx');
  });

  it('does not emit knip.json without JS source, but does with it', () => {
    const generator = SAFEWORD_SCHEMA.managedFiles?.['knip.json']?.generator;
    const withoutJs = ctxWith(projectType({ hasJsSource: false }));
    const withJs = ctxWith(projectType({ hasJsSource: true }));
    expect(generator?.(withoutJs)).toBeUndefined();
    expect(generator?.(withJs)).toBeDefined();
  });

  it('baselines the system shellcheck binary when shell tooling is present', () => {
    const generator = SAFEWORD_SCHEMA.managedFiles?.['knip.json']?.generator;
    const withoutShell = generator?.(ctxWith(projectType({ hasJsSource: true, shell: false })));
    const withShell = generator?.(ctxWith(projectType({ hasJsSource: true, shell: true })));

    expect(
      (JSON.parse(String(withoutShell)) as { ignoreBinaries?: string[] }).ignoreBinaries ?? [],
    ).not.toContain('shellcheck');
    expect(
      (JSON.parse(String(withShell)) as { ignoreBinaries?: string[] }).ignoreBinaries,
    ).toContain('shellcheck');
  });
});
