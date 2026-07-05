/**
 * Unit tests for narrative resolution and the drift IO seam (ticket BY7RNR,
 * GitHub #848). Resolution rule (spec Vocabulary): a non-empty
 * `paths.architecture` wins outright — even when its target is missing on
 * disk — else the root `ARCHITECTURE.md`. Temp-dir fixtures.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { architectureNarrativeDriftAdvisoryForProject } from '../../src/utils/architecture-narrative-drift.js';
import { resolveArchitectureNarrative } from '../../src/utils/configured-paths.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const context: { directory: string } = { directory: '' };

beforeEach(() => {
  context.directory = createTemporaryDirectory();
});

afterEach(() => {
  removeTemporaryDirectory(context.directory);
});

function writeConfig(paths: Record<string, string>): void {
  mkdirSync(nodePath.join(context.directory, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(context.directory, '.safeword', 'config.json'),
    JSON.stringify({ paths }),
  );
}

function writeGeneratedRootIndex(packageNames: string[]): void {
  mkdirSync(nodePath.join(context.directory, '.project'), { recursive: true });
  const sections = packageNames.map(name => `### ${name}\n`).join('\n');
  writeFileSync(
    nodePath.join(context.directory, '.project', 'architecture.generated.md'),
    `---\ngenerator: safeword-architecture\nfingerprint: f1\n---\n\n# Architecture\n\n## Packages\n\n${sections}\n## Dependencies\n\n_None._\n`,
  );
}

describe('resolveArchitectureNarrative', () => {
  it('resolves a configured relative path against the project root and keeps it as the display path', () => {
    writeConfig({ architecture: 'docs/agents/architecture.md' });

    const narrative = resolveArchitectureNarrative(context.directory);

    expect(narrative.absolutePath).toBe(
      nodePath.join(context.directory, 'docs/agents/architecture.md'),
    );
    expect(narrative.displayPath).toBe('docs/agents/architecture.md');
  });

  it('uses a configured absolute path verbatim', () => {
    const absolute = nodePath.join(context.directory, 'elsewhere', 'arch.md');
    writeConfig({ architecture: absolute });

    expect(resolveArchitectureNarrative(context.directory).absolutePath).toBe(absolute);
  });

  it('falls back to root ARCHITECTURE.md when unconfigured', () => {
    const narrative = resolveArchitectureNarrative(context.directory);

    expect(narrative.absolutePath).toBe(nodePath.join(context.directory, 'ARCHITECTURE.md'));
    expect(narrative.displayPath).toBe('ARCHITECTURE.md');
  });

  it('treats an empty-string value as unconfigured', () => {
    writeConfig({ architecture: '' });

    expect(resolveArchitectureNarrative(context.directory).absolutePath).toBe(
      nodePath.join(context.directory, 'ARCHITECTURE.md'),
    );
  });
});

describe('architectureNarrativeDriftAdvisoryForProject', () => {
  it('reports packages a single-file narrative never mentions', () => {
    writeGeneratedRootIndex(['web', 'billing']);
    writeFileSync(
      nodePath.join(context.directory, 'ARCHITECTURE.md'),
      '# Architecture\n\nThe web package serves the UI.\n',
    );

    const advisory = architectureNarrativeDriftAdvisoryForProject(context.directory);

    expect(advisory).toBeDefined();
    expect(advisory).toContain('billing');
  });

  it('scans every record of a configured decision-record directory', () => {
    writeGeneratedRootIndex(['web', 'billing']);
    writeConfig({ architecture: 'docs/adr' });
    mkdirSync(nodePath.join(context.directory, 'docs', 'adr'), { recursive: true });
    writeFileSync(nodePath.join(context.directory, 'docs', 'adr', '0001-web.md'), 'web\n');
    writeFileSync(nodePath.join(context.directory, 'docs', 'adr', '0002-billing.md'), 'billing\n');

    expect(architectureNarrativeDriftAdvisoryForProject(context.directory)).toBeUndefined();
  });

  it('is silent when the resolved narrative is missing', () => {
    writeGeneratedRootIndex(['web']);

    expect(architectureNarrativeDriftAdvisoryForProject(context.directory)).toBeUndefined();
  });

  it('is silent for an EMPTY configured directory (deliberate asymmetry: the nudge still fires there)', () => {
    writeGeneratedRootIndex(['web']);
    writeConfig({ architecture: 'docs/adr' });
    mkdirSync(nodePath.join(context.directory, 'docs', 'adr'), { recursive: true });

    expect(architectureNarrativeDriftAdvisoryForProject(context.directory)).toBeUndefined();
  });

  it('never falls back to a root file when a configured target is missing', () => {
    writeGeneratedRootIndex(['web', 'billing']);
    writeConfig({ architecture: 'docs/missing.md' });
    writeFileSync(
      nodePath.join(context.directory, 'ARCHITECTURE.md'),
      '# Architecture\n\nNothing mentioned.\n',
    );

    expect(architectureNarrativeDriftAdvisoryForProject(context.directory)).toBeUndefined();
  });

  it('is silent when no generated doc exists', () => {
    writeFileSync(nodePath.join(context.directory, 'ARCHITECTURE.md'), '# Architecture\n');

    expect(architectureNarrativeDriftAdvisoryForProject(context.directory)).toBeUndefined();
  });
});
