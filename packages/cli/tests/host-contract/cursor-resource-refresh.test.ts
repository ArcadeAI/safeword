import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it, vi } from 'vitest';

import { propagationLanes } from '../../scripts/lib/resource-propagation.js';
import { prepareNativeResourceActor } from '../../scripts/lib/resource-propagation-run.js';
import type { CursorNativeCatalogueActor } from '../helpers/cursor-native-catalogue.js';
import { CursorNativeWindowActor } from '../helpers/cursor-native-window.js';
import {
  createCanonicalCatalogueInputs,
  NATIVE_CATALOGUE_PROBE_DESCRIPTION,
} from '../helpers/native-catalogue-probe.js';
import { createPropagationSource } from '../helpers/propagation-source.js';

// Only host/window I/O is substituted. Stop at the real launch boundary,
// retaining the actual factory-created actor; no native observations are supplied.
class ResourceFixture {
  readonly root = mkdtempSync(nodePath.join(tmpdir(), 'cursor-resource-refresh-'));
  actor!: CursorNativeCatalogueActor;
  environment!: NodeJS.ProcessEnv;
  constructor() {
    const recordLaunch = (actor: CursorNativeCatalogueActor) => {
      this.actor = actor;
      this.environment = (actor as unknown as { environment: NodeJS.ProcessEnv }).environment;
      return Promise.reject(new Error('RESOURCE_SOURCE_WINDOW_BOUNDARY'));
    };
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
    vi.spyOn(edge, 'launchWindow').mockImplementation(function (this: CursorNativeCatalogueActor) {
      return recordLaunch(this);
    });
  }
  revision(name: string) {
    const inputs = createCanonicalCatalogueInputs(mkdtempSync(nodePath.join(this.root, name)));
    const skill = nodePath.join(inputs.canonicalRoot, 'skills/explain/SKILL.md');
    // Canonical discovery purpose changes too, so the normal project wrapper
    // must refresh from its skill owner, rather than equivalent per-host text.
    writeFileSync(
      skill,
      readFileSync(skill, 'utf8').replace(
        `description: ${NATIVE_CATALOGUE_PROBE_DESCRIPTION}`,
        () => `description: ${NATIVE_CATALOGUE_PROBE_DESCRIPTION} ${inputs.workflowMarker}`,
      ),
    );
    return inputs;
  }
  close() {
    vi.restoreAllMocks();
    rmSync(this.root, { recursive: true, force: true });
  }
}

