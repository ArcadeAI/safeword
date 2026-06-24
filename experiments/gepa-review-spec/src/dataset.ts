/**
 * DATASET seam — load the seeded-defect corpus.
 *
 * Each fixture is a pair: `<name>.feature` (the input under review) and
 * `<name>.expected.json` (the reference labels). A LangSmith/Phoenix adapter
 * uploads exactly this {input, reference} shape as a platform Dataset.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ExpectedDefect, Fixture } from './types';

export const FIXTURES_DIR = join(import.meta.dirname, '..', 'fixtures');

interface ExpectedFile {
  split?: 'train' | 'test';
  /** See `Fixture.certifiedClean`. Defaults to false. */
  certifiedClean?: boolean;
  defects: ExpectedDefect[];
}

/** Load all fixtures from a directory (defaults to the bundled corpus). */
export function loadFixtures(dir: string = FIXTURES_DIR): Fixture[] {
  return readdirSync(dir)
    .filter(f => f.endsWith('.feature'))
    .sort()
    .map(file => {
      const name = file.replace(/\.feature$/, '');
      const featureSource = readFileSync(join(dir, file), 'utf8');
      const parsed = JSON.parse(
        readFileSync(join(dir, `${name}.expected.json`), 'utf8'),
      ) as ExpectedFile;
      return {
        name,
        featureSource,
        expected: parsed.defects,
        split: parsed.split ?? 'train',
        certifiedClean: parsed.certifiedClean ?? false,
      };
    });
}

export const trainSplit = (fixtures: Fixture[]): Fixture[] =>
  fixtures.filter(f => f.split === 'train');

/** The held-out split GEPA must never see during optimization. */
export const testSplit = (fixtures: Fixture[]): Fixture[] =>
  fixtures.filter(f => f.split === 'test');
