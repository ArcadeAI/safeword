import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it, vi } from 'vitest';

import { propagationLanes } from '../../scripts/lib/resource-propagation.js';
import { prepareNativeResourceActor } from '../../scripts/lib/resource-propagation-run.js';
import type { CursorNativeCatalogueActor } from '../helpers/cursor-native-catalogue.js';
import { CursorNativeWindowActor } from '../helpers/cursor-native-window.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import { createPropagationSource } from '../helpers/propagation-source.js';

it('refreshes project resources without multiplying observed hook registrations or losing user hooks', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'cursor-observer-refresh-'));
  try {
    // Substitute only external host/window I/O; the real factory, public
    // install/upgrade and observer instrumentation execute before launch.
    let actor!: CursorNativeCatalogueActor;
    const edge = CursorNativeWindowActor.prototype as unknown as {
      prepareHost(): Promise<void>;
      launchWindow(): Promise<void>;
      action(action: string): Promise<string>;
    };
    vi.spyOn(edge, 'prepareHost').mockResolvedValue();
    vi.spyOn(edge, 'action').mockImplementation(action => {
      expect(action).toBe('close');
      return Promise.resolve('');
    });
    const recordLaunch = (value: CursorNativeCatalogueActor) => {
      actor = value;
      return Promise.reject(new Error('SOURCE_WINDOW_BOUNDARY'));
    };
    vi.spyOn(edge, 'launchWindow').mockImplementation(function (this: CursorNativeCatalogueActor) {
      return recordLaunch(this);
    });
    const previous = createCanonicalCatalogueInputs(mkdtempSync(nodePath.join(root, 'previous-')));
    const sourcePackage = createPropagationSource(
      mkdtempSync(nodePath.join(root, 'source-')),
      previous,
    );
    const lane = propagationLanes().find(
      row => row.agent === 'cursor' && row.delivery === 'project-hooks',
    );
    expect(lane).toBeDefined();
    if (!lane) throw new Error('PROJECT_LANE_MISSING');
    await expect(
      prepareNativeResourceActor(
        lane,
        { ...previous, sourcePackage },
        {
          runsDirectory: root,
          applicationBundle: nodePath.join(root, 'unexecuted-app'),
          profileDirectory: nodePath.join(root, 'owned-profile'),
          extensionsDirectory: nodePath.join(root, 'owned-extensions'),
        },
        root,
      ),
    ).rejects.toThrow('SOURCE_WINDOW_BOUNDARY');
    const manifestPath = nodePath.join(actor.workspace, '.cursor/hooks.json');
    const manifest = () =>
      JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        version: number;
        userSetting: string;
        hooks: Record<string, { command: string; timeout?: number }[]> & {
          stop: { command: string; timeout?: number }[];
        };
      };
    const configured = manifest();
    const userHook = { command: ': owned-user-hook', timeout: 7 };
    let userCommand = userHook.command;
    configured.hooks.stop.push(userHook);
    configured.userSetting = 'preserve';
    writeFileSync(manifestPath, JSON.stringify(configured));
    const counts = (value: ReturnType<typeof manifest>) =>
      Object.fromEntries(
        Object.entries(value.hooks).map(([event, entries]) => [event, entries.length]),
      );
    const before = counts(configured);
    const originalActor = actor;
    for (let revision = 0; revision < 2; revision++) {
      const current = createCanonicalCatalogueInputs(mkdtempSync(nodePath.join(root, 'current-')));
      await expect(actor.refreshResources({ ...current, sourcePackage })).rejects.toThrow(
        'SOURCE_WINDOW_BOUNDARY',
      );
      expect(actor).toBe(originalActor);
      // Upgrade omission cannot satisfy these current resource assertions.
      for (const [path, marker] of [
        ['skills/explain/SKILL.md', current.workflowMarker],
        ['skills/explain/HOST_CONTRACT_GUIDE.md', current.guideMarker],
        ['hooks/audit-principle-trace.ts', current.helperMarker],
      ] as const)
        expect(readFileSync(nodePath.join(actor.workspace, '.safeword', path), 'utf8')).toContain(
          marker,
        );
      const after = manifest();
      expect(after.userSetting).toBe('preserve');
      expect(
        after.hooks.stop.filter(entry => entry.command.includes('owned-user-hook')),
      ).toHaveLength(1);
      // One observer wraps each entry, including the user's command; its
      // options survive. No nested observer or appended managed duplicates.
      expect(
        after.hooks.stop.find(entry => entry.command.includes('owned-user-hook'))?.timeout,
      ).toBe(userHook.timeout);
      expect(
        after.hooks.stop.find(entry => entry.command.includes('owned-user-hook'))?.command,
      ).toContain(userCommand);
      for (const entries of Object.values(after.hooks))
        for (const entry of entries)
          expect(entry.command.match(/cursor-hook-observer\.ts/gu)).toHaveLength(1);
      expect(counts(after), 'PROJECT_OBSERVER_DUPLICATED_HOOKS').toEqual(before);
      if (revision === 0) {
        // User edits after instrumentation must survive the next upgrade too.
        userCommand += ' edited';
        after.hooks.stop = after.hooks.stop.map(entry =>
          entry.command.includes('owned-user-hook') ? { ...entry, command: userCommand } : entry,
        );
        writeFileSync(manifestPath, JSON.stringify(after));
      }
    }
  } finally {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);