it.each(['project-hooks', 'native'])(
  'normally refreshes revised canonical resources on the same %s actor',
  async delivery => {
    const fixture = new ResourceFixture();
    try {
      const previous = fixture.revision('previous-');
      const current = fixture.revision('current-');
      expect(current.canonicalRoot).not.toBe(previous.canonicalRoot);
      const sourcePackage = createPropagationSource(
        mkdtempSync(nodePath.join(fixture.root, 'source-')),
        previous,
      );
      const lane = propagationLanes().find(
        row => row.agent === 'cursor' && row.runtime === 'IDE' && row.delivery === delivery,
      );
      expect(lane).toBeDefined();
      if (!lane) throw new Error('CURSOR_DELIVERY_MISSING');
      await expect(
        prepareNativeResourceActor(
          lane,
          { ...previous, sourcePackage },
          {
            runsDirectory: fixture.root,
            applicationBundle: nodePath.join(fixture.root, 'unexecuted-app'),
            profileDirectory: nodePath.join(fixture.root, 'owned-profile'),
            extensionsDirectory: nodePath.join(fixture.root, 'owned-extensions'),
          },
          fixture.root,
        ),
      ).rejects.toThrow('RESOURCE_SOURCE_WINDOW_BOUNDARY');
      const actor = fixture.actor;
      const native = delivery === 'native';
      const core = native
        ? nodePath.join(actor.runDirectory, 'candidate')
        : nodePath.join(actor.workspace, '.safeword');
      const extension = nodePath.join(actor.runDirectory, 'extension');
      const paths = native
        ? [
            'skills/explain/SKILL.md',
            'skills/explain/references/HOST_CONTRACT_GUIDE.md',
            'templates/hooks/audit-principle-trace.ts',
          ]
        : [
            'skills/explain/SKILL.md',
            'skills/explain/HOST_CONTRACT_GUIDE.md',
            'hooks/audit-principle-trace.ts',
          ];
      const policy = 'hooks/lib/done-gate.ts';
      const packages = native ? [core, extension] : [core];
      const policyFiles = packages.map(root =>
        nodePath.join(root, native ? `templates/${policy}` : policy),
      );
      const beforePolicy = policyFiles.map(path => readFileSync(path));
      expect(readFileSync(nodePath.join(current.canonicalRoot, policy))).toEqual(
        readFileSync(nodePath.join(previous.canonicalRoot, policy)),
      );
      const identity = actor.observedInstallation();
      expect(JSON.parse(identity)).toEqual(
        native ? [core, actor.workspace, extension] : [core, actor.workspace],
      );
      const wrapper = nodePath.join(actor.workspace, '.cursor/commands/explain.md');
      const beforeWrapper = native ? undefined : readFileSync(wrapper, 'utf8');
      const configFile = nodePath.join(actor.workspace, '.safeword/config.json');
      const config = {
        ...JSON.parse(readFileSync(configFile, 'utf8')),
        designApprovalGate: false,
        terminalHandoffCorrection: false,
        userOwnedFixtureSetting: 'preserve',
      };
      writeFileSync(configFile, JSON.stringify(config));
      const check = (inputs: typeof previous) => {
        const values = paths.map(path => readFileSync(nodePath.join(core, path), 'utf8'));
        for (const [index, marker] of [
          inputs.workflowMarker,
          inputs.guideMarker,
          inputs.helperMarker,
        ].entries())
          expect(values[index]).toContain(marker);
        if (native) {
          expect(existsSync(wrapper)).toBe(false);
          expect(existsSync(nodePath.join(actor.workspace, '.cursor/rules'))).toBe(false);
          const hooks = JSON.parse(
            readFileSync(nodePath.join(actor.workspace, '.cursor/hooks.json'), 'utf8'),
          );
          expect(Object.keys(hooks.hooks).toSorted((a, b) => a.localeCompare(b))).toEqual([
            'afterShellExecution',
            'workspaceOpen',
          ]);
        } else {
          expect(readFileSync(wrapper, 'utf8')).toContain(inputs.workflowMarker);
          expect(readFileSync(wrapper, 'utf8')).toContain('.safeword/skills/explain/SKILL.md');
        }
        for (const root of packages) {
          const helper = nodePath.join(
            root,
            native ? 'templates/hooks/audit-principle-trace.ts' : 'hooks/audit-principle-trace.ts',
          );
          const runtime = native
            ? nodePath.join(root, 'runtime/cli.js')
            : nodePath.join(sourcePackage, 'src/cli.ts');
          const artifact = nodePath.join(actor.workspace, '.host-contract/native-helper.json');
          rmSync(artifact, { force: true });
          const output = spawnSync(
            'bun',
            native
              ? [
                  runtime,
                  'project',
                  'runtime',
                  'audit-principle-trace',
                  '--cwd',
                  actor.workspace,
                  '--',
                  actor.workspace,
                ]
              : [helper, actor.workspace],
            { cwd: actor.workspace, env: fixture.environment, encoding: 'utf8' },
          );
          expect(output.status, output.stderr).toBe(0);
          expect(output.stdout.trim()).toBe(inputs.helperMarker);
          const observed = JSON.parse(readFileSync(artifact, 'utf8'));
          expect(observed.marker).toBe(inputs.helperMarker);
          expect(realpathSync(observed.origin)).toBe(realpathSync(helper));
          expect(realpathSync(observed.runtime)).toBe(realpathSync(runtime));
        }
        return values;
      };
      const before = check(previous);
      await expect(actor.refreshResources({ ...current, sourcePackage })).rejects.toThrow(
        'RESOURCE_SOURCE_WINDOW_BOUNDARY',
      );
      expect(fixture.actor).toBe(actor);
      expect(actor.observedInstallation()).toBe(identity);
      expect(JSON.parse(readFileSync(configFile, 'utf8'))).toEqual(config);
      const after = check(current);
      for (const [index, value] of after.entries()) expect(value).not.toBe(before[index]);
      if (!native) expect(readFileSync(wrapper, 'utf8')).not.toBe(beforeWrapper);
      expect(policyFiles.map(path => readFileSync(path))).toEqual(beforePolicy);
      expect(readFileSync(nodePath.join(current.canonicalRoot, policy))).toEqual(
        readFileSync(nodePath.join(previous.canonicalRoot, policy)),
      );
    } finally {
      fixture.close();
    }
  },
  120_000,
);
