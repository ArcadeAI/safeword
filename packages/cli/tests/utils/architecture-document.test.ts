/**
 * Integration tests for the architecture state-document self-heal (ticket
 * QD5DTT, Slice 1). Covers the "structural facts self-heal at session start"
 * rule from features/architecture-state-docs.feature. Temp-dir fixtures; the
 * document lands at the fixed generated path (<namespace-root>/architecture.generated.md).
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  isWouldChangeAction,
  planSelfHeal,
  readDocumentFingerprint,
  selfHeal,
  selfHealProject,
} from '../../src/utils/architecture-document.js';
import { shapeFingerprint } from '../../src/utils/architecture-fingerprint.js';
import { resolveGeneratedArchitecturePath } from '../../src/utils/configured-paths.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const context: { directory: string } = { directory: '' };

function documentPath(directory: string): string {
  return resolveGeneratedArchitecturePath(directory);
}

beforeEach(() => {
  context.directory = createTemporaryDirectory();
  mkdirSync(nodePath.join(context.directory, 'src', 'auth'), { recursive: true });
  writeFileSync(
    nodePath.join(context.directory, 'package.json'),
    JSON.stringify({ name: 'fixture' }),
  );
});

afterEach(() => {
  removeTemporaryDirectory(context.directory);
});

describe('selfHeal — structural facts self-heal at session start', () => {
  it('creates a document when none exists', () => {
    const result = selfHeal(context.directory);

    expect(result.action).toBe('created');
    expect(existsSync(documentPath(context.directory))).toBe(true);
  });

  it('heals the document to the current shape when the fingerprint has moved', () => {
    selfHeal(context.directory);
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });

    const result = selfHeal(context.directory);

    expect(result.action).toBe('healed');
    const content = readFileSync(documentPath(context.directory), 'utf8');
    expect(readDocumentFingerprint(content)).toBe(shapeFingerprint(context.directory));
    expect(content).toContain('billing');
  });

  it('heals a changed module path without changing the legacy fingerprint or staling prose', () => {
    rmSync(nodePath.join(context.directory, 'src', 'auth'), { recursive: true, force: true });
    writeFileSync(nodePath.join(context.directory, 'src', 'auth.ts'), 'export {};\n');
    selfHeal(context.directory);
    const fingerprint = shapeFingerprint(context.directory);

    mkdirSync(nodePath.join(context.directory, 'src', 'auth'), { recursive: true });

    expect(shapeFingerprint(context.directory)).toBe(fingerprint);
    expect(selfHeal(context.directory).action).toBe('healed');
    const content = readFileSync(documentPath(context.directory), 'utf8');
    expect(content).toContain('`src/auth`');
    expect(content).not.toContain('`src/auth.ts`');
    expect(content).not.toContain('⚠ stale');
  });

  it('leaves the document untouched when the fingerprint is unchanged', () => {
    selfHeal(context.directory);
    const before = readFileSync(documentPath(context.directory), 'utf8');

    const result = selfHeal(context.directory);

    expect(result.action).toBe('unchanged');
    expect(readFileSync(documentPath(context.directory), 'utf8')).toBe(before);
  });

  it('leaves a current CRLF document untouched when its paths match', () => {
    selfHeal(context.directory);
    const path = documentPath(context.directory);
    const crlf = readFileSync(path, 'utf8').replaceAll('\n', '\r\n');
    writeFileSync(path, crlf);

    expect(selfHeal(context.directory).action).toBe('unchanged');
    expect(readFileSync(path, 'utf8')).toBe(crlf);
  });

  it('regenerates a safeword-owned document whose fingerprint is missing or corrupt', () => {
    selfHeal(context.directory);
    // Keep safeword's ownership marker; only the fingerprint is mangled away.
    writeFileSync(
      documentPath(context.directory),
      '---\ngenerator: safeword-architecture\n---\n\n# fingerprint corrupted\n',
    );

    const result = selfHeal(context.directory);

    expect(result.action).toBe('regenerated');
    const content = readFileSync(documentPath(context.directory), 'utf8');
    expect(readDocumentFingerprint(content)).toBe(shapeFingerprint(context.directory));
  });

  it('never overwrites a foreign hand-written doc it does not own', () => {
    const foreign = '# Our Architecture\n\nHand-written prose, no safeword marker.\n';
    mkdirSync(nodePath.dirname(documentPath(context.directory)), { recursive: true });
    writeFileSync(documentPath(context.directory), foreign);

    const result = selfHeal(context.directory);

    expect(result.action).toBe('skipped');
    expect(readFileSync(documentPath(context.directory), 'utf8')).toBe(foreign);
  });

  it('skips (not noop) a foreign doc even when the skeleton is empty', () => {
    // No modules here, but a foreign doc exists: ownership wins over the
    // empty-skeleton noop — the doc must be left untouched, never noop'd away.
    rmSync(nodePath.join(context.directory, 'src'), { recursive: true, force: true });
    const foreign = '# Our Architecture\n\nHand-written, no marker.\n';
    mkdirSync(nodePath.dirname(documentPath(context.directory)), { recursive: true });
    writeFileSync(documentPath(context.directory), foreign);

    const result = selfHeal(context.directory);

    expect(result.action).toBe('skipped');
    expect(readFileSync(documentPath(context.directory), 'utf8')).toBe(foreign);
  });

  it('recognizes a safeword-owned doc with CRLF line endings (heals, never skips)', () => {
    selfHeal(context.directory);
    // Re-encode an owned doc with CRLF (git core.autocrlf) and a stale fingerprint.
    mkdirSync(nodePath.dirname(documentPath(context.directory)), { recursive: true });
    writeFileSync(
      documentPath(context.directory),
      '---\r\ngenerator: safeword-architecture\r\nfingerprint: stale\r\n---\r\n\r\n# Architecture\r\n',
    );

    const result = selfHeal(context.directory);

    expect(result.action).toBe('healed');
  });

  it('treats a different generator value as foreign and does not overwrite it', () => {
    const foreign = '---\ngenerator: safeword-architecture-v2\n---\n\n# theirs\n';
    mkdirSync(nodePath.dirname(documentPath(context.directory)), { recursive: true });
    writeFileSync(documentPath(context.directory), foreign);

    const result = selfHeal(context.directory);

    expect(result.action).toBe('skipped');
    expect(readFileSync(documentPath(context.directory), 'utf8')).toBe(foreign);
  });

  it('re-syncs and flags lagging prose when a change is made out of band', () => {
    selfHeal(context.directory);
    // A human adds a module with no agent in the loop, then a session starts.
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });

    selfHeal(context.directory);

    const content = readFileSync(documentPath(context.directory), 'utf8');
    expect(content).toContain('billing');
    expect(content).toMatch(/stale/i);
  });

  it('flags a removed module as orphaned rather than silently dropping it', () => {
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });
    selfHeal(context.directory);
    rmSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true, force: true });

    selfHeal(context.directory);

    const content = readFileSync(documentPath(context.directory), 'utf8');
    expect(content).toMatch(/orphaned/i);
    expect(content).toContain('billing');
  });

  it('does not create a doc when there are no modules and none exists (noop)', () => {
    rmSync(nodePath.join(context.directory, 'src'), { recursive: true, force: true });

    const result = selfHeal(context.directory);

    expect(result.action).toBe('noop');
    expect(existsSync(documentPath(context.directory))).toBe(false);
  });

  it('heals an existing doc toward empty when all modules are removed (not noop)', () => {
    selfHeal(context.directory);
    rmSync(nodePath.join(context.directory, 'src', 'auth'), { recursive: true, force: true });

    const result = selfHeal(context.directory);

    expect(result.action).toBe('healed');
    expect(existsSync(documentPath(context.directory))).toBe(true);
  });
});

describe('planSelfHeal — dry-run action, writes nothing (FPV0E4 Slice 2)', () => {
  it('reports the action selfHeal would take without writing the doc', () => {
    const action = planSelfHeal(context.directory);

    expect(action).toBe('created');
    expect(existsSync(documentPath(context.directory))).toBe(false);
  });

  it('agrees with selfHeal on the action for an unchanged doc', () => {
    selfHeal(context.directory);

    expect(planSelfHeal(context.directory)).toBe('unchanged');
    // A second plan call still mutates nothing.
    const before = readFileSync(documentPath(context.directory), 'utf8');
    planSelfHeal(context.directory);
    expect(readFileSync(documentPath(context.directory), 'utf8')).toBe(before);
  });

  it('reports healed for a moved fingerprint without touching the doc', () => {
    selfHeal(context.directory);
    const before = readFileSync(documentPath(context.directory), 'utf8');
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });

    expect(planSelfHeal(context.directory)).toBe('healed');
    expect(readFileSync(documentPath(context.directory), 'utf8')).toBe(before);
  });

  it('reports noop for a project with no modules and no doc', () => {
    rmSync(nodePath.join(context.directory, 'src'), { recursive: true, force: true });

    expect(planSelfHeal(context.directory)).toBe('noop');
    expect(existsSync(documentPath(context.directory))).toBe(false);
  });

  it('reports skipped for a foreign doc and leaves it untouched', () => {
    const foreign = '# Our Architecture\n\nHand-written, no marker.\n';
    mkdirSync(nodePath.dirname(documentPath(context.directory)), { recursive: true });
    writeFileSync(documentPath(context.directory), foreign);

    expect(planSelfHeal(context.directory)).toBe('skipped');
    expect(readFileSync(documentPath(context.directory), 'utf8')).toBe(foreign);
  });
});

const PLACEHOLDER = 'No description yet — awaiting prose.';

/** Extract a single `### name` section's text (to its next heading or EOF). */
function sectionText(content: string, name: string): string {
  const chunk = content.split('\n### ').find(part => part.startsWith(`${name}\n`));
  return chunk === undefined ? '' : `### ${chunk.split('\n## ', 1)[0]}`;
}

