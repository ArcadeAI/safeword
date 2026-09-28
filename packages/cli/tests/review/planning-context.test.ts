import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { prepareReviewPacket } from '../../src/review/packet.js';

const projects: string[] = [];

function project(): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-context-role-'));
  projects.push(root);
  mkdirSync(nodePath.join(root, '.project'));
  writeFileSync(
    nodePath.join(root, 'impl-plan.md'),
    '# Impl Plan\n\nPreserve accepted behavior.\n',
  );
  writeFileSync(nodePath.join(root, 'spec.md'), '# Product Plan\n\nPreserve accepted behavior.\n');
  for (const role of ['principles', 'personas', 'surfaces']) {
    writeFileSync(nodePath.join(root, '.project', `${role}.md`), `# ${role}\n\nCURRENT ${role}\n`);
  }
  return root;
}

afterEach(() => {
  for (const root of projects) rmSync(root, { recursive: true, force: true });
  projects.length = 0;
});

describe('required planning inventory sources at packet preparation', () => {
  it.each(['personas', 'surfaces'])(
    'includes the current %s without caller-supplied context',
    role => {
      const root = project();
      const prepared = prepareReviewPacket(
        root,
        'plan-implementation',
        ['impl-plan.md'],
        ['spec.md'],
      );
      try {
        const source = prepared.packet.context_files?.find(
          file => file.path === `.project/${role}.md`,
        );
        expect(source).toMatchObject({
          path: `.project/${role}.md`,
          content: expect.stringContaining(`CURRENT ${role}`),
        });
      } finally {
        prepared.cleanup();
      }
    },
  );

  it.each(['personas', 'surfaces'])('refuses a missing required %s source', role => {
    const root = project();
    rmSync(nodePath.join(root, '.project', `${role}.md`));
    let failure: unknown;
    try {
      const prepared = prepareReviewPacket(
        root,
        'plan-implementation',
        ['impl-plan.md'],
        ['spec.md'],
      );
      prepared.cleanup();
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      code: 'missing_planning_context',
      contextRole: role,
      contextPath: `.project/${role}.md`,
    });
  });
  it('retains an explicitly supplied principles source exactly once', () => {
    const root = project();
    const prepared = prepareReviewPacket(
      root,
      'plan-implementation',
      ['impl-plan.md'],
      ['spec.md', '.project/principles.md'],
    );
    try {
      const sources = prepared.packet.context_files?.filter(
        file => file.path === '.project/principles.md',
      );
      expect(sources).toHaveLength(1);
    } finally {
      prepared.cleanup();
    }
  });

  it.each(['principles', 'personas', 'surfaces'])(
    'refuses a broken %s override despite an intact default',
    role => {
      const root = project();
      mkdirSync(nodePath.join(root, '.safeword'));
      writeFileSync(
        nodePath.join(root, '.safeword/config.json'),
        JSON.stringify({ paths: { [role]: '' } }),
      );
      let failure: unknown;
      try {
        const prepared = prepareReviewPacket(
          root,
          'plan-implementation',
          ['impl-plan.md'],
          ['spec.md'],
        );
        prepared.cleanup();
      } catch (error) {
        failure = error;
      }
      expect(failure).toMatchObject({
        code: 'missing_planning_context',
        contextRole: role,
        contextPath: `.safeword/config.json:paths.${role}`,
      });
    },
  );
});
