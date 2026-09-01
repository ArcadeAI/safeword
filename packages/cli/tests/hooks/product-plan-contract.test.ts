import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
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
      '## Product Bet\n- **Project non-goals:** none\n### J1\n### M1\n- **Outcome:** live\n- **Non-goals:** none\n',
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
      '## Product Bet\n- **Project non-goals:** no tracker sync,\n  no bulk import\n- **Success threshold:** live\n### J1\n### M1\n- **Outcome:** first customer\n  completes the flow\n- **Non-goals:** none\n',
    );

    const cli = resolveParentContract(project, 'EPIC01', 'J1', 'M1');
    const hook = resolveHookParentContract(project, 'EPIC01', 'J1', 'M1');
    expect(hook).toEqual(cli);
    expect(cli.values.projectNonGoals).toBe('no tracker sync, no bulk import');
    expect(cli.values.milestoneOutcome).toBe('first customer completes the flow');
  });

  it('does not activate the new contract for an unmarked legacy milestone', () => {
    expect(
      evaluateParentContract('/unused', '---\ntype: feature\nmilestone: release-1\n---\n'),
    ).toEqual({ ok: true });
  });
});