describe('selfHeal — per-section prose persistence (JT852Q layer A)', () => {
  /** Create the doc, then replace auth's placeholder with real prose on disk. */
  function seedWithProse(prose: string): void {
    selfHeal(context.directory);
    const path = documentPath(context.directory);
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace(PLACEHOLDER, () => prose),
    );
  }

  function addModule(name: string): void {
    mkdirSync(nodePath.join(context.directory, 'src', name), { recursive: true });
  }

  function read(): string {
    return readFileSync(documentPath(context.directory), 'utf8');
  }

  it('preserves an unaffected section prose byte-identical across a writing heal', () => {
    seedWithProse('Handles login and tokens.');
    addModule('billing');

    const result = selfHeal(context.directory);

    expect(result.action).toBe('healed');
    expect(sectionText(read(), 'auth')).toContain('Handles login and tokens.');
    expect(sectionText(read(), 'auth')).not.toContain(PLACEHOLDER);
  });

  it('births a new module with the placeholder, not the neighbour prose', () => {
    seedWithProse('Handles login and tokens.');
    addModule('billing');

    selfHeal(context.directory);

    expect(sectionText(read(), 'billing')).toContain(PLACEHOLDER);
    expect(sectionText(read(), 'auth')).toContain('Handles login and tokens.');
    expect(sectionText(read(), 'auth')).not.toContain(PLACEHOLDER);
  });

  it('restores the placeholder when a section prose was emptied (writing heal)', () => {
    seedWithProse('Handles login and tokens.');
    const path = documentPath(context.directory);
    writeFileSync(path, readFileSync(path, 'utf8').replace('Handles login and tokens.', ''));
    addModule('billing');

    selfHeal(context.directory);

    expect(sectionText(read(), 'auth')).toContain(PLACEHOLDER);
  });

  it('preserves prose and flags the section stale on a structural change', () => {
    seedWithProse('Handles login and tokens.');
    addModule('billing');

    selfHeal(context.directory);

    const auth = sectionText(read(), 'auth');
    expect(auth).toContain('Handles login and tokens.');
    expect(auth).toMatch(/stale/i);
  });

  it('keeps exactly one stale marker when re-healing an already-stale section', () => {
    seedWithProse('Handles login and tokens.');
    addModule('billing');
    selfHeal(context.directory); // auth now stale
    addModule('reports');
    selfHeal(context.directory); // heal again

    const auth = sectionText(read(), 'auth');
    expect(auth).toContain('Handles login and tokens.');
    expect(auth.match(/⚠ stale/g) ?? []).toHaveLength(1);
  });

  it('preserves a multi-paragraph description across a writing heal', () => {
    seedWithProse('First paragraph.\n\nSecond paragraph.');
    addModule('billing');

    selfHeal(context.directory);

    const auth = sectionText(read(), 'auth');
    expect(auth).toContain('First paragraph.');
    expect(auth).toContain('Second paragraph.');
  });

  it('preserves prose when the doc uses CRLF line endings', () => {
    seedWithProse('Handles login and tokens.');
    const path = documentPath(context.directory);
    writeFileSync(path, readFileSync(path, 'utf8').replaceAll('\n', '\r\n'));
    addModule('billing');

    selfHeal(context.directory);

    const auth = sectionText(read(), 'auth');
    expect(auth).toContain('Handles login and tokens.');
    expect(auth).toMatch(/stale/i);
  });

  it('reaches a byte-identical fixed point after a writing heal', () => {
    seedWithProse('Handles login and tokens.');
    addModule('billing');
    expect(selfHeal(context.directory).action).toBe('healed');
    const after = read();

    expect(selfHeal(context.directory).action).toBe('unchanged');
    expect(read()).toBe(after);
  });
});

