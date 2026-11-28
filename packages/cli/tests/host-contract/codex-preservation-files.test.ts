import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import {
  type InvocationScenarioResult,
  verifyPreservationFiles,
} from '../../scripts/check-codex-internal-workflows.js';
import { codexInternalCases } from '../fixtures/host-contract/native-contract-cases.js';
import { preservationControl } from '../fixtures/host-contract/preservation-control.js';

const roots: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function pair() {
  const temporary = mkdtempSync(path.join(tmpdir(), 'safeword-preservation-files-'));
  const root = realpathSync(temporary);
  roots.push(root);
  const row = codexInternalCases().find(item => item.preservationArms.length === 2);
  if (!row) throw new Error('paired feature case missing');
  const receipts = row.preservationArms.map(arm => {
    const artifacts = path.join(root, `internal-workflows-${arm}`);
    mkdirSync(path.join(artifacts, 'profile'), { recursive: true });
    const receipt = {
      ...preservationControl(row.scenario, arm),
      artifacts,
      file: path.join(artifacts, 'preservation.json'),
    };
    writeFileSync(receipt.file, JSON.stringify(receipt.observation));
    writeFileSync(
      path.join(artifacts, 'identity.json'),
      JSON.stringify({ profile: path.join(artifacts, 'profile') }),
    );
    writeFileSync(path.join(artifacts, 'wiring-fixture.json'), JSON.stringify({ arm }));
    return receipt;
  });
  const fixture = path.join(root, 'fixture.json');
  writeFileSync(fixture, JSON.stringify({ root }));
  vi.stubEnv('SAFEWORD_CODEX_GUARD_FIXTURE', fixture);
  const scenario = (): InvocationScenarioResult => ({
    name: row.scenario,
    line: row.line,
    steps: [
      {
        hidden: true,
        keyword: 'After',
        result: { status: 'passed' },
        embeddings: receipts.map(receipt => ({
          mime_type: 'application/json',
          data: Buffer.from(JSON.stringify(receipt)).toString('base64'),
        })),
      },
    ],
  });
  return { root, receipts, scenario };
}
it('validates both actual owned files and their separate profile identities', () => {
  expect(() => {
    verifyPreservationFiles([pair().scenario()]);
  }).not.toThrow();
});
it.each(['missing', 'false', 'wrong-profile', 'foreign-arm', 'symlink', 'foreign-directory'])(
  'rejects %s second-arm file despite true embedded observations',
  fault => {
    const p = pair();
    const second = p.receipts[1];
    if (!second) throw new Error('second receipt missing');
    switch (fault) {
      case 'missing': {
        unlinkSync(second.file);
        break;
      }
      case 'false': {
        writeFileSync(
          second.file,
          JSON.stringify({ ...second.observation, originalRuntimeUnchanged: false }),
        );
        break;
      }
      case 'wrong-profile': {
        writeFileSync(
          path.join(second.artifacts, 'identity.json'),
          JSON.stringify({ profile: path.join(p.root, 'foreign-profile') }),
        );
        break;
      }
      case 'foreign-arm': {
        writeFileSync(path.join(second.artifacts, 'wiring-fixture.json'), '{"arm":"defective"}');
        break;
      }
      case 'symlink': {
        const foreign = path.join(p.root, 'foreign.json');
        writeFileSync(foreign, readFileSync(second.file));
        unlinkSync(second.file);
        symlinkSync(foreign, second.file);

        break;
      }
      case 'foreign-directory': {
        const foreign = path.join(p.root, 'foreign', 'internal-workflows-covered');
        mkdirSync(path.dirname(foreign), { recursive: true });
        cpSync(second.artifacts, foreign, { recursive: true });
        Object.assign(second, {
          artifacts: foreign,
          file: path.join(foreign, 'preservation.json'),
        });
        writeFileSync(
          path.join(foreign, 'identity.json'),
          JSON.stringify({ profile: path.join(foreign, 'profile') }),
        );
        break;
      }
      // No default
    }
    expect(() => {
      verifyPreservationFiles([p.scenario()]);
    }).toThrow();
  },
);
