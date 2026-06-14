import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

type DocumentationSourceDecision =
  | { kind: 'unset' }
  | { kind: 'explicit-none' }
  | { kind: 'configured'; sources: Array<{ type: string; path?: string; resolvedPath?: string }> };

interface DocumentationSourcesWorld extends SafewordWorld {
  documentationSourceDecision?: DocumentationSourceDecision;
  projectDirectory?: string;
}

function createProjectDirectory(): string {
  const directory = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-docs-sources-'));
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  return directory;
}

function writeConfig(directory: string, config: Record<string, unknown>): void {
  writeFileSync(
    nodePath.join(directory, '.safeword', 'config.json'),
    JSON.stringify(config, undefined, 2),
  );
}

function readAuditTemplate(): string {
  return readFileSync(
    nodePath.join(process.cwd(), 'packages/cli/templates/skills/audit/SKILL.md'),
    'utf8',
  );
}

function readDocumentationSourceDecision(directory: string): DocumentationSourceDecision {
  const configPath = nodePath.join(directory, '.safeword', 'config.json');
  const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as {
    docs?: { sources?: unknown };
  };
  const sources = parsed.docs?.sources;
  if (!Array.isArray(sources)) return { kind: 'unset' };
  if (sources.length === 0) return { kind: 'explicit-none' };
  return {
    kind: 'configured',
    sources: sources
      .filter((source): source is { type: string; path?: string } => {
        return Boolean(source) && typeof source === 'object' && 'type' in source;
      })
      .map(source => {
        if (source.type !== 'local' || source.path === undefined) return source;
        return {
          ...source,
          resolvedPath: nodePath.isAbsolute(source.path)
            ? source.path
            : nodePath.join(directory, source.path),
        };
      }),
  };
}

After(function (this: DocumentationSourcesWorld) {
  if (this.projectDirectory === undefined) return;
  rmSync(this.projectDirectory, { recursive: true, force: true });
});

Given(
  'a project configures local documentation source {string}',
  function (this: DocumentationSourcesWorld, sourcePath: string) {
    this.projectDirectory = createProjectDirectory();
    writeConfig(this.projectDirectory, {
      docs: { sources: [{ type: 'local', path: sourcePath }] },
    });
  },
);

Given(
  'a project has no configured documentation source decision',
  function (this: DocumentationSourcesWorld) {
    this.projectDirectory = createProjectDirectory();
    writeConfig(this.projectDirectory, { installedPacks: ['typescript'] });
  },
);

Given(
  'a project configures malformed documentation sources and local source {string}',
  function (this: DocumentationSourcesWorld, sourcePath: string) {
    this.projectDirectory = createProjectDirectory();
    writeConfig(this.projectDirectory, {
      docs: {
        sources: [
          'docs',
          { type: 'local', path: '' },
          { type: 'unsupported', path: 'docs' },
          { type: 'local', path: sourcePath },
        ],
      },
    });
  },
);

Given(
  'a project explicitly configures no documentation sources',
  function (this: DocumentationSourcesWorld) {
    this.projectDirectory = createProjectDirectory();
    writeConfig(this.projectDirectory, { docs: { sources: [] } });
  },
);

When('audit reads the documentation source decision', function (this: DocumentationSourcesWorld) {
  assert.ok(this.projectDirectory, 'project directory was not created');
  this.documentationSourceDecision = readDocumentationSourceDecision(this.projectDirectory);
});

Then('the documentation source decision is configured', function (this: DocumentationSourcesWorld) {
  assert.equal(this.documentationSourceDecision?.kind, 'configured');
});

Then(
  'the configured documentation sources include local source {string}',
  function (this: DocumentationSourcesWorld, sourcePath: string) {
    const decision = this.documentationSourceDecision;
    assert.equal(decision?.kind, 'configured');
    assert.ok(
      decision.sources.some(source => source.type === 'local' && source.path === sourcePath),
      `configured local source ${sourcePath} was not found`,
    );
  },
);

Then(
  'the configured local source {string} resolves inside the project root',
  function (this: DocumentationSourcesWorld, sourcePath: string) {
    const decision = this.documentationSourceDecision;
    assert.equal(decision?.kind, 'configured');
    const source = decision.sources.find(
      entry => entry.type === 'local' && entry.path === sourcePath,
    );
    assert.ok(source, `configured local source ${sourcePath} was not found`);
    assert.equal(source.resolvedPath, nodePath.join(this.projectDirectory ?? '', sourcePath));
  },
);

Then('audit should prompt for documentation sources', function (this: DocumentationSourcesWorld) {
  assert.equal(this.documentationSourceDecision?.kind, 'unset');
  assert.match(readAuditTemplate(), /If `docs\.sources` is absent, prompt the user/);
});

Then(
  'audit should not prompt for documentation sources again',
  function (this: DocumentationSourcesWorld) {
    assert.equal(this.documentationSourceDecision?.kind, 'explicit-none');
    assert.match(readAuditTemplate(), /If `docs\.sources: \[\]` is configured, do not prompt/);
  },
);

Then(
  'audit should use fallback documentation discovery',
  function (this: DocumentationSourcesWorld) {
    assert.equal(this.documentationSourceDecision?.kind, 'explicit-none');
    assert.match(readAuditTemplate(), /Fall back to local discovery/);
  },
);
