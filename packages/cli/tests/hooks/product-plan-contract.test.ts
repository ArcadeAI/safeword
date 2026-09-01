import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  canonicalizeContractValue,
  digestParentContract,
  type ParentContractValues,
  resolveParentContract,
} from '../../src/utils/product-plan-contract.js';
import {
  canonicalizeParentContractValue,
  evaluateParentContract,
  parentContractDigest,
  resolveHookParentContract,
} from '../../templates/hooks/lib/product-plan-contract.ts';

const values: ParentContractValues = {
  parentJob: 'J1',
  milestoneOutcome: '  **First** customer  is live ',
  milestoneNonGoals: '_Automated_ migration',
  projectNonGoals: '`Tracker` synchronization',
  successThreshold: 'Three\ncustomers',
};

describe('Product Plan parent contract parity', () => {
  it('canonicalizes formatting and whitespace identically in the CLI and installed hook', () => {
    for (const value of Object.values(values)) {
      expect(canonicalizeParentContractValue(value)).toBe(canonicalizeContractValue(value));
    }
  });

  it('produces a byte-identical digest in the CLI and installed hook', () => {
    expect(parentContractDigest(values)).toBe(digestParentContract(values));
  });

  const expectDigestChange = (field: keyof ParentContractValues): void => {
    expect(digestParentContract({ ...values, [field]: `${values[field]} changed` })).not.toBe(
      digestParentContract(values),
    );
  };

  it('changes the digest when the parent job changes', () => {
    expectDigestChange('parentJob');
  });

  it('changes the resolved digest when the parent rewrites a referenced job', () => {
    const project = mkdtempSync(nodePath.join(tmpdir(), 'safeword-parent-contract-'));
    const parent = nodePath.join(project, '.project', 'tickets', 'EPIC01-parent');
    mkdirSync(parent, { recursive: true });
    writeFileSync(nodePath.join(parent, 'ticket.md'), '---\ntype: epic\n---\n');
    const specPath = nodePath.join(parent, 'spec.md');
    const spec =
      '## Product Bet\n- **Project non-goals:** none\n- **Success threshold:** live\n## Jobs To Be Done\n### J1 — Ship safely\n## Shape\n### M1\n- **Outcome:** live\n- **Non-goals:** none\n';
    writeFileSync(specPath, spec);
    const before = resolveParentContract(project, 'EPIC01', 'J1', 'M1').digest;
    writeFileSync(specPath, spec.replace('Ship safely', 'Ship anything'));
    expect(resolveParentContract(project, 'EPIC01', 'J1', 'M1').digest).not.toBe(before);
    expect(resolveHookParentContract(project, 'EPIC01', 'J1', 'M1').digest).not.toBe(before);
  });

  it('changes the digest when the milestone outcome changes', () => {
    expectDigestChange('milestoneOutcome');
  });

  it('changes the digest when the milestone non-goals change', () => {
    expectDigestChange('milestoneNonGoals');
  });

  it('changes the digest when the project non-goals change', () => {
    expectDigestChange('projectNonGoals');
  });

  it('changes the digest when the success threshold changes', () => {
    expectDigestChange('successThreshold');
  });

  it.each([
    ['LF with heading suffixes', '\n', '.project'],
    ['CRLF in a configured namespace root', '\r\n', 'planning'],
  ])('resolves identical values and digests from disk: %s', (_name, newline, namespace) => {
    const project = mkdtempSync(nodePath.join(tmpdir(), 'safeword-parent-contract-'));
    if (namespace !== '.project') {
      mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
      writeFileSync(
        nodePath.join(project, '.safeword', 'config.json'),
        JSON.stringify({ paths: { projectRoot: namespace } }),
      );
    }
    const parent = nodePath.join(project, namespace, 'tickets', 'EPIC01-parent');
    mkdirSync(parent, { recursive: true });
    writeFileSync(
      nodePath.join(parent, 'ticket.md'),
      ['---', 'type: epic', '---', ''].join(newline),
    );
    writeFileSync(
      nodePath.join(parent, 'spec.md'),
      [
        '## Product Bet — decision',
        '- **Project non-goals:** `Tracker` synchronization',
        '- **Success threshold:** Three customers',
        '## Jobs To Be Done',
        '### J1 — Ship safely',
        '## Shape',
        '### M1 — First milestone',
        '- **Outcome:** **First** customer is live',
        '- **Non-goals:** _Automated_ migration',
        '',
      ].join(newline),
    );

    expect(resolveHookParentContract(project, 'EPIC01', 'J1', 'M1')).toEqual(
      resolveParentContract(project, 'EPIC01', 'J1', 'M1'),
    );
  });

  it('rejects the same missing field in both implementations', () => {
    const project = mkdtempSync(nodePath.join(tmpdir(), 'safeword-parent-contract-'));
    const parent = nodePath.join(project, '.project', 'tickets', 'EPIC01-parent');
    mkdirSync(parent, { recursive: true });
    writeFileSync(nodePath.join(parent, 'ticket.md'), '---\ntype: epic\n---\n');
    writeFileSync(
      nodePath.join(parent, 'spec.md'),
      '## Product Bet\n- **Project non-goals:** none\n## Jobs To Be Done\n### J1\n## Shape\n### M1\n- **Outcome:** live\n- **Non-goals:** none\n',
    );

    expect(() => resolveParentContract(project, 'EPIC01', 'J1', 'M1')).toThrow(/successThreshold/);
    expect(() => resolveHookParentContract(project, 'EPIC01', 'J1', 'M1')).toThrow(
      /successThreshold/,
    );
  });

  it('includes wrapped contract bullet continuations in both implementations', () => {
    const project = mkdtempSync(nodePath.join(tmpdir(), 'safeword-parent-contract-'));
    const parent = nodePath.join(project, '.project', 'tickets', 'EPIC01-parent');
    mkdirSync(parent, { recursive: true });
    writeFileSync(nodePath.join(parent, 'ticket.md'), '---\ntype: epic\n---\n');
    writeFileSync(
      nodePath.join(parent, 'spec.md'),
      '## Product Bet\n- **Project non-goals:** excluded:\n  - tracker sync\n  - bulk import\n- **Success threshold:** live\n## Jobs To Be Done\n### J1\n## Shape\n### M1\n- **Outcome:** first customer\n  completes the flow\n- **Non-goals:** none\n',
    );

    const cli = resolveParentContract(project, 'EPIC01', 'J1', 'M1');
    const hook = resolveHookParentContract(project, 'EPIC01', 'J1', 'M1');
    expect(hook).toEqual(cli);
    expect(cli.values.projectNonGoals).toBe('excluded: - tracker sync - bulk import');
    expect(cli.values.milestoneOutcome).toBe('first customer completes the flow');

    const specPath = nodePath.join(parent, 'spec.md');
    const before = cli.digest;
    writeFileSync(
      specPath,
      readFileSync(specPath, 'utf8').replace('bulk import', 'account import'),
    );
    expect(resolveParentContract(project, 'EPIC01', 'J1', 'M1').digest).not.toBe(before);
  });

  it('prefers an exact ticket folder and rejects ids from the wrong Product Plan section', () => {
    const project = mkdtempSync(nodePath.join(tmpdir(), 'safeword-parent-contract-'));
    const tickets = nodePath.join(project, '.project', 'tickets');
    const slugged = nodePath.join(tickets, 'EPIC01-parent');
    const exact = nodePath.join(tickets, 'EPIC01');
    mkdirSync(slugged, { recursive: true });
    mkdirSync(exact, { recursive: true });
    for (const directory of [slugged, exact]) {
      writeFileSync(nodePath.join(directory, 'ticket.md'), '---\ntype: epic\n---\n');
    }
    writeFileSync(nodePath.join(slugged, 'spec.md'), '## Product Bet\n');
    writeFileSync(
      nodePath.join(exact, 'spec.md'),
      '## Product Bet\n- **Project non-goals:** none\n- **Success threshold:** live\n## Jobs To Be Done\n### J1 — job\n## Shape\n### M1\n- **Outcome:** live\n- **Non-goals:** none\n',
    );

    expect(resolveHookParentContract(project, 'EPIC01', 'J1', 'M1')).toEqual(
      resolveParentContract(project, 'EPIC01', 'J1', 'M1'),
    );
    expect(() => resolveParentContract(project, 'EPIC01', 'M1', 'M1')).toThrow(/Parent job/);
    expect(() => resolveHookParentContract(project, 'EPIC01', 'M1', 'M1')).toThrow(/parent job/);
  });

  it('does not activate the new contract for an unmarked legacy milestone', () => {
    expect(
      evaluateParentContract('/unused', '---\ntype: feature\nmilestone: release-1\n---\n'),
    ).toEqual({ ok: true });
  });
});
