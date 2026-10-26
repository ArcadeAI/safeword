import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  canonical,
  fixedFiles,
  gradeReport,
  observationProfile,
} from '../src/bounded-observation/contract.js';
import { projectedFile } from '../src/bounded-observation/identity.js';
import { verifyBoundedDelivery } from '../src/bounded-observation/index.js';
import { openStore, reserveAttempt } from '../src/bounded-observation/store.js';

const clone = '/committed-candidate';
interface ReportFile {
  name: string;
  status: string;
  assertionResults: { fullName: string; status: string }[];
}

function report(): {
  success: boolean;
  numFailedTests: number;
  numFailedTestSuites: number;
  testResults: ReportFile[];
  unhandledErrors?: unknown[];
} {
  const tests = new Map<string, Set<string>>();
  for (const row of observationProfile.cases)
    for (const required of row.required_assertions) {
      const names = tests.get(required.file) ?? new Set<string>();
      names.add(required.full_name);
      tests.set(required.file, names);
    }
  return {
    success: true,
    numFailedTests: 0,
    numFailedTestSuites: 0,
    testResults: fixedFiles.map(file => ({
      name: nodePath.join(clone, 'packages/cli', file),
      status: 'passed',
      assertionResults: [...(tests.get(`packages/cli/${file}`) ?? [])].map(fullName => ({
        fullName,
        status: 'passed',
      })),
    })),
  };
}

function bytes(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value));
}
function firstRequired(value: ReturnType<typeof report>): ReportFile {
  const file = value.testResults.find(candidate => candidate.assertionResults.length > 0);
  if (file === undefined) throw new Error('Required fixture is empty');
  return file;
}

describe('fixed bounded-observation result reconciliation', () => {
  it('reconciles 37 cases without counting shared assertions twice', () => {
    const rows = gradeReport(bytes(report()), clone);
    expect(rows.map(row => row.case_id)).toEqual(observationProfile.cases.map(row => row.case_id));
    const identities = rows.flatMap(row =>
      row.assertions.map(assertion => `${assertion.file}\0${assertion.full_name}`),
    );
    expect(new Set(identities).size).toBe(47);
  });
  it.each(['pending', 'skipped', 'todo', 'failed'])('refuses a required %s result', status => {
    const value = report();
    const assertion = firstRequired(value).assertionResults[0];
    if (assertion === undefined) throw new Error('Required fixture assertion is absent');
    assertion.status = status;
    expect(() => gradeReport(bytes(value), clone)).toThrow(/assertion/iu);
  });
  it('refuses a missing required result despite a successful aggregate', () => {
    const value = report();
    firstRequired(value).assertionResults.shift();
    expect(() => gradeReport(bytes(value), clone)).toThrow('exact-once');
  });
  it('requires the different-exact-model denial proof even when matching routes pass', () => {
    const value = report();
    const file = value.testResults.find(candidate =>
      candidate.name.endsWith('/tests/review/execution-plan-conformance.test.ts'),
    );
    if (file === undefined) throw new Error('Conformance fixture is absent');
    const name =
      'Execution Plan semantic conformance admission preserves admitted degraded labeling and deterministically exhausts an empty set';
    file.assertionResults = file.assertionResults.filter(assertion => assertion.fullName !== name);
    expect(() => gradeReport(bytes(value), clone)).toThrow(name);
  });
  it('refuses an ambiguous repeated required result', () => {
    const value = report();
    const file = firstRequired(value);
    const first = file.assertionResults[0];
    if (first === undefined) throw new Error('Required fixture assertion is absent');
    file.assertionResults.push({ ...first });
    expect(() => gradeReport(bytes(value), clone)).toThrow('exact-once');
  });
  it('does not credit a same-named result in another file', () => {
    const value = report();
    const owner = firstRequired(value);
    const required = owner.assertionResults.shift();
    const foreign = value.testResults.find(file => file !== owner);
    if (required === undefined || foreign === undefined)
      throw new Error('Required fixture is empty');
    foreign.assertionResults.push(required);
    expect(() => gradeReport(bytes(value), clone)).toThrow('exact-once');
  });
  it('requires the supporting fixed files as well as the required assertion subset', () => {
    const value = report();
    value.testResults = value.testResults.filter(file => file.assertionResults.length > 0);
    expect(() => gradeReport(bytes(value), clone)).toThrow(/fixed|complete/iu);
  });
  it('refuses a failed suite even when every required assertion passed', () => {
    const value = report();
    const file = value.testResults[0];
    if (file === undefined) throw new Error('Fixed fixture file is absent');
    file.status = 'failed';
    expect(() => gradeReport(bytes(value), clone)).toThrow('unsuccessful');
  });
  it('refuses unhandled runner errors despite passing assertions', () => {
    const value = report();
    value.unhandledErrors = [{ message: 'worker crashed' }];
    expect(() => gradeReport(bytes(value), clone)).toThrow('unsuccessful');
  });
  it.each([{}, { success: true }, { success: true, testResults: 'truncated' }])(
    'refuses incomplete schema %#',
    value => {
      expect(() => gradeReport(bytes(value), clone)).toThrow();
    },
  );
  it('refuses null JSON', () => {
    expect(() => gradeReport(Buffer.from('null'), clone)).toThrow();
  });
  it('refuses truncated JSON', () => {
    expect(() => gradeReport(Buffer.from('{"success":true,'), clone)).toThrow();
  });
  it('retains unrelated pending assertions without crediting them', () => {
    const value = report();
    firstRequired(value).assertionResults.push({
      fullName: 'unrelated optional',
      status: 'pending',
    });
    expect(gradeReport(bytes(value), clone)).toHaveLength(37);
  });
});

