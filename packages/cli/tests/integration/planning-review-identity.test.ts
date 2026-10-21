import { existsSync, readFileSync, rmSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  cleanupInstalledPlanningContextFixtures,
  installedContextPrinciple as principle,
  installedPlanningContextFixture,
} from '../installed-planning-context-fixtures.js';

afterEach(cleanupInstalledPlanningContextFixtures);

const fixture = () => installedPlanningContextFixture('plan-implementation');

describe('required context through installed planning review', () => {
  it(
    'resolves current configured principles without requiring the caller to supply them',
    { timeout: 60_000 },
    () => {
      const project = fixture();
      const result = project.review();
      expect(
        result.status,
        `installed review must resolve current configured principles\n${result.stdout}\n${result.stderr}`,
      ).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'healthy',
        data: { status: 'approved', actual_reviewer: 'claude' },
      });
      const packet = JSON.parse(readFileSync(project.capture, 'utf8'));
      const expectedPrinciples = expect.objectContaining({
        path: '.project/approval-principles.md',
        content: expect.stringContaining(principle),
      });
      expect(packet.context_files).toEqual(expect.arrayContaining([expectedPrinciples]));
    },
  );
  it(
    'refuses a missing configured principles file before invoking the reviewer',
    { timeout: 60_000 },
    () => {
      const project = fixture();
      rmSync(nodePath.join(project.project, '.project/approval-principles.md'));
      const result = project.review();
      expect(
        result.status,
        'missing configured principles must not enter reviewer execution',
      ).not.toBe(0);
      const output = JSON.parse(result.stdout);
      const expectedMissingContext = expect.objectContaining({
        code: 'missing_planning_context',
        metadata: expect.objectContaining({
          context_role: 'principles',
          context_path: '.project/approval-principles.md',
        }),
      });
      expect(output.findings).toEqual(expect.arrayContaining([expectedMissingContext]));
      const repair = output.recovery
        .map((action: { description: string }) => action.description)
        .join('\n');
      expect(repair).toContain('paths.principles');
      expect(repair).toContain('rerun the planning review');
      expect(
        existsSync(project.capture),
        'missing configured context must block before reviewer execution',
      ).toBe(false);
      expect(output.data?.status).not.toBe('approved');
    },
  );
  it.each([
    ['personas', 'Builder needs trustworthy approvals.'],
    ['surfaces', 'The public CLI approves plans.'],
  ])('sends the current %s source through the installed reviewer packet', (role, marker) => {
    const project = fixture();
    const result = project.review();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const packet = JSON.parse(readFileSync(project.capture, 'utf8'));
    const expectedSource = expect.objectContaining({
      path: `.project/${role}.md`,
      content: expect.stringContaining(marker),
    });
    expect(packet.context_files, `installed review must include current ${role}`).toEqual(
      expect.arrayContaining([expectedSource]),
    );
  });

  it.each(['personas', 'surfaces'])(
    'refuses missing %s before installed reviewer execution',
    role => {
      const project = fixture();
      rmSync(nodePath.join(project.project, '.project', `${role}.md`));
      const result = project.review();
      expect(result.status, `missing ${role} must not enter reviewer execution`).not.toBe(0);
      const output = JSON.parse(result.stdout);
      const expectedMissingContext = expect.objectContaining({
        code: 'missing_planning_context',
        metadata: { context_role: role, context_path: `.project/${role}.md` },
      });
      expect(output.findings).toEqual(expect.arrayContaining([expectedMissingContext]));
      const repair = output.recovery
        .map((action: { description: string }) => action.description)
        .join('\n');
      expect(repair).toContain(`paths.${role}`);
      expect(repair).toContain('rerun the planning review');
      expect(
        existsSync(project.capture),
        `missing ${role} must block before reviewer execution`,
      ).toBe(false);
      expect(output.data?.status).not.toBe('approved');
    },
  );
});
