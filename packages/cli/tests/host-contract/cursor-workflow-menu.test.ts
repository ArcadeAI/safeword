import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

// The actor is macOS-only. Compile its actual Swift matcher; no AX calls, app or model.
it.runIf(process.platform === 'darwin')(
  'matches current AX command value and exact candidate description',
  () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'cursor-menu-match-'));
    try {
      const main = nodePath.join(root, 'main.swift');
      const helper = readFileSync(
        nodePath.resolve(import.meta.dirname, '../fixtures/host-contract/cursor-ide-native.swift'),
        'utf8',
      );
      writeFileSync(
        main,
        String.raw`${helper}
      import Foundation
      func reject(_ message: String) -> Never {
        FileHandle.standardError.write(Data((message + "\n").utf8))
        exit(2)
      }
      let description = "Runs the Safeword contract catalogue probe in an isolated native host test."
      let foreign = WorkflowMenuRow(value: "/explain", text: ["/", "explain", "Explain without changing code"])
      let candidate = WorkflowMenuRow(value: "/explain", text: ["/", "explain", description])
      let other = WorkflowMenuRow(value: "Add Skills", text: ["Add Skills"])
      let label = "/explain " + description
      guard try workflowIndex([foreign, candidate, other], label) == 1 else {
        reject("CURSOR_CURRENT_MENU_NOT_SELECTED")
      }
      guard try workflowIndex([foreign, other], label) == nil else { reject("FOREIGN_MENU_SELECTED") }
      guard try workflowIndex([], label) == nil else { reject("MISSING_MENU_SELECTED") }
      let wrongCommand = WorkflowMenuRow(value: "/audit", text: ["/", "audit", description])
      guard try workflowIndex([wrongCommand], label) == nil else { reject("WRONG_COMMAND_SELECTED") }
      do {
        _ = try workflowIndex([candidate, candidate], label)
        reject("AMBIGUOUS_MENU_SELECTED")
      } catch {
        guard (error as NSError).domain == "Ambiguous candidate-origin native workflow" else { throw error }
      }
      print("CURRENT_MENU_CONTROLS_PASS")
    `,
      );
      const binary = nodePath.join(root, 'selector-test');
      const compile = spawnSync('swiftc', ['-D', 'CURSOR_SELECTOR_TEST', main, '-o', binary], {
        encoding: 'utf8',
        timeout: 60_000,
      });
      expect(compile.status, compile.stderr).toBe(0);
      const result = spawnSync(binary, [], { encoding: 'utf8', timeout: 10_000 });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout.trim()).toBe('CURRENT_MENU_CONTROLS_PASS');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);