describe('bounded semantic source projection', () => {
  const path = '.project/tickets/T3E4NS-keep-bounded-planning-reviews-trustworthy/ticket.md';
  const initial =
    '---\nid: T3E4NS\nphase: scenario-gate\nstatus: in_progress\nscope: [bounded]\nphase_anchors: [fixed]\n---\n# Delivery\n\n## Work Log\n\n- earlier\n';
  it('tolerates named bookkeeping fields and Work Log additions', () => {
    const current = `${initial.replace('scenario-gate', 'verify').replace('in_progress', 'done')}- audit\n`;
    expect(projectedFile(path, Buffer.from(current))).toBe(
      projectedFile(path, Buffer.from(initial)),
    );
  });
  it.each([
    ['scope: [bounded]', 'scope: [expanded]'],
    ['phase_anchors: [fixed]', 'phase_anchors: [other]'],
    ['# Delivery', '# Changed delivery'],
    ['id: T3E4NS', 'id: OTHER'],
  ])('stales meaningful %s changes', (before, after) => {
    const changed = Buffer.from(initial.replace(before, () => after));
    expect(projectedFile(path, changed)).not.toBe(projectedFile(path, Buffer.from(initial)));
  });
  it('binds sections following the Work Log', () => {
    expect(projectedFile(path, Buffer.from(`${initial}\n## Scope revision\nexpanded\n`))).not.toBe(
      projectedFile(path, Buffer.from(initial)),
    );
  });
  it('binds a top-level section following the Work Log', () => {
    const changed = Buffer.from(`${initial}\n# Accepted scope revision\nexpanded\n`);
    expect(projectedFile(path, changed)).not.toBe(projectedFile(path, Buffer.from(initial)));
  });
  it('does not turn a fenced Work Log example into an audit exemption', () => {
    const before = initial.replace(
      '## Work Log',
      '```markdown\n## Work Log\nexample\n```\n\n## Work Log',
    );
    const changed = before.replace('example', 'changed example');
    expect(projectedFile(path, Buffer.from(changed))).not.toBe(
      projectedFile(path, Buffer.from(before)),
    );
  });
  it.each([
    initial.replace('scope: [bounded]', 'scope: [bounded]\nscope: [other]'),
    initial.replace('scope: [bounded]', 'scope: [broken'),
  ])('refuses malformed or duplicate frontmatter %#', value => {
    expect(() => projectedFile(path, Buffer.from(value))).toThrow('invalid YAML metadata');
  });
  it('does not exempt an arbitrary loaded source file', () => {
    expect(
      projectedFile('packages/cli/src/input.ts', Buffer.from(`${initial}- changed\n`)),
    ).not.toBe(projectedFile('packages/cli/src/input.ts', Buffer.from(initial)));
  });
  it('canonicalizes object keys while preserving array order', () => {
    expect(canonical({ z: 1, a: [2, 1] })).toBe(canonical({ a: [2, 1], z: 1 }));
    expect(canonical([2, 1])).not.toBe(canonical([1, 2]));
  });
  it('orders canonical object keys by code unit rather than locale', () => {
    expect(canonical({ _: 2, A: 1, a: 3 })).toBe('{"A":1,"_":2,"a":3}');
  });
});

describe('private observer store boundary', () => {
  const temporary: string[] = [];
  afterEach(() => {
    vi.unstubAllEnvs();
    for (const directory of temporary.splice(0))
      rmSync(directory, { recursive: true, force: true });
  });
  function roots(): { directory: string; root: string; state: string } {
    const prefix = nodePath.join(tmpdir(), 'observer-store-test-');
    const directory = realpathSync(mkdtempSync(prefix));
    temporary.push(directory);
    const root = nodePath.join(directory, 'checkout');
    const state = nodePath.join(directory, 'state');
    mkdirSync(root, { mode: 0o700 });
    mkdirSync(state, { mode: 0o700 });
    vi.stubEnv('XDG_STATE_HOME', state);
    return { directory, root, state };
  }
  it('never creates a key or directory during verification', () => {
    const { root, state } = roots();
    expect(() => openStore(root, false)).toThrow();
    expect(readdirSync(state)).toEqual([]);
  });
  it('names an attempt without START as incomplete without rewriting it', () => {
    const { root } = roots();
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    const { id, directory } = reserveAttempt(openStore(root, true));
    expect(() => verifyBoundedDelivery(root, id)).toThrow('incomplete');
    expect(readdirSync(directory)).toEqual([]);
  });
  it('keeps newly allocated observer state private', () => {
    const { root } = roots();
    const store = openStore(root, true);
    expect(lstatSync(store.base).mode & 0o777).toBe(0o700);
    expect(lstatSync(store.namespace).mode & 0o777).toBe(0o700);
    expect(lstatSync(nodePath.join(store.base, 'observer.key')).mode & 0o777).toBe(0o600);
    expect(store.key).toHaveLength(32);
    expect(openStore(root, false).key).toEqual(store.key);
  });
  it('rejects an outside state alias whose resolved target lies inside the checkout', () => {
    const { directory, root } = roots();
    const inside = nodePath.join(root, 'inside-state');
    mkdirSync(inside, { mode: 0o700 });
    const alias = nodePath.join(directory, 'state-alias');
    symlinkSync(inside, alias, 'dir');
    vi.stubEnv('XDG_STATE_HOME', alias);
    expect(() => openStore(root, true)).toThrow('outside');
    expect(existsSync(nodePath.join(inside, 'safeword'))).toBe(false);
  });
});
