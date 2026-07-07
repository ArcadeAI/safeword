/**
 * Hook-integration nudges for non-husky worlds (ZJMZ50, #810 child 2).
 *
 * Husky hosts get the boundary shims appended by reconcile (schema
 * textPatches); every other world gets a printed, verbatim-usable snippet —
 * safeword never edits lefthook.yml or .pre-commit-config.yaml (user-owned
 * YAML). The nudge quiesces once the target config invokes the boundary
 * gate, and repeats on later setups until then (vendored-ignores precedent:
 * the quiesce signal is integration, not run count).
 */

import nodePath from 'node:path';

import type { ProjectContext } from '../packs/types.js';
import { readFileSafe } from './fs.js';
import { gitToplevel } from './git.js';
import { LEFTHOOK_CONFIGS } from './hook-manager.js';

/** Substring proving a config already invokes the gate — the quiesce signal. */
const BOUNDARY_INVOCATION = 'safeword boundary';

// Snippet lines carry the same armor as the husky shim (TB1.R4): the `[ -x ]`
// guard keeps a fresh clone (no node_modules) silent, and `|| true` keeps a
// crashing gate from blocking — pre-commit and lefthook both treat a non-zero
// hook as failure, so an unguarded entry would break the warn-only contract.
const LEFTHOOK_SNIPPET = `Boundary gate: this repo uses lefthook, and safeword never edits lefthook.yml.
To wire the warn-only boundary gate, add:

pre-commit:
  commands:
    safeword-boundary:
      run: '[ -x node_modules/.bin/safeword ] && node_modules/.bin/safeword boundary --at commit || true'
pre-push:
  commands:
    safeword-boundary:
      run: '[ -x node_modules/.bin/safeword ] && node_modules/.bin/safeword boundary --at push || true'`;

// `stages` is explicit on BOTH hooks: pre-commit's default_stages spreads a
// stage-less hook to every installed hook type, so the commit-tier gate would
// also fire on push in a `--hook-type pre-push` install.
const PRE_COMMIT_SNIPPET = `Boundary gate: this repo uses the pre-commit framework, and safeword never edits .pre-commit-config.yaml.
To wire the warn-only boundary gate, add under repos:

  - repo: local
    hooks:
      - id: safeword-boundary-commit
        name: safeword boundary gate (commit)
        entry: sh -c '[ -x node_modules/.bin/safeword ] && node_modules/.bin/safeword boundary --at commit || true'
        language: system
        always_run: true
        pass_filenames: false
        stages: [pre-commit]
      - id: safeword-boundary-push
        name: safeword boundary gate (push)
        entry: sh -c '[ -x node_modules/.bin/safeword ] && node_modules/.bin/safeword boundary --at push || true'
        language: system
        always_run: true
        pass_filenames: false
        stages: [pre-push]`;

const BARE_NUDGE = `Boundary gate: no hook manager detected, so the commit/push boundary gate is not installed.
To adopt one, husky is the lightest path:

  npm install -D husky && npx husky init

then re-run \`safeword setup\` to install the boundary-gate shims.`;

const HUSKY_UNINITIALIZED_NUDGE = `Boundary gate: husky is in your dependencies but .husky/ does not exist yet.
Run \`npx husky init\`, then re-run \`safeword setup\` to install the boundary-gate shims.`;

/** True when any of the world's config files already invokes the gate. */
function configAlreadyIntegrates(cwd: string, configNames: string[]): boolean {
  return configNames.some(name =>
    (readFileSafe(nodePath.join(cwd, name)) ?? '').includes(BOUNDARY_INVOCATION),
  );
}

/**
 * The one-time-per-run hook-integration message for this host, or undefined
 * when there is nothing to say: husky hosts (shims handled by reconcile),
 * already-integrated configs, and plain non-git directories all stay silent
 * (SM1.R2 — no nudge noise where hooks can never fire).
 */
export function hookIntegrationNudge(ctx: ProjectContext): string | undefined {
  if (!ctx.isGitRepo) return repoRootNote(ctx.cwd);
  return worldNudge(ctx);
}

/** Monorepo subdir (SM1.R2): a git root above cwd means hooks exist — just
 * not here. Point at it; a plain non-git directory stays silent. */
function repoRootNote(cwd: string): string | undefined {
  const top = gitToplevel(cwd);
  return top === undefined || nodePath.resolve(top) === nodePath.resolve(cwd)
    ? undefined
    : `Boundary gate: git hooks belong at the repository root (${top}). Run \`safeword setup\` there to install the boundary gate.`;
}

function worldNudge(ctx: ProjectContext): string | undefined {
  switch (ctx.hookManager) {
    case 'lefthook': {
      return configAlreadyIntegrates(ctx.cwd, LEFTHOOK_CONFIGS) ? undefined : LEFTHOOK_SNIPPET;
    }
    case 'pre-commit': {
      return configAlreadyIntegrates(ctx.cwd, ['.pre-commit-config.yaml'])
        ? undefined
        : PRE_COMMIT_SNIPPET;
    }
    case 'husky-uninitialized': {
      return HUSKY_UNINITIALIZED_NUDGE;
    }
    case 'bare': {
      return BARE_NUDGE;
    }
    // husky hosts get shims from reconcile; undefined = unknown world (older
    // caller built the ctx without detection) — say nothing rather than guess.
    case 'husky':
    case undefined: {
      return undefined;
    }
  }
}
