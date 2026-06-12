/**
 * Project Context Utilities
 *
 * Shared helpers for creating ProjectContext objects used by reconcile().
 */

import nodePath from 'node:path';

import type { ProjectContext } from '../schema.js';
import { resolveNamespaceRoot } from './configured-paths.js';
import { readJson } from './fs.js';
import { isGitRepo } from './git.js';
import { detectLanguages, detectProjectType, type PackageJson } from './project-detector.js';

/**
 * Create a ProjectContext from the current working directory.
 *
 * Reads package.json, detects project type and languages for use with reconcile().
 * @param cwd - Working directory
 */
export function createProjectContext(cwd: string): ProjectContext {
  const packageJson = readJson(nodePath.join(cwd, 'package.json')) as PackageJson | undefined;

  return {
    cwd,
    projectType: detectProjectType(packageJson ?? {}, cwd),
    developmentDeps: packageJson?.devDependencies ?? {},
    productionDeps: packageJson?.dependencies ?? {},
    isGitRepo: isGitRepo(cwd),
    languages: detectLanguages(cwd),
    namespaceRoot: resolveNamespaceRoot(cwd),
  };
}
