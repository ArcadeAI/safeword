import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  cleanupInstalledPlanningContextFixtures,
  installedContextFolder as folder,
  installedContextPrinciple as principle,
  installedPlanningContextFixture,
} from '../installed-planning-context-fixtures.js';

afterEach(cleanupInstalledPlanningContextFixtures);

const fixture = () => installedPlanningContextFixture('quality-review');

describe('required context through installed Product Plan review', () => {
  it('admits a populated nested persona outcome inventory through installed dispatch', () => {
    const project = fixture();
    const path = nodePath.join(project.project, '.project/tickets', folder, 'spec.md');
    const inventory =
      '- **Persona outcome inventory:**\n  - **Builder:** Current approval succeeds; missing context refuses with a repair action.';
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace(
        /- \*\*Persona outcome inventory:\*\*[^\n]*/u,
        () => inventory,
      ),
    );
    const result = project.review();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(JSON.parse(result.stdout).data.status).toBe('approved');
    const packet = JSON.parse(readFileSync(project.capture, 'utf8'));
    expect(packet.logical_files).toEqual([
      expect.objectContaining({ content: expect.stringContaining(inventory) }),
    ]);
  });
  it.each([
    ['missing', ''],
    ['blank', '- **Persona outcome inventory:**'],
    ['comment-only nested list', '- **Persona outcome inventory:**\n  - <!-- not an outcome -->'],
    ['unrelated sibling', '- **Persona outcome inventory:**\n- Builder succeeds.'],
    [
      'duplicate',
      '- **Persona outcome inventory:**\n  - Builder succeeds.\n- **Persona outcome inventory:** Builder recovers.',
    ],
  ])('refuses a %s persona inventory before installed reviewer execution', (_label, inventory) => {
    const project = fixture();
    const path = nodePath.join(project.project, '.project/tickets', folder, 'spec.md');
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace(
        /- \*\*Persona outcome inventory:\*\*[^\n]*/u,
        () => inventory,
      ),
    );
    const result = project.review();
    expect(result.status, `${result.stdout}\n${result.stderr}`).not.toBe(0);
    expect(JSON.parse(result.stdout).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing_planning_context',
          metadata: { context_role: 'project', context_path: `.project/tickets/${folder}/spec.md` },
        }),
      ]),
    );
    expect(existsSync(project.capture)).toBe(false);
  });
  it('supplies all current project inventories without caller context', () => {
    const project = fixture();
    const result = project.review();
    expect(
      result.status,
      `installed Product review must resolve current principles\n${result.stdout}\n${result.stderr}`,
    ).toBe(0);
    const packet = JSON.parse(readFileSync(project.capture, 'utf8'));
    expect(packet.planning_phase).toBe('product-plan');
    const expectedPrinciples = expect.objectContaining({
      path: '.project/approval-principles.md',
      content: expect.stringContaining(principle),
    });
    const expectedPersonas = expect.objectContaining({
      path: '.project/personas.md',
      content: expect.stringContaining('Builder needs trustworthy approvals.'),
    });
    const expectedSurfaces = expect.objectContaining({
      path: '.project/surfaces.md',
      content: expect.stringContaining('The public CLI approves plans.'),
    });
    expect(packet.context_files).toEqual(
      expect.arrayContaining([expectedPrinciples, expectedPersonas, expectedSurfaces]),
    );
  });
  it.each(['principles', 'personas', 'surfaces'] as const)(
    'refuses missing Product review %s before reviewer execution',
    role => {
      const project = fixture();
      const contextPath =
        role === 'principles' ? '.project/approval-principles.md' : `.project/${role}.md`;
      rmSync(nodePath.join(project.project, contextPath));
      const result = project.review();
      expect(result.status, `missing Product ${role} must not enter reviewer execution`).not.toBe(
        0,
      );
      const output = JSON.parse(result.stdout);
      expect(output.findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'missing_planning_context',
            metadata: { context_role: role, context_path: contextPath },
          }),
        ]),
      );
      expect(
        existsSync(project.capture),
        'missing Product context must block before reviewer execution',
      ).toBe(false);
      expect(output.data?.status).not.toBe('approved');
      expect(
        output.recovery.map((action: { description: string }) => action.description).join('\n'),
      ).toContain(`paths.${role}`);
    },
  );
});
