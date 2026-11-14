import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { prepareReviewPacket } from '../../src/review/packet.js';
import { PLANNING_DATA_GUIDE_PATH, SAFEWORD_SCHEMA } from '../../src/schema.js';
import * as fsUtilities from '../../src/utils/fs.js';
import { createTemporaryDirectory } from '../helpers.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import { PLANNING_ROLE_PRODUCT, writeImplementationRoleInputs } from '../planning-role-fixtures.js';

const directories: string[] = [];
const target = '.project/tickets/DATA42-native-guide/impl-plan.md';

function directory(): string {
  const root = createTemporaryDirectory();
  directories.push(root);
  return root;
}

function project(): string {
  const root = directory();
  const ticket = nodePath.dirname(target);
  mkdirSync(nodePath.join(root, ticket), { recursive: true });
  writeFileSync(
    nodePath.join(root, ticket, 'ticket.md'),
    '---\nid: DATA42\ntype: feature\nproduct_plan_contract: v1\n---\n# Ticket\n',
  );
  writeFileSync(nodePath.join(root, ticket, 'spec.md'), PLANNING_ROLE_PRODUCT);
  writeFileSync(
    nodePath.join(root, target),
    '# Implementation Plan\n\nUse the accepted event store.\n',
  );
  writePlanningInventories(root);
  writeImplementationRoleInputs(root, target, 'native-guide.feature');
  const plan = nodePath.join(root, target);
  writeFileSync(
    plan,
    readFileSync(plan, 'utf8').replace(
      'skip: No product data is stored.',
      'Use the accepted event store and its data guide.',
    ),
  );
  return root;
}

function packagedGuide(): string {
  const root = directory();
  const template = SAFEWORD_SCHEMA.ownedFiles[PLANNING_DATA_GUIDE_PATH]?.template;
  if (template === undefined) throw new Error('Data guide is not registered');
  const path = nodePath.join(root, template);
  mkdirSync(nodePath.dirname(path), { recursive: true });
  writeFileSync(path, '# Data guide\n\nPreserve accepted data ownership.\n');
  vi.spyOn(fsUtilities, 'getTemplatesDirectory').mockReturnValue(root);
  return path;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of directories.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('native planning captures the registered data guide', () => {
  it('uses the real packaged guide without creating project framework files', () => {
    const root = project();
    const packet = prepareReviewPacket(root, 'plan-implementation', [target]);
    try {
      const guide = packet.packet.context_files?.find(
        file => file.path === PLANNING_DATA_GUIDE_PATH,
      );
      const template = SAFEWORD_SCHEMA.ownedFiles[PLANNING_DATA_GUIDE_PATH]?.template;
      if (template === undefined) throw new Error('Data guide is not registered');
      const expected = readFileSync(
        nodePath.join(fsUtilities.getTemplatesDirectory(), template),
        'utf8',
      );
      expect(guide?.content).toBe(expected);
      expect(existsSync(nodePath.join(root, PLANNING_DATA_GUIDE_PATH))).toBe(false);
      expect(packet.sourceChanged()).toBe(false);
      expect(packet.snapshotChanged()).toBe(false);
    } finally {
      packet.cleanup();
    }
  });

  it('prefers the existing project guide and does not mask a blank guide', () => {
    const root = project();
    const guide = nodePath.join(root, PLANNING_DATA_GUIDE_PATH);
    mkdirSync(nodePath.dirname(guide), { recursive: true });
    writeFileSync(guide, '# Project-owned data guide\n');
    const packet = prepareReviewPacket(root, 'plan-implementation', [target]);
    try {
      expect(packet.packet.context_files).toContainEqual({
        path: PLANNING_DATA_GUIDE_PATH,
        content: '# Project-owned data guide\n',
      });
    } finally {
      packet.cleanup();
    }
    writeFileSync(guide, '');
    expect(() => prepareReviewPacket(root, 'plan-implementation', [target])).toThrow(
      'Required planning data',
    );
  });

  it('detects a change to the captured package guide', () => {
    const root = project();
    const guide = packagedGuide();
    const packet = prepareReviewPacket(root, 'plan-implementation', [target]);
    try {
      expect(packet.sourceChanged()).toBe(false);
      writeFileSync(guide, '# Changed ownership contract\n');
      expect(packet.sourceChanged()).toBe(true);
    } finally {
      packet.cleanup();
    }
  });

  it('refuses package or project guide symlinks instead of crossing their source boundary', () => {
    const root = project();
    const guide = packagedGuide();
    const outside = nodePath.join(directory(), 'outside.md');
    writeFileSync(outside, '# Outside guide\n');
    rmSync(guide);
    symlinkSync(outside, guide);
    expect(() => prepareReviewPacket(root, 'plan-implementation', [target])).toThrow(
      'Required planning data',
    );
    const projectGuide = nodePath.join(root, PLANNING_DATA_GUIDE_PATH);
    mkdirSync(nodePath.dirname(projectGuide), { recursive: true });
    symlinkSync(outside, projectGuide);
    expect(() => prepareReviewPacket(root, 'plan-implementation', [target])).toThrow(
      'Required planning data',
    );
  });
});
