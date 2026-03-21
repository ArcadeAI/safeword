/**
 * Rust language pack setup
 *
 * Handles Rust-specific setup logic including:
 * - Cargo.toml [lints.clippy] merge
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import type { SetupResult } from '../types.js';

// Default lint configuration for Cargo.toml
const SAFEWORD_CLIPPY_LINTS = `[lints.clippy]
# Enable pedantic for stricter linting (priority -1 allows individual overrides)
pedantic = { level = "deny", priority = -1 }

# Cherry-picked restriction lints for LLM enforcement
unwrap_used = "deny"
expect_used = "deny"
todo = "deny"

# Allow common pedantic noise
missing_errors_doc = "allow"
missing_panics_doc = "allow"
module_name_repetitions = "allow"

[lints.rust]
# Deny unsafe code by default (LLMs shouldn't write unsafe)
unsafe_code = "deny"
`;

/**
 * Regex to extract package name from Cargo.toml.
 * Matches: [package] ... name = "package-name"
 * Captures the package name in group 1.
 *
 * Note: This regex is also defined in templates/hooks/lib/lint.ts because
 * template files must be self-contained (they're copied to user projects).
 */
const CARGO_PACKAGE_NAME_REGEX = /\[package\][^[]*name\s*=\s*"([^"]+)"/;

const SAFEWORD_WORKSPACE_LINTS = `[workspace.lints.clippy]
# Enable pedantic for stricter linting (priority -1 allows individual overrides)
pedantic = { level = "deny", priority = -1 }

# Cherry-picked restriction lints for LLM enforcement
unwrap_used = "deny"
expect_used = "deny"
todo = "deny"

# Allow common pedantic noise
missing_errors_doc = "allow"
missing_panics_doc = "allow"
module_name_repetitions = "allow"

[workspace.lints.rust]
# Deny unsafe code by default (LLMs shouldn't write unsafe)
unsafe_code = "deny"
`;

/**
 * Detect the Rust package name for a given file path.
 *
 * Walks up from the file's directory to find the nearest Cargo.toml
 * with a [package] section, then extracts the package name.
 *
 * @param filePath - Absolute path to a .rs file
 * @param cwd - Project root directory (to stop walking)
 * @returns Package name, or undefined if not found
 */
export function detectRustPackage(filePath: string, cwd: string): string | undefined {
  // Start from the file's directory and walk up
  let currentDirectory = nodePath.dirname(filePath);

  // Normalize paths for comparison
  const normalizedCwd = nodePath.resolve(cwd);

  while (currentDirectory.startsWith(normalizedCwd)) {
    const cargoPath = nodePath.join(currentDirectory, 'Cargo.toml');

    if (existsSync(cargoPath)) {
      const content = readFileSync(cargoPath, 'utf8');

      // Check if this Cargo.toml has a [package] section
      if (content.includes('[package]')) {
        const nameMatch = CARGO_PACKAGE_NAME_REGEX.exec(content);
        return nameMatch?.[1];
      }
    }

    // Move up one directory
    const parentDirectory = nodePath.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) break; // Reached filesystem root
    currentDirectory = parentDirectory;
  }

  return undefined;
}

/**
 * Detect workspace type from Cargo.toml content
 */
export function detectWorkspaceType(
  cargoContent: string,
): 'virtual' | 'root-package' | 'single-crate' {
  const hasWorkspace = cargoContent.includes('[workspace]');
  const hasPackage = cargoContent.includes('[package]');

  if (hasWorkspace && !hasPackage) return 'virtual';
  if (hasWorkspace && hasPackage) return 'root-package';
  return 'single-crate';
}

/**
 * Check if Cargo.toml already has lint configuration
 */
function hasExistingLints(cargoContent: string): boolean {
  return (
    cargoContent.includes('[lints.clippy]') ||
    cargoContent.includes('[lints.rust]') ||
    cargoContent.includes('[lints]') ||
    cargoContent.includes('[workspace.lints.clippy]') ||
    cargoContent.includes('[workspace.lints.rust]')
  );
}

/**
 * Expand a single member pattern (handles glob patterns like "crates/*")
 */
