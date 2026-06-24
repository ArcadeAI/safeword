/**
 * Shared fixture + assertion helpers for the architecture-doc acceptance lanes
 * (tickets ZRW21K, ZD70P1). Black-box: build a temp-dir project, drive the real
 * `safeword architecture` CLI, and inspect the docs it writes. Centralized so the
 * monorepo-coverage and Go-language-pack step files share one implementation (no
 * duplicated fixture scaffolding) and one cleanup hook.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';

import { After } from '@cucumber/cucumber';

import type { SafewordWorld } from '../world.js';

export const PROJECT_ROOT = nodePath.resolve(import.meta.dirname, '..', '..');
export const CLI_PATH = nodePath.join(PROJECT_ROOT, 'packages/cli/src/cli.ts');

export interface ArchitectureWorld extends SafewordWorld {
  dir?: string;
  status?: number;
}

/** The scenario's temp project directory, created on first use. */
export function worldDir(world: ArchitectureWorld): string {
  world.dir ??= mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'arch-bdd-'));
  return world.dir;
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(nodePath.dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
}

/** The derived root index / single-repo doc at `.project/architecture.generated.md`. */
export function rootDoc(world: ArchitectureWorld): string {
  const path = nodePath.join(worldDir(world), '.project', 'architecture.generated.md');
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

/** Whether a `packages/<name>` leaf carries its own colocated architecture doc. */
export function leafDocExists(world: ArchitectureWorld, name: string): boolean {
  return existsSync(nodePath.join(worldDir(world), 'packages', name, 'architecture.generated.md'));
}

/** A `### name` package section of the root index (to its next heading or EOF). */
export function packageSection(world: ArchitectureWorld, name: string): string {
  const chunk = rootDoc(world)
    .split('\n### ')
    .find(part => part.startsWith(`${name}\n`));
  return chunk === undefined ? '' : `### ${chunk.split('\n## ')[0]}`;
}

After(function (this: ArchitectureWorld) {
  if (this.dir !== undefined) rmSync(this.dir, { recursive: true, force: true });
});
