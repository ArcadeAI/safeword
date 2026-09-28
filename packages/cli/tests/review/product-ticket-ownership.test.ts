import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { prepareReviewPacket } from '../../src/review/packet.js';
import { createConfiguredProject, createTemporaryDirectory } from '../helpers.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import { PLANNING_ROLE_PRODUCT } from '../planning-role-fixtures.js';

const projects: string[] = [];
afterEach(() => {
  for (const project of projects) rmSync(project, { recursive: true, force: true });
  projects.length = 0;
});

describe('opaque ticket IDs at actual Product review classification', () => {
  it.each(['000123', '1E0003', '123456'])('preserves generated numeric-looking ID %s', async id => {
    const project = createTemporaryDirectory();
    projects.push(project);
    await createConfiguredProject(project);
    writePlanningInventories(project);
    const folder = `.project/tickets/${id}-ownership`;
    mkdirSync(nodePath.join(project, folder), { recursive: true });
    const ticket = `---\nid: ${id}\ntype: feature\nphase: intake\nstatus: in_progress\nproduct_plan_contract: v1\nscope: preserve opaque IDs\n---\n`;
    writeFileSync(nodePath.join(project, folder, 'ticket.md'), ticket);
    writeFileSync(nodePath.join(project, folder, 'spec.md'), PLANNING_ROLE_PRODUCT);
    const prepared = prepareReviewPacket(
      project,
      'quality-review',
      [`${folder}/spec.md`],
      [`${folder}/ticket.md`],
    );
    try {
      expect(prepared.packet.planning_phase).toBe('product-plan');
      expect(prepared.packet.context_files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: `${folder}/ticket.md`, content: ticket }),
        ]),
      );
    } finally {
      prepared.cleanup();
    }
  });
  it.each([
    ['wrong identity', 'OWN456', 'OWN123-ownership'],
    ['missing identity', undefined, 'OWN123-ownership'],
    ['non-scalar identity', ['OWN123'], 'OWN123-ownership'],
    ['blank identity', '', '-ownership'],
  ] as const)('refuses owned Product metadata with %s', async (_label, id, directory) => {
    const project = createTemporaryDirectory();
    projects.push(project);
    await createConfiguredProject(project);
    writePlanningInventories(project);
    const folder = `.project/tickets/${directory}`;
    mkdirSync(nodePath.join(project, folder), { recursive: true });
    const identifier = id === undefined ? '' : `id: ${JSON.stringify(id)}\n`;
    writeFileSync(
      nodePath.join(project, folder, 'ticket.md'),
      `---\n${identifier}type: feature\nphase: intake\nproduct_plan_contract: v1\n---\n`,
    );
    writeFileSync(nodePath.join(project, folder, 'spec.md'), '# Product Plan\n\nPreserve IDs.\n');
    let failure: unknown;
    try {
      const prepared = prepareReviewPacket(project, 'quality-review', [`${folder}/spec.md`]);
      prepared.cleanup();
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      code: 'missing_planning_context',
      contextRole: 'ticket',
      contextPath: `${folder}/ticket.md`,
    });
  });
});