describe('selfHealProject — metadata-seeded purposes (GitHub #1608)', () => {
  function makeMonorepoPackage(name: string, description: string): string {
    const directory = nodePath.join(context.directory, 'packages', name);
    mkdirSync(nodePath.join(directory, 'src'), { recursive: true });
    writeFileSync(nodePath.join(directory, 'package.json'), JSON.stringify({ name, description }));
    return directory;
  }

  beforeEach(() => {
    rmSync(nodePath.join(context.directory, 'src'), { recursive: true, force: true });
    writeFileSync(
      nodePath.join(context.directory, 'package.json'),
      JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
    );
  });

  it('seeds both a leaf module and its monorepo-root package section', () => {
    const packageDirectory = makeMonorepoPackage('worker', 'Runs background jobs.');
    writeFileSync(
      nodePath.join(packageDirectory, 'src', 'queue.ts'),
      '/** Dispatches queued background work. More detail. */\nexport {};\n',
    );

    selfHealProject(context.directory);

    const leaf = readFileSync(nodePath.join(packageDirectory, 'architecture.generated.md'), 'utf8');
    const root = readFileSync(documentPath(context.directory), 'utf8');
    expect(leaf).toContain('Dispatches queued background work.');
    expect(root).toContain('Runs background jobs.');
    expect(leaf).toContain('<!-- seeded-purpose:');
    expect(root).toContain('<!-- seeded-purpose:');
  });

  it('keeps a package description when its source modules cannot be introspected', () => {
    makeMonorepoPackage('worker', 'Runs background jobs.');

    selfHealProject(context.directory);

    const root = readFileSync(documentPath(context.directory), 'utf8');
    expect(root).toContain('Runs background jobs.');
    expect(root).toContain('not introspected');
    expect(root).toContain('<!-- seeded-purpose:');
  });

  it('renders only the honesty marker for a fresh un-introspected package without metadata', () => {
    const packageDirectory = makeMonorepoPackage('worker', '');
    writeFileSync(
      nodePath.join(packageDirectory, 'package.json'),
      JSON.stringify({ name: 'worker' }),
    );

    selfHealProject(context.directory);

    const worker = sectionText(readFileSync(documentPath(context.directory), 'utf8'), 'worker');
    expect(worker).toContain('not introspected — no source modules to map');
    expect(worker).not.toContain(PLACEHOLDER);
    expect(worker).not.toContain('<!-- seeded-purpose:');
  });

  it('refreshes an un-introspected package description on a later root heal', () => {
    const workerDirectory = makeMonorepoPackage('worker', 'Runs background jobs.');
    selfHealProject(context.directory);
    writeFileSync(
      nodePath.join(workerDirectory, 'package.json'),
      JSON.stringify({ name: 'worker', description: 'Runs scheduled background jobs.' }),
    );
    const webDirectory = makeMonorepoPackage('web', 'The user interface.');
    writeFileSync(nodePath.join(webDirectory, 'src', 'app.ts'), 'export {};\n');

    selfHealProject(context.directory);

    const root = readFileSync(documentPath(context.directory), 'utf8');
    expect(root).toContain('Runs scheduled background jobs.');
    expect(root).not.toContain('Runs background jobs.');
  });

  it('preserves human prose over a previous metadata seed on a later heal', () => {
    const packageDirectory = makeMonorepoPackage('worker', 'Runs background jobs.');
    writeFileSync(nodePath.join(packageDirectory, 'src', 'queue.ts'), 'export {};\n');
    selfHealProject(context.directory);
    const rootDocument = documentPath(context.directory);
    writeFileSync(
      rootDocument,
      readFileSync(rootDocument, 'utf8').replace(
        'Runs background jobs.',
        'Operated by the platform team.',
      ),
    );
    makeMonorepoPackage('web', 'The user interface.');
    writeFileSync(
      nodePath.join(context.directory, 'packages', 'web', 'src', 'app.ts'),
      'export {};\n',
    );

    selfHealProject(context.directory);

    const root = readFileSync(rootDocument, 'utf8');
    expect(root).toContain('Operated by the platform team.');
    expect(root).not.toContain('Runs background jobs.');
  });

  it('preserves human root prose over the original placeholder on a later heal', () => {
    const packageDirectory = makeMonorepoPackage('worker', '');
    writeFileSync(
      nodePath.join(packageDirectory, 'package.json'),
      JSON.stringify({ name: 'worker' }),
    );
    writeFileSync(nodePath.join(packageDirectory, 'src', 'queue.ts'), 'export {};\n');
    selfHealProject(context.directory);
    const rootDocument = documentPath(context.directory);
    writeFileSync(
      rootDocument,
      readFileSync(rootDocument, 'utf8').replace(PLACEHOLDER, 'Owned by the platform team.'),
    );
    const webDirectory = makeMonorepoPackage('web', 'The user interface.');
    writeFileSync(nodePath.join(webDirectory, 'src', 'app.ts'), 'export {};\n');

    selfHealProject(context.directory);

    const root = readFileSync(rootDocument, 'utf8');
    expect(root).toContain('Owned by the platform team.');
    expect(root).not.toContain(PLACEHOLDER);
  });

  it('preserves a human leaf-purpose edit over a previous source-comment seed', () => {
    const packageDirectory = makeMonorepoPackage('worker', 'Runs background jobs.');
    writeFileSync(
      nodePath.join(packageDirectory, 'src', 'queue.ts'),
      '/** Dispatches queued background work. */\nexport {};\n',
    );
    selfHealProject(context.directory);
    const leafPath = nodePath.join(packageDirectory, 'architecture.generated.md');
    writeFileSync(
      leafPath,
      readFileSync(leafPath, 'utf8').replace(
        'Dispatches queued background work.',
        'Owned by the reliability team.',
      ),
    );
    writeFileSync(nodePath.join(packageDirectory, 'src', 'schedule.ts'), 'export {};\n');

    selfHealProject(context.directory);

    const leaf = readFileSync(leafPath, 'utf8');
    expect(leaf).toContain('Owned by the reliability team.');
    expect(leaf).not.toContain('Dispatches queued background work.');
  });

  it('replaces removed metadata seeds with the current fallback instead of preserving stale prose', () => {
    const packageDirectory = makeMonorepoPackage('worker', 'Runs background jobs.');
    writeFileSync(
      nodePath.join(packageDirectory, 'src', 'queue.ts'),
      '/** Dispatches queued background work. */\nexport {};\n',
    );
    selfHealProject(context.directory);
    writeFileSync(
      nodePath.join(packageDirectory, 'package.json'),
      JSON.stringify({ name: 'worker' }),
    );
    writeFileSync(nodePath.join(packageDirectory, 'src', 'queue.ts'), 'export {};\n');
    writeFileSync(nodePath.join(packageDirectory, 'src', 'schedule.ts'), 'export {};\n');
    const webDirectory = makeMonorepoPackage('web', 'The user interface.');
    writeFileSync(nodePath.join(webDirectory, 'src', 'app.ts'), 'export {};\n');

    selfHealProject(context.directory);

    const leaf = readFileSync(nodePath.join(packageDirectory, 'architecture.generated.md'), 'utf8');
    const root = readFileSync(documentPath(context.directory), 'utf8');
    expect(leaf).toContain(PLACEHOLDER);
    expect(leaf).not.toContain('Dispatches queued background work.');
    expect(root).toContain(PLACEHOLDER);
    expect(root).not.toContain('Runs background jobs.');
  });

  it('upgrades current leaf and root documents from placeholders to available metadata seeds', () => {
    const packageDirectory = makeMonorepoPackage('worker', 'Runs background jobs.');
    writeFileSync(
      nodePath.join(packageDirectory, 'src', 'queue.ts'),
      '/** Dispatches queued background work. */\nexport {};\n',
    );
    selfHealProject(context.directory);
    const leafPath = nodePath.join(packageDirectory, 'architecture.generated.md');
    const rootPath = documentPath(context.directory);
    for (const [path, purpose] of [
      [leafPath, 'Dispatches queued background work.'],
      [rootPath, 'Runs background jobs.'],
    ] as const) {
      writeFileSync(
        path,
        readFileSync(path, 'utf8')
          .replaceAll(/<!-- seeded-purpose: [a-f0-9]{64} -->\n/g, '')
          .replaceAll(purpose, () => PLACEHOLDER),
      );
    }

    const results = selfHealProject(context.directory);

    expect(results.map(result => result.action)).toEqual(['healed', 'healed']);
    expect(readFileSync(leafPath, 'utf8')).toContain('Dispatches queued background work.');
    expect(readFileSync(rootPath, 'utf8')).toContain('Runs background jobs.');
  });

  it('heals a generator-owned purpose when its leading module documentation changes', () => {
    const packageDirectory = makeMonorepoPackage('worker', 'Runs background jobs.');
    const queuePath = nodePath.join(packageDirectory, 'src', 'queue.ts');
    writeFileSync(queuePath, '/** Dispatches queued background work. */\nexport {};\n');
    selfHealProject(context.directory);

    writeFileSync(queuePath, '/** Schedules queued background work. */\nexport {};\n');

    const results = selfHealProject(context.directory);
    const leaf = readFileSync(nodePath.join(packageDirectory, 'architecture.generated.md'), 'utf8');
    expect(results.map(result => result.action)).toEqual(['unchanged', 'healed']);
    expect(leaf).toContain('Schedules queued background work.');
    expect(leaf).not.toContain('Dispatches queued background work.');
  });
});

describe('isWouldChangeAction — the enforcement threshold (FPV0E4 Slice 2)', () => {
  it('is true exactly for created, healed, and regenerated', () => {
    expect(isWouldChangeAction('created')).toBe(true);
    expect(isWouldChangeAction('healed')).toBe(true);
    expect(isWouldChangeAction('regenerated')).toBe(true);
  });

  it('is false for unchanged, noop, and skipped', () => {
    expect(isWouldChangeAction('unchanged')).toBe(false);
    expect(isWouldChangeAction('noop')).toBe(false);
    expect(isWouldChangeAction('skipped')).toBe(false);
  });
});
