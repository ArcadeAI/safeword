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
});

describe('TypeScript toolchain for the scaffolded lane (#6966)', () => {
  it('installs a typescript-eslint-compatible compiler with the TypeScript BDD lane', () => {
    const packages = computePackagesToInstall(SAFEWORD_SCHEMA, projectType({}), {});
    expect(packages).toContain('typescript@~6.0.0');
  });

  it('leaves typescript alone when the repo keeps its own cucumber harness', () => {
    const packages = computePackagesToInstall(
      SAFEWORD_SCHEMA,
      projectType({ scaffoldBddLane: false }),
      {},
    );
    expect(packages.some(name => name.startsWith('typescript'))).toBe(false);
  });

  it('never re-pins a typescript the project already has', () => {
    const packages = computePackagesToInstall(SAFEWORD_SCHEMA, projectType({}), {
      typescript: '^7.0.0',
    });
    expect(packages.some(name => name.startsWith('typescript'))).toBe(false);
  });

  it("keeps a monorepo's hoisted workspace typescript instead of pinning a root one", () => {
    const packages = computePackagesToInstall(
      SAFEWORD_SCHEMA,
      projectType({ typescriptAvailable: true }),
      {},
    );
    expect(packages.some(name => name.startsWith('typescript'))).toBe(false);
  });

  it('scaffolds a strict no-emit tsconfig with node types alongside the lane', () => {
    const generator = SAFEWORD_SCHEMA.managedFiles?.['tsconfig.json']?.generator;
    const laneContext = ctxWith(projectType({}));
    const generated = generator?.(laneContext);
    expect(generated).toBeDefined();
    const { compilerOptions } = JSON.parse(generated ?? '{}') as {
      compilerOptions: Record<string, unknown>;
    };
    expect(compilerOptions).toMatchObject({ strict: true, noEmit: true, types: ['node'] });
  });

  it('skips tsconfig for a JS repo with neither the lane nor typescript', () => {
    const generator = SAFEWORD_SCHEMA.managedFiles?.['tsconfig.json']?.generator;
    const noLaneContext = ctxWith(projectType({ scaffoldBddLane: false }));
    expect(generator?.(noLaneContext)).toBeUndefined();
  });
});