function expandMemberPattern(cwd: string, pattern: string): string[] {
  // Simple glob: only handle trailing /* (most common Cargo workspace pattern)
  if (pattern.endsWith('/*')) {
    const baseDirectory = pattern.slice(0, -2); // Remove /*
    const fullPath = nodePath.join(cwd, baseDirectory);

    if (!existsSync(fullPath)) return [];

    try {
      const entries = readdirSync(fullPath, { withFileTypes: true });
      return entries
        .filter(entry => {
          if (!entry.isDirectory()) return false;
          // Only include directories that have Cargo.toml (are crates)
          const cargoPath = nodePath.join(fullPath, entry.name, 'Cargo.toml');
          return existsSync(cargoPath);
        })
        .map(entry => nodePath.join(baseDirectory, entry.name));
    } catch {
      return [];
    }
  }

  // Not a glob pattern, return as-is
  return [pattern];
}

/**
 * Parse workspace members from Cargo.toml
 * Supports both inline array and multi-line formats:
 * - members = ["crates/a", "crates/b"]
 * - members = [\n  "crates/a",\n  "crates/b"\n]
 *
 * Also expands simple glob patterns like "crates/*"
 *
 * @param cargoContent - Content of root Cargo.toml
 * @param cwd - Project root directory (needed for glob expansion)
 * @returns Array of expanded member paths
 */
export function parseWorkspaceMembers(cargoContent: string, cwd: string): string[] {
  // Match members = [...] with potential multi-line content
  const membersMatch = /\[workspace\][^[]*members\s*=\s*\[([\s\S]*?)\]/.exec(cargoContent);
  if (!membersMatch?.[1]) return [];

  const membersBlock = membersMatch[1];
  // Extract quoted strings
  const rawMembers: string[] = [];
  const stringRegex = /"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = stringRegex.exec(membersBlock)) !== null) {
    if (match[1]) {
      rawMembers.push(match[1]);
    }
  }

  // Expand glob patterns
  const expandedMembers: string[] = [];
  for (const member of rawMembers) {
    expandedMembers.push(...expandMemberPattern(cwd, member));
  }

  return expandedMembers;
}

/**
 * Add [lints] workspace = true to a member crate's Cargo.toml
 */
function addWorkspaceLints(memberCargoPath: string): void {
  if (!existsSync(memberCargoPath)) return;

  const content = readFileSync(memberCargoPath, 'utf8');

  // Skip if already has any lints configuration
  if (hasExistingLints(content)) return;

  const lintsSection = `[lints]
workspace = true
`;

  const newContent = `${content.trimEnd()}\n\n${lintsSection}`;
  writeFileSync(memberCargoPath, newContent, 'utf8');
}

/**
 * Add lint configuration to root Cargo.toml if not present
 */
function addRootLints(cargoPath: string, content: string, isWorkspace: boolean): void {
  if (hasExistingLints(content)) return;

  const lintsToAdd = isWorkspace ? SAFEWORD_WORKSPACE_LINTS : SAFEWORD_CLIPPY_LINTS;
  const newContent = `${content.trimEnd()}\n\n${lintsToAdd}`;
  writeFileSync(cargoPath, newContent, 'utf8');
}

/**
 * Add lints.workspace = true to all workspace member crates
 */
function addMemberLints(cwd: string, content: string): void {
  const members = parseWorkspaceMembers(content, cwd);
  for (const member of members) {
    const memberCargoPath = nodePath.join(cwd, member, 'Cargo.toml');
    addWorkspaceLints(memberCargoPath);
  }
}

/**
 * Set up Rust tooling configuration.
 *
 * @param cwd - Project root directory
 * @returns Setup result
 */
export function setupRustTooling(cwd: string): SetupResult {
  const cargoPath = nodePath.join(cwd, 'Cargo.toml');
  if (!existsSync(cargoPath)) return { files: [] };

  // Read Cargo.toml once
  const content = readFileSync(cargoPath, 'utf8');
  const workspaceType = detectWorkspaceType(content);
  const isWorkspace = workspaceType !== 'single-crate';

  // Add lint configuration to root
  addRootLints(cargoPath, content, isWorkspace);

  // For workspaces, add lints.workspace = true to member crates
  if (isWorkspace) {
    addMemberLints(cwd, content);
  }

  return { files: [] };
}
