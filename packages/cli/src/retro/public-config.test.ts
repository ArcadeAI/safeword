import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readEnabledPublicRetroProject } from './public-config.js';

const projects: string[] = [];

function projectWith(config: unknown): string {
  const project = mkdtempSync(path.join(tmpdir(), 'public-retro-config-'));
  projects.push(project);
  mkdirSync(path.join(project, '.safeword'));
  writeFileSync(path.join(project, '.safeword', 'config.json'), JSON.stringify(config));
  return project;
}

afterEach(() => {
  for (const project of projects) rmSync(project, { force: true, recursive: true });
  projects.length = 0;
});

describe('enabled public retro project', () => {
  it('returns the stable project identity when collection is not disabled', () => {
    const project = projectWith({ projectUUID: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA' });

    expect(readEnabledPublicRetroProject(project)).toEqual({
      projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    });
  });

  it.each([
    {},
    { projectUUID: 'not-a-uuid' },
    { projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', publicRetrospectiveCollection: 'yes' },
  ])('fails closed without throwing for disabled or invalid runtime config', config => {
    expect(readEnabledPublicRetroProject(projectWith(config))).toBeUndefined();
  });

  it('honors an explicit public retrospective opt-out', () => {
    const project = projectWith({
      projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      publicRetrospectiveCollection: false,
    });

    expect(readEnabledPublicRetroProject(project)).toBeUndefined();
  });
});
