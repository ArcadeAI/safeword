/**
 * Ticket 3293WH — setup/upgrade self-verify (auto health verification).
 *
 * Scenarios: .safeword-project/tickets/3293WH-self-verify-setup-upgrade/test-definitions.md
 * Lineage `self-verify-setup-upgrade.<jtbd>.<AC>.<scenario>` in test names.
 *
 * Integration scenarios run the built CLI against real temp fixtures; the
 * issues-found partitions use a malformed personas.md — the one breakage
 * reconcile never repairs (user content), so the postcondition genuinely
 * fails end-to-end. Seam scenarios import the extracted health module.
 */

import { mkdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { checkHealth, type HealthStatus, reportHealthSummary } from '../../src/health.js';
import {
  createConfiguredProject,
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  initGitRepo,
  removeTemporaryDirectory,
  runCli,
  SAFEWORD_VERSION,
  TIMEOUT_SETUP,
  writeTestFile,
} from '../helpers';

const HEALTHY_LINE = 'Configuration is healthy';
const UPDATE_CHECK_PATTERN = /Checking for updates|Update available/;
const RUN_UPGRADE_HINT = 'Run `safeword upgrade`';

/** personas.md with a duplicate short code — a config-health issue reconcile
 * never repairs (user content), producing a real broken postcondition. */
const BROKEN_PERSONAS = `# Personas

## First Persona (XX)

**Role:** one

## Second Persona (XX)

**Role:** two
`;

function freshProject(dir: string): void {
  createTypeScriptPackageJson(dir, {
    devDependencies: {
      typescript: '^5.0.0',
      eslint: '^9.0.0',
      prettier: '^3.0.0',
      'eslint-config-prettier': '^9.0.0',
      safeword: SAFEWORD_VERSION,
      knip: '^5.0.0',
    },
  });
  initGitRepo(dir);
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('3293WH: setup self-verify (clean fixture)', () => {
  let dir: string;
  let output = '';
  let exitCode = -1;

  beforeAll(async () => {
    dir = createTemporaryDirectory();
    freshProject(dir);
    const result = await runCli(['setup'], { cwd: dir });
    output = result.stdout + result.stderr;
    exitCode = result.exitCode;
  }, TIMEOUT_SETUP);

  afterAll(() => {
    removeTemporaryDirectory(dir);
  });

  it('DEV1.AC1.clean_setup_ends_with_health_verification', () => {
    expect(exitCode).toBe(0);
    expect(output).toContain(HEALTHY_LINE);
  });

  it('DEV1.AC4.clean_setup_prints_one_health_summary', () => {
    expect(occurrences(output, HEALTHY_LINE)).toBe(1);
  });

  it('DEV1.AC3.setup_health_verification_carries_no_update_check', () => {
    expect(output).toContain(HEALTHY_LINE);
    expect(output).not.toMatch(UPDATE_CHECK_PATTERN);
  });
});

describe('3293WH: setup self-verify (deliberately-skipped install)', () => {
  let dir: string;

  afterAll(() => {
    removeTemporaryDirectory(dir);
  });

  it(
    'DEV1.AC1.skipped_install_setup_does_not_fault_absent_packages',
    async () => {
      dir = createTemporaryDirectory();
      // Bare TS project — package.json omits safeword's dev deps, so reconcile
      // would list them as "to install". With install deliberately skipped,
      // the self-verify must not treat those absent packages as a failure.
      createTypeScriptPackageJson(dir);
      initGitRepo(dir);

      const result = await runCli(['setup'], {
        cwd: dir,
        env: { SAFEWORD_SKIP_INSTALL: '1' },
      });
      const output = result.stdout + result.stderr;

      expect(result.exitCode).toBe(0);
      expect(output).toContain(HEALTHY_LINE);
      expect(output).not.toContain('Missing Packages');
    },
    TIMEOUT_SETUP,
  );
});

describe('3293WH: setup self-verify (broken postcondition)', () => {
  let dir: string;

  afterAll(() => {
    removeTemporaryDirectory(dir);
  });

  it(
    'DEV1.AC1.setup_with_post_run_issues_exits_nonzero',
    async () => {
      dir = createTemporaryDirectory();
      freshProject(dir);
      // Pre-existing .project/ content is adopted, not clobbered (N9S5XG) —
      // so the malformed personas survive setup and fail its self-verify.
      writeTestFile(dir, '.project/personas.md', BROKEN_PERSONAS);

      const result = await runCli(['setup'], { cwd: dir });
      const output = result.stdout + result.stderr;

      expect(result.exitCode).not.toBe(0);
      expect(output).toMatch(/personas\.md:\d+/);
    },
    TIMEOUT_SETUP,
  );
});

describe('3293WH: upgrade self-verify (clean fixture)', () => {
  let dir: string;
  let output = '';
  let exitCode = -1;

  beforeAll(async () => {
    dir = createTemporaryDirectory();
    await createConfiguredProject(dir);
    const result = await runCli(['upgrade'], { cwd: dir });
    output = result.stdout + result.stderr;
    exitCode = result.exitCode;
  }, TIMEOUT_SETUP * 2);

  afterAll(() => {
    removeTemporaryDirectory(dir);
  });

  it('DEV1.AC2.clean_upgrade_ends_with_health_verification', () => {
    expect(exitCode).toBe(0);
    expect(output).toContain(HEALTHY_LINE);
  });

  it('DEV1.AC4.clean_upgrade_prints_one_health_summary', () => {
    expect(occurrences(output, HEALTHY_LINE)).toBe(1);
  });

  it('DEV1.AC3.upgrade_health_verification_carries_no_update_check', () => {
    expect(output).toContain(HEALTHY_LINE);
    expect(output).not.toMatch(UPDATE_CHECK_PATTERN);
  });
});

describe('3293WH: upgrade self-verify (broken postcondition)', () => {
  let dir: string;

  afterAll(() => {
    removeTemporaryDirectory(dir);
  });

  it(
    'DEV1.AC2.upgrade_with_post_run_issues_exits_nonzero + DEV1.AC5.post_upgrade_failure_hint_omits_run_upgrade (config issues branch)',
    async () => {
      dir = createTemporaryDirectory();
      await createConfiguredProject(dir);
      writeTestFile(dir, '.project/personas.md', BROKEN_PERSONAS);

      const result = await runCli(['upgrade'], { cwd: dir });
      const output = result.stdout + result.stderr;

      expect(result.exitCode).not.toBe(0);
      expect(output).toMatch(/personas\.md:\d+/);
      expect(output).not.toContain(RUN_UPGRADE_HINT);
      expect(output).not.toContain(HEALTHY_LINE);
    },
    TIMEOUT_SETUP * 2,
  );
});

describe('3293WH: upgrade self-verify (advisories only)', () => {
  let dir: string;

  afterAll(() => {
    removeTemporaryDirectory(dir);
  });

  it(
    'DEV1.AC4.advisories_surface_once_without_failing',
    async () => {
      dir = createTemporaryDirectory();
      await createConfiguredProject(dir);
      // Both namespace roots present → the 9MMWS7 both-dirs advisory, the
      // canonical advisories-but-no-issues health state.
      mkdirSync(nodePath.join(dir, '.safeword-project'), { recursive: true });

      const result = await runCli(['upgrade'], { cwd: dir });
      const output = result.stdout + result.stderr;

      expect(result.exitCode).toBe(0);
      expect(occurrences(output, 'Both .project/ and .safeword-project/ exist')).toBe(1);
      expect(output).toContain(HEALTHY_LINE);
    },
    TIMEOUT_SETUP * 2,
  );
});

describe('3293WH: health module seam', () => {
  let dir: string;

  afterAll(() => {
    removeTemporaryDirectory(dir);
  });

  it(
    'DEV1.AC3.health_module_has_no_update_check_path',
    async () => {
      dir = createTemporaryDirectory();
      await createConfiguredProject(dir);

      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const previousCwd = process.cwd();
      process.chdir(dir);
      try {
        await checkHealth(dir);
      } finally {
        process.chdir(previousCwd);
      }

      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    },
    TIMEOUT_SETUP,
  );
});

describe('3293WH: reportHealthSummary remediation hint', () => {
  const baseHealth: HealthStatus = {
    configured: true,
    projectVersion: '0.45.0',
    cliVersion: '0.45.0',
    updateAvailable: false,
    latestVersion: undefined,
    issues: [],
    advisories: [],
    missingPackages: [],
    missingPacks: [],
  };

  const failureBranches: { name: string; health: HealthStatus }[] = [
    { name: 'missing packs', health: { ...baseHealth, missingPacks: ['python'] } },
    { name: 'missing packages', health: { ...baseHealth, missingPackages: ['eslint'] } },
    {
      name: 'config issues',
      health: { ...baseHealth, issues: ['Missing: .safeword/SAFEWORD.md'] },
    },
  ];

  let logged: string[] = [];

  function captureConsole(): void {
    logged = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logged.push(args.join(' '));
    });
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      logged.push(args.join(' '));
    });
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(failureBranches)(
    'DEV1.AC5.standalone_check_keeps_existing_hint ($name)',
    ({ health }) => {
      captureConsole();
      const hasIssues = reportHealthSummary(health);
      expect(hasIssues).toBe(true);
      expect(logged.join('\n')).toContain(RUN_UPGRADE_HINT);
    },
  );

  it.each(failureBranches)(
    'DEV1.AC5.post_upgrade_failure_hint_omits_run_upgrade ($name)',
    ({ health }) => {
      captureConsole();
      const hasIssues = reportHealthSummary(health, {
        repairHint: 'Configuration issues remain after the upgrade — this may be a safeword bug.',
      });
      const output = logged.join('\n');
      expect(hasIssues).toBe(true);
      expect(output).not.toContain(RUN_UPGRADE_HINT);
      expect(output).toContain('Configuration issues remain after the upgrade');
      expect(output).not.toContain(HEALTHY_LINE);
    },
  );
});

describe('3293WH: docs demote check (DEV2.AC1)', () => {
  const repoRoot = nodePath.join(import.meta.dirname, '..', '..', '..', '..');
  const surfaces = [
    nodePath.join(repoRoot, 'packages/cli/templates/SAFEWORD.md'),
    nodePath.join(repoRoot, '.safeword/SAFEWORD.md'),
    nodePath.join(repoRoot, 'packages/website/src/content/docs/reference/cli.mdx'),
  ];

  it('DEV2.AC1.docs_present_check_as_automatic_first', () => {
    const cliMdx = readFileSync(surfaces[2] ?? '', 'utf8');
    // Pinned automatic-after phrase (gate review: literal fixed at RED).
    expect(cliMdx).toContain('runs automatically after `setup` and `upgrade`');
    expect(cliMdx).toMatch(/CI|debugging/);

    // No surface instructs running check as a routine step.
    for (const surface of surfaces) {
      const content = readFileSync(surface, 'utf8');
      expect(content).not.toMatch(/[Rr]un `safeword check`/);
    }
  });
});
