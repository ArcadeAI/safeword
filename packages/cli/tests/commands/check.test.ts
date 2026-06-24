/**
 * Test Suite 8: Health Check
 *
 * Tests for `safeword check` command.
 */

import { rmSync, unlinkSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createConfiguredProject,
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  TIMEOUT_QUICK,
  writeSafewordConfig,
  writeTestFile,
} from '../helpers';

describe('Test Suite 8: Health Check', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  /** Write a ticket.md with the given frontmatter lines under .project/tickets/<folder>/. */
  function writeFrontmatterTicket(folder: string, frontmatter: string[]): void {
    writeTestFile(
      temporaryDirectory,
      `.project/tickets/${folder}/ticket.md`,
      ['---', ...frontmatter, '---', '', `# ${folder}`, ''].join('\n'),
    );
  }

  describe('Test 8.1: Shows CLI version', () => {
    it('should display CLI version', async () => {
      await createConfiguredProject(temporaryDirectory);

      const result = await runCli(['check'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toLowerCase()).toMatch(/cli|safeword/i);
      expect(result.stdout).toMatch(/\d{1,4}\.\d{1,4}\.\d{1,4}/);
    });
  });

  describe('Test 8.2: Shows project config version', () => {
    it('should display version from .safeword/version', async () => {
      await createConfiguredProject(temporaryDirectory);

      const result = await runCli(['check'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toLowerCase()).toMatch(/project|config/i);

      // Should show the version from .safeword/version
      const projectVersion = readTestFile(temporaryDirectory, '.safeword/version').trim();
      expect(result.stdout).toContain(projectVersion);
    });
  });

  describe('Test 8.3: Shows update available', () => {
    it('should indicate when update is available', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Write an older version
      writeTestFile(temporaryDirectory, '.safeword/version', '0.0.1');

      const result = await runCli(['check'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      // Should mention available update or version difference
      expect(result.stdout.toLowerCase()).toMatch(/update|available|upgrade|newer/i);
    });
  });

  describe('Test 8.4: Unconfigured project message', () => {
    it('should show not configured message', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      // No setup run

      const result = await runCli(['check'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toLowerCase()).toContain('not configured');
      expect(result.stdout.toLowerCase()).toContain('setup');
    });
  });

  describe('Test 8.5: Graceful timeout on version check', () => {
    it('should handle network timeout gracefully', async () => {
      await createConfiguredProject(temporaryDirectory);

      // This test verifies the check completes without hanging
      // Network mocking would be needed for full timeout simulation
      const result = await runCli(['check'], {
        cwd: temporaryDirectory,
        timeout: TIMEOUT_QUICK,
      });

      expect(result.exitCode).toBe(0);
      // Should either show version info or timeout message
    });
  });

  describe('Test 8.6: --offline skips version check', () => {
    it('should skip remote version check', async () => {
      await createConfiguredProject(temporaryDirectory);

      const result = await runCli(['check', '--offline'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);
      // Should show local versions only
      expect(result.stdout).toMatch(/\d{1,4}\.\d{1,4}\.\d{1,4}/);
    });
  });

  describe('Test 8.7: Detects corrupted .safeword structure', () => {
    it('should detect missing critical files', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Delete a critical file
      unlinkSync(nodePath.join(temporaryDirectory, '.safeword/SAFEWORD.md'));

      const result = await runCli(['check'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(1); // Issues should cause non-zero exit
      expect(result.stdout.toLowerCase()).toMatch(/missing|issue|repair|upgrade/i);
    });
  });

  // ==========================================================================
  // Language Packs Detection (Feature: Language Packs)
  // Test Definitions: .safeword/planning/test-definitions/feature-language-packs.md
  // ==========================================================================

  describe('Warns when detected language has no installed pack', () => {
    it('should warn about missing Python pack', async () => {
      await createConfiguredProject(temporaryDirectory);
      // Add Python detection file
      writeTestFile(temporaryDirectory, 'pyproject.toml', `[project]\nname = "test"\n`);
      // TypeScript is installed (from setup), but Python is missing
      writeSafewordConfig(temporaryDirectory, {
        installedPacks: ['typescript'],
      });

      const result = await runCli(['check'], { cwd: temporaryDirectory });

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toMatch(/python.*pack.*not installed/i);
      expect(result.stdout).toMatch(/safeword upgrade/i);
    });
  });

  describe('Passes when all detected languages have packs', () => {
    it('should pass when Python pack is installed', async () => {
      await createConfiguredProject(temporaryDirectory);
      // Add Python detection file with existing tool configs to skip managed file generation
      writeTestFile(
        temporaryDirectory,
        'pyproject.toml',
        `[project]\nname = "test"\n\n[tool.ruff]\nline-length = 100\n\n[tool.mypy]\nstrict = true\n`,
      );
      // Add Python-specific owned file
      writeTestFile(temporaryDirectory, '.safeword/ruff.toml', '# Generated by safeword\n');
      // Both TypeScript and Python are installed
      writeSafewordConfig(temporaryDirectory, {
        installedPacks: ['typescript', 'python'],
      });

      const result = await runCli(['check', '--offline'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toMatch(/pack.*not installed/i);
    });
  });

  describe('personas.md validation (ticket 7YN5QB)', () => {
    /**
     * Set up a configured project, write the given content to
     * `.project/personas.md`, run `safeword check --offline`, and
     * return the CLI result. Used by tests that exercise the validation
     * path against varying file contents.
     */
    async function runCheckWithPersonas(content: string) {
      await createConfiguredProject(temporaryDirectory);
      writeTestFile(temporaryDirectory, '.project/personas.md', content);
      return runCli(['check', '--offline'], { cwd: temporaryDirectory });
    }

    it('reports validation errors with line refs and exits non-zero', async () => {
      const result = await runCheckWithPersonas(
        ['## End User (EU)', '**Role:** A', '', '## Engineering Unit (EU)', '**Role:** B', ''].join(
          '\n',
        ),
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/personas\.md:\d+:.*duplicate persona code/);
    });

    it('reports single-character-name error with line ref', async () => {
      const result = await runCheckWithPersonas(['## A', '**Role:** Too short.', ''].join('\n'));

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/personas\.md:\d+:.*at least 2 characters/);
    });

    it('reports digit-first-name with explicit-override prompt', async () => {
      const result = await runCheckWithPersonas(
        ['## 3 Amigos', '**Role:** Pathological name.', ''].join('\n'),
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/non-conformant code/);
      expect(result.stderr).toMatch(/author explicit code/);
    });

    it('passes when personas.md is well-formed', async () => {
      const result = await runCheckWithPersonas(
        [
          '## Platform Operator (PO)',
          '**Role:** Owns infra.',
          '',
          '## End User (EU)',
          '**Role:** Signs in.',
          '',
        ].join('\n'),
      );

      expect(result.stderr).not.toMatch(/personas\.md:/);
    });

    it('scaffolded-but-empty personas.md (template comment only) produces no errors', async () => {
      await createConfiguredProject(temporaryDirectory);
      // createConfiguredProject scaffolds personas.md from the template;
      // it contains an HTML-commented example block but no real persona
      // entries. Should produce no validation errors.

      const result = await runCli(['check', '--offline'], {
        cwd: temporaryDirectory,
      });

      expect(result.stderr).not.toMatch(/personas\.md:/);
    });

    it('treats missing personas.md as absent (no error)', async () => {
      await createConfiguredProject(temporaryDirectory);
      // Delete the scaffolded personas.md to exercise the absent path.
      unlinkSync(nodePath.join(temporaryDirectory, '.project', 'personas.md'));

      const result = await runCli(['check', '--offline'], {
        cwd: temporaryDirectory,
      });

      expect(result.stderr).not.toMatch(/personas\.md:/);
    });
  });

  describe('configurable persona path (ticket K7N2QM)', () => {
    /**
     * Add a `paths.personas` override to the project's existing
     * `.safeword/config.json`. Preserves any other config keys (notably
     * `installedPacks`) that `createConfiguredProject` wrote during
     * setup — overwriting them would trigger spurious "missing pack"
     * reports that short-circuit the issues section.
     */
    function setPersonasOverride(personasPath: string): void {
      const existing = JSON.parse(readTestFile(temporaryDirectory, '.safeword/config.json')) as {
        installedPacks?: string[];
        [key: string]: unknown;
      };
      writeTestFile(
        temporaryDirectory,
        '.safeword/config.json',
        JSON.stringify({ ...existing, paths: { personas: personasPath } }),
      );
    }

    it('R2.3: reports loud failure when configured path is missing', async () => {
      await createConfiguredProject(temporaryDirectory);
      setPersonasOverride('docs/personas.md'); // file intentionally not created
      // Remove the scaffolded default so this test isolates the override branch.
      unlinkSync(nodePath.join(temporaryDirectory, '.project', 'personas.md'));

      const result = await runCli(['check', '--offline'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/personas-path:.*docs\/personas\.md.*file not found/);
    });

    it('R2.4: passes when configured persona file is present and well-formed', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeTestFile(
        temporaryDirectory,
        'docs/personas.md',
        ['## Platform Operator (PO)', '**Role:** Owns infra.', ''].join('\n'),
      );
      setPersonasOverride('docs/personas.md');
      // Remove default so the legacy advisory does not fire.
      unlinkSync(nodePath.join(temporaryDirectory, '.project', 'personas.md'));

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).not.toMatch(/personas/);
    });

    it('R2.5: reports content errors when configured persona file is malformed', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeTestFile(
        temporaryDirectory,
        'docs/personas.md',
        ['## A', '**Role:** Too short.', ''].join('\n'),
      );
      setPersonasOverride('docs/personas.md');
      unlinkSync(nodePath.join(temporaryDirectory, '.project', 'personas.md'));

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/personas\.md:\d+:.*at least 2 characters/);
    });

    it('R2.6: emits zero-exit advisory when override is active AND legacy default file still exists', async () => {
      await createConfiguredProject(temporaryDirectory);
      // Write the override target so the configured-but-missing branch
      // does NOT fire — we want to exercise the legacy-coexistence branch.
      writeTestFile(
        temporaryDirectory,
        'docs/personas.md',
        ['## Platform Operator (PO)', '**Role:** Owns infra.', ''].join('\n'),
      );
      setPersonasOverride('docs/personas.md');
      // The default-location file was scaffolded by createConfiguredProject
      // and is intentionally left in place — that is the "legacy" condition.

      const result = await runCli(['check', '--offline'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(combined).toMatch(/\.project\/personas\.md.*orphan/i);
    });

    it('R4.1: config with forward-looking glossary and architecture paths parses without error', async () => {
      await createConfiguredProject(temporaryDirectory);
      // glossary now has a live read site (YR6C49) — point it at a real file
      // so the configured-but-missing check doesn't fire. architecture
      // remains forward-looking (no read site yet).
      writeTestFile(
        temporaryDirectory,
        'docs/glossary.md',
        ['## Tool', '**Definition:** A capability.', ''].join('\n'),
      );
      const existing = JSON.parse(
        readTestFile(temporaryDirectory, '.safeword/config.json'),
      ) as Record<string, unknown>;
      writeTestFile(
        temporaryDirectory,
        '.safeword/config.json',
        JSON.stringify({
          ...existing,
          paths: { glossary: 'docs/glossary.md', architecture: 'ARCHITECTURE.md' },
        }),
      );

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      // No config-parse error surfaced.
      expect(result.stderr).not.toMatch(/JSON|parse error|invalid config/i);
    });
  });

  describe('glossary.md validation (ticket YR6C49)', () => {
    function setGlossaryOverride(glossaryPath: string): void {
      const existing = JSON.parse(readTestFile(temporaryDirectory, '.safeword/config.json')) as {
        installedPacks?: string[];
        [key: string]: unknown;
      };
      writeTestFile(
        temporaryDirectory,
        '.safeword/config.json',
        JSON.stringify({ ...existing, paths: { glossary: glossaryPath } }),
      );
    }

    it('R6.1: reports malformed glossary with line refs and exits non-zero', async () => {
      await createConfiguredProject(temporaryDirectory);
      // Two duplicate term blocks → duplicate-term errors.
      writeTestFile(
        temporaryDirectory,
        '.project/glossary.md',
        ['## Tool', '**Definition:** First.', '', '## Tool', '**Definition:** Second.', ''].join(
          '\n',
        ),
      );

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/glossary\.md:\d+:.*duplicate term/);
    });

    it('R6.2: reports loud failure when configured glossary path is missing', async () => {
      await createConfiguredProject(temporaryDirectory);
      setGlossaryOverride('docs/glossary.md'); // file intentionally not created

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/glossary-path:.*docs\/glossary\.md.*file not found/);
    });

    it('R6.3: emits zero-exit advisory when override is active AND legacy default still exists', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeTestFile(
        temporaryDirectory,
        'docs/glossary.md',
        ['## Tool', '**Definition:** A capability.', ''].join('\n'),
      );
      // Explicitly create the legacy default (self-contained — does not rely on
      // the scaffold, which only lands once dist is rebuilt with the new entry).
      writeTestFile(
        temporaryDirectory,
        '.project/glossary.md',
        ['## Legacy', '**Definition:** Old location.', ''].join('\n'),
      );
      setGlossaryOverride('docs/glossary.md');

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(combined).toMatch(/\.project\/glossary\.md.*orphan/i);
    });
  });

  describe('configured docs sources (ticket 3BTGMW)', () => {
    function setDocumentationSources(sources: unknown[]): void {
      const existing = JSON.parse(readTestFile(temporaryDirectory, '.safeword/config.json')) as {
        installedPacks?: string[];
        [key: string]: unknown;
      };
      writeTestFile(
        temporaryDirectory,
        '.safeword/config.json',
        JSON.stringify({ ...existing, docs: { sources } }),
      );
    }

    it('reports loud failure when a configured local docs source is missing', async () => {
      await createConfiguredProject(temporaryDirectory);
      setDocumentationSources([{ type: 'local', path: 'docs/product' }]);

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/docs-source:.*docs\/product.*file or directory not found/);
    });

    it('passes when configured local docs sources exist and external sources are declarative', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeTestFile(temporaryDirectory, 'docs/product/README.md', '# Product docs\n');
      setDocumentationSources([
        { type: 'local', path: 'docs/product' },
        { type: 'url', url: 'https://docs.example.test/product' },
        { type: 'git', repo: 'git@example.com:org/docs.git', path: 'product' },
      ]);

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).not.toMatch(/docs-source:/);
    });
  });

  describe('AKZJXC: structured-relation advisories (depends_on)', () => {
    it('warns on a dangling depends_on and a dependency cycle, zero-exit', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeFrontmatterTicket('REL001-dangler', [
        'id: REL001',
        'status: open',
        'depends_on: [GHOST9]',
      ]);
      writeFrontmatterTicket('REL002-loop-a', [
        'id: REL002',
        'status: open',
        'depends_on: [REL003]',
      ]);
      writeFrontmatterTicket('REL003-loop-b', [
        'id: REL003',
        'status: open',
        'depends_on: [REL002]',
      ]);

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(combined).toMatch(/depends_on GHOST9.*dangling ref/i);
      expect(combined).toMatch(/dependency cycle among:.*REL002.*REL003/i);
    });

    it('stays silent for a corpus with valid relations', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeFrontmatterTicket('REL010-dep', ['id: REL010', 'status: open', 'depends_on: [REL011]']);
      writeFrontmatterTicket('REL011-base', ['id: REL011', 'status: open']);

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(combined).not.toMatch(/dangling ref|dependency cycle/i);
    });
  });

  describe('MBGQ89: blocked_on relation advisories (warn-only)', () => {
    it('warns on a dangling blocked_on, a cycle, and a self-cycle, zero-exit', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeFrontmatterTicket('BLK001-dangler', [
        'id: BLK001',
        'status: open',
        'blocked_on: [GHOST9]',
      ]);
      writeFrontmatterTicket('BLK002-loop-a', [
        'id: BLK002',
        'status: open',
        'blocked_on: [BLK003]',
      ]);
      writeFrontmatterTicket('BLK003-loop-b', [
        'id: BLK003',
        'status: open',
        'blocked_on: [BLK002]',
      ]);
      writeFrontmatterTicket('BLK004-self', ['id: BLK004', 'status: open', 'blocked_on: [BLK004]']);

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(combined).toMatch(/blocked_on GHOST9.*dangling ref/i);
      expect(combined).toMatch(/blocked_on cycle among:.*BLK002.*BLK003/i);
      expect(combined).toMatch(/blocked_on cycle among:.*BLK004/i);
    });

    it('treats a ticket with neither epic nor blocked_on as clean (fields optional)', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeFrontmatterTicket('BLK020-bare', ['id: BLK020', 'status: open']);

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(combined).not.toMatch(/BLK020.*(dangling ref|cycle)/i);
    });

    it('stays silent for valid blocked_on relations', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeFrontmatterTicket('BLK010-dep', ['id: BLK010', 'status: open', 'blocked_on: [BLK011]']);
      writeFrontmatterTicket('BLK011-base', ['id: BLK011', 'status: done']);

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(combined).not.toMatch(/blocked_on.*dangling ref|blocked_on cycle/i);
    });

    it('warns that a blocked_on_override is stale once every blocker is done', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeFrontmatterTicket('OVR1-stale', [
        'id: OVR1',
        'status: open',
        'blocked_on: [BLK9]',
        'blocked_on_override: BLK9 was cancelled, proceeding',
      ]);
      writeFrontmatterTicket('BLK9-done', ['id: BLK9', 'status: done']);

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(combined).toMatch(/OVR1.*stale.*override/i);
    });

    it('does not flag an override while a blocker is still non-done', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeFrontmatterTicket('OVR2-live', [
        'id: OVR2',
        'status: open',
        'blocked_on: [BLK8]',
        'blocked_on_override: BLK8 cancelled, proceeding inline',
      ]);
      writeFrontmatterTicket('BLK8-cancelled', ['id: BLK8', 'status: cancelled']);

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      const combined = `${result.stdout}\n${result.stderr}`;
      expect(combined).not.toMatch(/stale.*override/i);
    });

    it('does not flag an override stale when a blocker is done but another is dangling', async () => {
      // Staleness requires *every* listed blocker to be resolvably done. A
      // dangling id has no status, so it is not done — the override is still
      // load-bearing and must not be called stale (only the dangling-ref warns).
      await createConfiguredProject(temporaryDirectory);
      writeFrontmatterTicket('OVR3-mixed', [
        'id: OVR3',
        'status: open',
        'blocked_on: [BLK7, GHOST7]',
        'blocked_on_override: BLK7 done but GHOST7 lives in the customer tracker',
      ]);
      writeFrontmatterTicket('BLK7-done', ['id: BLK7', 'status: done']);

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(combined).not.toMatch(/stale.*override/i);
      // the dangling blocker is still surfaced, just not as a stale override
      expect(combined).toMatch(/blocked_on GHOST7.*dangling ref/i);
    });
  });

  describe('Test 8.7: Scenario-lineage coverage advisory (XT1FFM)', () => {
    const SPEC_TWO_ACS = [
      '# Spec',
      '',
      '## Jobs To Be Done',
      '',
      '### demo.DEV1 — Trace',
      '',
      '**Persona:** DEV',
      '',
      '#### demo.DEV1.AC1 — capability one',
      '',
      '#### demo.DEV1.AC2 — capability two',
      '',
    ].join('\n');

    function scenarioTitle(title: string): string {
      return [
        '# Test Definitions',
        '',
        '## Rule: r',
        '',
        `### Scenario: ${title}`,
        '',
        'Given a',
        'When b',
        'Then c',
        '',
        '- [ ] RED',
        '- [ ] GREEN',
        '- [ ] REFACTOR',
        '',
      ].join('\n');
    }

    function writeTicket(ticketId: string, status: string, files: Record<string, string>): void {
      const base = `.project/tickets/${ticketId}`;
      writeTestFile(
        temporaryDirectory,
        `${base}/ticket.md`,
        ['---', `id: ${ticketId}`, 'type: feature', `status: ${status}`, '---', ''].join('\n'),
      );
      for (const [name, content] of Object.entries(files)) {
        writeTestFile(temporaryDirectory, `${base}/${name}`, content);
      }
    }

    it('reports an uncovered AC for an in-progress ticket as a zero-exit advisory', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeTicket('COV001', 'in_progress', {
        'spec.md': SPEC_TWO_ACS,
        'test-definitions.md': scenarioTitle('demo.DEV1.AC1.happy_path'),
      });

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(combined).toMatch(/COV001:.*demo\.DEV1\.AC2.*uncovered/i);
    });

    it('prefers feature-source tags over markdown scenario titles (1DT29X)', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeTicket('COV004-demo', 'in_progress', {
        'spec.md': SPEC_TWO_ACS,
        // If markdown still won, AC2 would look covered. Feature source should win.
        'test-definitions.md': scenarioTitle('demo.DEV1.AC2.markdown_only'),
      });
      writeTestFile(
        temporaryDirectory,
        'features/demo.feature',
        [
          'Feature: Demo',
          '',
          '  Rule: r',
          '',
          '    @demo.DEV1.AC1',
          '    Scenario: feature source covers only AC1',
          '      Given a',
          '      When b',
          '      Then c',
          '',
        ].join('\n'),
      );

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(combined).toMatch(/demo \(COV004\):.*demo\.DEV1\.AC2.*uncovered/i);
    });

    it('reports invalid feature source syntax without a parser stack (1DT29X)', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeTicket('COV005-demo', 'in_progress', {
        'spec.md': SPEC_TWO_ACS,
        'test-definitions.md': scenarioTitle('demo.DEV1.AC1.markdown_fallback'),
      });
      writeTestFile(
        temporaryDirectory,
        'features/demo.feature',
        [
          'Feature: Broken',
          '  Rule: r',
          '    Scenario: bad',
          '      Given ok',
          '      nope',
          '',
        ].join('\n'),
      );

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(1);
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(combined).toMatch(/features\/demo\.feature/);
      expect(combined).toMatch(/invalid gherkin/i);
      expect(combined).not.toMatch(/CompositeParserException|Parser\.ts|class Composite/i);
    });

    it('reports missing and conflicting feature-source lineage as hard issues', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeTicket('COV006-demo', 'in_progress', {
        'spec.md': SPEC_TWO_ACS,
        'test-definitions.md': scenarioTitle('demo.DEV1.AC1.markdown_fallback'),
      });
      writeTestFile(
        temporaryDirectory,
        'features/demo.feature',
        [
          'Feature: Demo',
          '',
          '  Rule: untagged',
          '',
          '    Scenario: has no AC tag',
          '      Given a',
          '      When b',
          '      Then c',
          '',
          '  @demo.DEV1.AC1',
          '  Rule: tagged',
          '',
          '    @demo.DEV1.AC2',
          '    Scenario: carries two AC tags',
          '      Given a',
          '      When b',
          '      Then c',
          '',
        ].join('\n'),
      );

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(1);
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(combined).toMatch(/features\/demo\.feature/);
      expect(combined).toMatch(/has no AC tag.*missing lineage/i);
      expect(combined).toMatch(/carries two AC tags.*multiple lineage/i);
    });

    it('renders the coverage advisory slug-first when the folder carries a slug (ZRXM6Q)', async () => {
      await createConfiguredProject(temporaryDirectory);
      // check derives the advisory label from the ticket folder name (id-slug),
      // so a slugged folder must lead with the slug: `slug (ID):`, not bare ID.
      writeTicket('COV003-trace-thing', 'in_progress', {
        'spec.md': SPEC_TWO_ACS,
        'test-definitions.md': scenarioTitle('demo.DEV1.AC1.happy_path'),
      });

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(combined).toMatch(/trace-thing \(COV003\):.*demo\.DEV1\.AC2.*uncovered/i);
    });

    it('stays silent for a done ticket whose scenarios predate the scheme', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeTicket('COV002', 'done', {
        'spec.md': SPEC_TWO_ACS,
        'test-definitions.md': scenarioTitle('A plain free-text scenario title'),
      });

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).not.toMatch(/COV002/);
    });
  });

  describe('Architecture-claim advisory (K4BWTQ)', () => {
    function implPlan(archAlignment: string): string {
      return [
        '# Impl Plan: t',
        '',
        '**Status:** planned',
        '',
        '## Approach',
        '',
        'One slice.',
        '',
        '## Decisions',
        '',
        'skip: none',
        '',
        '## Arch alignment',
        '',
        archAlignment,
        '',
        '## Known deviations',
        '',
        'skip: none',
        '',
        '## Assessment triggers',
        '',
        'skip: none',
        '',
      ].join('\n');
    }

    function writeArchTicket(ticketId: string, archAlignment: string): void {
      const base = `.project/tickets/${ticketId}`;
      writeTestFile(
        temporaryDirectory,
        `${base}/ticket.md`,
        ['---', `id: ${ticketId}`, 'type: feature', 'status: in_progress', '---', ''].join('\n'),
      );
      writeTestFile(temporaryDirectory, `${base}/impl-plan.md`, implPlan(archAlignment));
    }

    it('flags Arch alignment content when the architecture location is absent', async () => {
      await createConfiguredProject(temporaryDirectory);
      rmSync(nodePath.join(temporaryDirectory, '.project', 'architecture.md'), {
        force: true,
      });
      writeArchTicket('ARC001', 'Honors ADR-001 storage ownership.');

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(combined).toMatch(/ARC001/);
      expect(combined).toMatch(/architecture/i);
    });

    it('stays silent when Arch alignment is skip-annotated, even with no architecture location', async () => {
      await createConfiguredProject(temporaryDirectory);
      rmSync(nodePath.join(temporaryDirectory, '.project', 'architecture.md'), {
        force: true,
      });
      writeArchTicket('ARC002', 'skip: no ADRs in this project yet');

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).not.toMatch(/ARC002/);
    });

    it('stays silent when Arch alignment has content and the architecture location exists', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeTestFile(
        temporaryDirectory,
        '.project/architecture.md',
        '# Architecture\n\nA decision.\n',
      );
      writeArchTicket('ARC003', 'Honors the recorded storage decision.');

      const result = await runCli(['check', '--offline'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).not.toMatch(/ARC003/);
    });
  });
});
