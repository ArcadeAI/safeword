import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { DELIVERY_CHECKLIST_CATEGORIES } from '../../src/execution-plan/delivery-checklist.js';
import { prepareReviewPacket } from '../../src/review/packet.js';

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-packet-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

function executionPlanWithDeliveryContract(): string {
  const proofs = DELIVERY_CHECKLIST_CATEGORIES.map(
    (_, index) =>
      `| proof-${index + 1} | command | integration | boundary ${index + 1} | real_boundary | current_required | {"type":"command","cwd":".","argv":["node","--version"]} |`,
  );
  const items = DELIVERY_CHECKLIST_CATEGORIES.map(
    (category, index) =>
      `| item-${index + 1} | ${category} | Complete ${category} | contributor | proof-${index + 1} | open | missing | | |`,
  );
  return [
    '# Execution Plan',
    '',
    '## Proof specifications',
    '',
    '| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...proofs,
    '',
    '## Delivery checklist',
    '',
    '<!-- safeword:delivery-checklist:v1 -->',
    '',
    '| ID | Category | Obligation | Owner | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...items,
    '',
  ].join('\n');
}

afterEach(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { force: true, recursive: true });
  }
  temporaryDirectories.length = 0;
});

describe('review packet containment and change accounting', () => {
  it('refuses executable RED review without Safeword execution evidence', () => {
    const root = temporaryDirectory();
    writeFileSync(nodePath.join(root, 'proof.md'), 'missing behavior\n');

    expect(() => prepareReviewPacket(root, 'executable-red', ['proof.md'])).toThrow(
      'Executable-red review requires a trusted execution attestation',
    );
  });

  it('treats only impl-plan.md as plan-review work and preserves supporting context', () => {
    const root = temporaryDirectory();
    writeFileSync(nodePath.join(root, 'impl-plan.md'), '# Plan\n');
    writeFileSync(nodePath.join(root, 'spec.md'), '# Spec\n');
    const prepared = prepareReviewPacket(
      root,
      'plan-implementation',
      ['impl-plan.md'],
      ['spec.md'],
    );
    try {
      expect(prepared.packet.logical_files.map(file => file.path)).toEqual(['impl-plan.md']);
      expect(prepared.packet.context_files?.map(file => file.path)).toEqual(['spec.md']);
      expect(prepared.packet.plan_contract?.author).toEqual(
        prepared.packet.plan_contract?.reviewer,
      );
      expect(prepared.packet.plan_contract?.author.sha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(prepared.packet.plan_contract?.author.obligations).toContain('Decision quality');
    } finally {
      prepared.cleanup();
    }
  });

  it('rejects supporting evidence supplied as plan-review work', () => {
    const root = temporaryDirectory();
    writeFileSync(nodePath.join(root, 'impl-plan.md'), '# Plan\n');
    writeFileSync(nodePath.join(root, 'spec.md'), '# Spec\n');
    expect(() =>
      prepareReviewPacket(root, 'plan-implementation', ['impl-plan.md', 'spec.md']),
    ).toThrow('one non-blank impl-plan.md work file');
  });

  it('seals one Execution Plan with its canonical contract and required design context', () => {
    const root = temporaryDirectory();
    mkdirSync(nodePath.join(root, '.safeword'));
    writeFileSync(nodePath.join(root, '.safeword', 'config.json'), '{"designApprovalGate":true}\n');
    writeFileSync(nodePath.join(root, 'execution-plan.md'), executionPlanWithDeliveryContract());
    writeFileSync(nodePath.join(root, 'impl-plan.md'), '# Implementation Plan\n');
    writeFileSync(nodePath.join(root, 'behavior.feature'), 'Feature: planned behavior\n');

    const prepared = prepareReviewPacket(
      root,
      'plan-execution',
      ['execution-plan.md'],
      ['impl-plan.md', 'behavior.feature'],
    );
    try {
      expect(prepared.packet.logical_files.map(file => file.path)).toEqual(['execution-plan.md']);
      expect(prepared.packet.context_files?.map(file => file.path)).toEqual([
        'impl-plan.md',
        'behavior.feature',
      ]);
      expect(prepared.packet.plan_contract?.author).toEqual(
        prepared.packet.plan_contract?.reviewer,
      );
      expect(prepared.packet.plan_contract?.author.obligations).toContain('Slicing decision');
      expect(prepared.packet.execution_plan_delivery_definition).toMatchObject({
        schema_version: 1,
        design_approval_gate: true,
        proof_specifications: expect.arrayContaining([
          expect.objectContaining({ proof_id: 'proof-1' }),
        ]),
        checklist_items: expect.arrayContaining([
          expect.objectContaining({ id: 'item-1', required_proof: 'proof-1' }),
        ]),
      });
      expect(prepared.packet.execution_plan_normalized_digest).toMatch(/^[a-f0-9]{64}$/u);
      writeFileSync(
        nodePath.join(root, '.safeword', 'config.json'),
        '{"designApprovalGate":false}\n',
      );
      expect(prepared.sourceChanged()).toBe(true);
    } finally {
      prepared.cleanup();
    }
  });

  it.each([
    { targets: ['execution-plan.md', 'impl-plan.md'], context: ['behavior.feature'] },
    { targets: ['execution-plan.md'], context: ['behavior.feature'] },
    { targets: ['execution-plan.md'], context: ['impl-plan.md'] },
  ])('rejects an incomplete Execution Plan packet', ({ targets, context }) => {
    const root = temporaryDirectory();
    writeFileSync(nodePath.join(root, 'execution-plan.md'), '# Execution Plan\n');
    writeFileSync(nodePath.join(root, 'impl-plan.md'), '# Implementation Plan\n');
    writeFileSync(nodePath.join(root, 'behavior.feature'), 'Feature: planned behavior\n');

    expect(() => prepareReviewPacket(root, 'plan-execution', targets, context)).toThrow(
      /one non-blank execution-plan\.md|non-blank impl-plan\.md and approved \.feature/u,
    );
  });
  it('rejects a target that escapes through a symlinked parent directory', () => {
    const project = temporaryDirectory();
    const outside = temporaryDirectory();
    writeFileSync(nodePath.join(outside, 'secret.md'), 'outside\n');
    symlinkSync(outside, nodePath.join(project, 'linked'));

    expect(() => prepareReviewPacket(project, 'quality-review', ['linked/secret.md'])).toThrow(
      'escapes the project',
    );
  });

  it('accepts an in-project filename that merely begins with two dots', () => {
    const project = temporaryDirectory();
    writeFileSync(nodePath.join(project, '..config'), 'inside\n');
    const prepared = prepareReviewPacket(project, 'quality-review', ['..config']);

    expect(prepared.packet.logical_files[0]?.path).toBe('..config');
    prepared.cleanup();
  });

  it('distinguishes source drift from reviewer snapshot mutation', () => {
    const project = temporaryDirectory();
    const source = nodePath.join(project, 'input.md');
    writeFileSync(source, 'original\n');
    const prepared = prepareReviewPacket(project, 'quality-review', ['input.md']);

    writeFileSync(source, 'external edit\n');
    expect(prepared.sourceChanged()).toBe(true);
    expect(prepared.snapshotChanged()).toBe(false);
    prepared.cleanup();
  });

  it('treats source deletion as drift from the captured packet', () => {
    const project = temporaryDirectory();
    const source = nodePath.join(project, 'input.md');
    writeFileSync(source, 'original\n');
    const prepared = prepareReviewPacket(project, 'quality-review', ['input.md']);

    unlinkSync(source);

    expect(prepared.sourceChanged()).toBe(true);
    expect(prepared.snapshotChanged()).toBe(false);
    prepared.cleanup();
  });

  it('detects a same-content source replacement with a different file identity', () => {
    const project = temporaryDirectory();
    const source = nodePath.join(project, 'input.md');
    const replacement = nodePath.join(project, 'replacement.md');
    writeFileSync(source, 'same bytes\n');
    const prepared = prepareReviewPacket(project, 'quality-review', ['input.md']);

    writeFileSync(replacement, 'same bytes\n');
    renameSync(replacement, source);

    expect(prepared.sourceChanged()).toBe(true);
    prepared.cleanup();
  });

  it('detects a captured source replaced by a same-content symlink', () => {
    const project = temporaryDirectory();
    const outside = temporaryDirectory();
    const source = nodePath.join(project, 'input.md');
    const replacement = nodePath.join(outside, 'replacement.md');
    writeFileSync(source, 'same bytes\n');
    writeFileSync(replacement, 'same bytes\n');
    const prepared = prepareReviewPacket(project, 'quality-review', ['input.md']);

    unlinkSync(source);
    symlinkSync(replacement, source);

    expect(prepared.sourceChanged()).toBe(true);
    prepared.cleanup();
  });

  it('detects files newly created inside the disposable snapshot', () => {
    const project = temporaryDirectory();
    writeFileSync(nodePath.join(project, 'input.md'), 'original\n');
    const prepared = prepareReviewPacket(project, 'quality-review', ['input.md']);
    mkdirSync(nodePath.join(prepared.workspace, 'new'), { recursive: true });
    writeFileSync(nodePath.join(prepared.workspace, 'new', 'file.md'), 'created\n');

    expect(prepared.snapshotChanged()).toBe(true);
    expect(prepared.sourceChanged()).toBe(false);
    prepared.cleanup();
  });

  it('treats an unreadable snapshot traversal as reviewer mutation', () => {
    const project = temporaryDirectory();
    writeFileSync(nodePath.join(project, 'input.md'), 'original\n');
    const prepared = prepareReviewPacket(project, 'quality-review', ['input.md']);
    rmSync(prepared.workspace, { recursive: true, force: true });

    expect(prepared.snapshotChanged()).toBe(true);
  });

  it('rejects an individual target that is too large for a bounded review', () => {
    const project = temporaryDirectory();
    writeFileSync(nodePath.join(project, 'large.md'), 'x'.repeat(256 * 1024 + 1));

    expect(() => prepareReviewPacket(project, 'quality-review', ['large.md'])).toThrow(
      '262144-byte limit',
    );
  });

  it('rejects more files than a bounded review can safely carry', () => {
    const project = temporaryDirectory();
    const targets = Array.from({ length: 65 }, (_, index) => `input-${index}.md`);

    expect(() => prepareReviewPacket(project, 'quality-review', targets)).toThrow('64-file limit');
  });

  it('applies the file-count bound across targets and supporting context', () => {
    const project = temporaryDirectory();
    const targets = Array.from({ length: 32 }, (_, index) => `target-${index}.md`);
    const context = Array.from({ length: 33 }, (_, index) => `context-${index}.md`);

    expect(() => prepareReviewPacket(project, 'quality-review', targets, context)).toThrow(
      '64-file limit',
    );
  });

  it('rejects the same file appearing more than once or in both packet roles', () => {
    const project = temporaryDirectory();
    writeFileSync(nodePath.join(project, 'input.md'), 'review me\n');

    expect(() =>
      prepareReviewPacket(project, 'quality-review', ['input.md'], ['./input.md']),
    ).toThrow('duplicate file');
  });

  it('rejects a packet whose individually valid files exceed the aggregate limit', () => {
    const project = temporaryDirectory();
    const targets = Array.from({ length: 5 }, (_, index) => `input-${index}.md`);
    for (const target of targets) {
      writeFileSync(nodePath.join(project, target), 'x'.repeat(220 * 1024));
    }

    expect(() => prepareReviewPacket(project, 'quality-review', targets)).toThrow(
      '1048576-byte limit',
    );
  });

  it('rejects malformed UTF-8 instead of reviewing replacement characters', () => {
    const project = temporaryDirectory();
    writeFileSync(nodePath.join(project, 'invalid.md'), Buffer.from([0xc3, 0x28]));

    expect(() => prepareReviewPacket(project, 'quality-review', ['invalid.md'])).toThrow(
      'not valid UTF-8 text',
    );
  });

  it('preserves a UTF-8 BOM without reporting a reviewer mutation', () => {
    const project = temporaryDirectory();
    writeFileSync(
      nodePath.join(project, 'bom.md'),
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('review me\n')]),
    );
    const prepared = prepareReviewPacket(project, 'quality-review', ['bom.md']);

    expect(prepared.snapshotChanged()).toBe(false);
    expect(prepared.sourceChanged()).toBe(false);
    prepared.cleanup();
  });

  it('separates supporting context from the work product under review', () => {
    const project = temporaryDirectory();
    writeFileSync(nodePath.join(project, 'target.md'), 'review this\n');
    writeFileSync(nodePath.join(project, 'context.md'), 'supporting evidence\n');

    const prepared = prepareReviewPacket(project, 'quality-review', ['target.md'], ['context.md']);

    expect(prepared.packet.logical_files).toEqual([
      { path: 'target.md', content: 'review this\n' },
    ]);
    expect(prepared.packet.context_files).toEqual([
      { path: 'context.md', content: 'supporting evidence\n' },
    ]);
    prepared.cleanup();
  });

  it('requires a non-blank spec.md as the first scenario-gate context file', () => {
    const project = temporaryDirectory();
    writeFileSync(nodePath.join(project, 'behavior.feature'), 'Feature: grounded review\n');
    writeFileSync(nodePath.join(project, 'spec.md'), ' \n');

    expect(() => prepareReviewPacket(project, 'scenario-gate', ['behavior.feature'])).toThrow(
      'requires a non-blank spec.md as its first context file',
    );
    expect(() =>
      prepareReviewPacket(project, 'scenario-gate', ['behavior.feature'], ['spec.md']),
    ).toThrow('requires a non-blank spec.md as its first context file');
    writeFileSync(nodePath.join(project, 'principles.md'), '# Principles\n');
    writeFileSync(nodePath.join(project, 'spec.md'), '# Intended behavior\n');
    expect(() =>
      prepareReviewPacket(
        project,
        'scenario-gate',
        ['behavior.feature'],
        ['principles.md', 'spec.md'],
      ),
    ).toThrow('requires a non-blank spec.md as its first context file');
  });

  it('accepts a scenario-gate packet grounded by a non-blank ticket spec', () => {
    const project = temporaryDirectory();
    writeFileSync(nodePath.join(project, 'behavior.feature'), 'Feature: grounded review\n');
    writeFileSync(nodePath.join(project, 'spec.md'), '# Intended behavior\n');

    const prepared = prepareReviewPacket(
      project,
      'scenario-gate',
      ['behavior.feature'],
      ['spec.md'],
    );
    expect(prepared.packet.context_files?.[0]?.path).toBe('spec.md');
    prepared.cleanup();
  });

  it('applies the aggregate packet bound across targets and supporting context', () => {
    const project = temporaryDirectory();
    const targets = Array.from({ length: 3 }, (_, index) => `target-${index}.md`);
    const context = Array.from({ length: 2 }, (_, index) => `context-${index}.md`);
    for (const path of [...targets, ...context]) {
      writeFileSync(nodePath.join(project, path), 'x'.repeat(220 * 1024));
    }

    expect(() => prepareReviewPacket(project, 'quality-review', targets, context)).toThrow(
      '1048576-byte limit',
    );
  });

  it('bounds the serialized packet after JSON escaping expands source content', () => {
    const project = temporaryDirectory();
    const targets = Array.from({ length: 4 }, (_, index) => `escaped-${index}.md`);
    for (const target of targets) {
      writeFileSync(nodePath.join(project, target), '\\'.repeat(250 * 1024));
    }

    expect(() => prepareReviewPacket(project, 'quality-review', targets)).toThrow(
      '1048576-byte limit',
    );
  });
});
