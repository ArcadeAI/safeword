import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

export function writePlanningInventories(directory: string): void {
  const project = nodePath.join(directory, '.project');
  mkdirSync(project, { recursive: true });
  const inventories = {
    principles:
      '# Principles\n\n## Preserve approval authority\n\nCurrent authenticated approval controls advancement.\n',
    personas:
      '# Personas\n\n## Builder (BU)\n\n**Role:** A builder requesting planning approval.\n**Context:** Needs current authenticated approval before advancement.\n',
    surfaces:
      '# Surfaces\n\n## Safeword CLI\n\n**Kind:** CLI\n**Description:** Requests and presents planning approval.\n**Audience:** Builder (BU)\n',
  };
  for (const [role, content] of Object.entries(inventories)) {
    writeFileSync(nodePath.join(project, `${role}.md`), content);
  }
}
