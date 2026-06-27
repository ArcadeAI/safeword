import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  CURSOR_COMMAND_WRAPPERS,
  CURSOR_RULE_WRAPPERS,
  renderCursorCommandWrapper,
  renderCursorRuleWrapper,
} from '../src/cursor-wrappers.js';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const cliRoot = path.resolve(import.meta.dirname, '..');

function templatePathForWrapper({ relativePath }: { readonly relativePath: string }): string {
  if (relativePath.startsWith('.cursor/commands/')) {
    return relativePath.replace(/^\.cursor\/commands\//, 'commands/');
  }

  return relativePath.replace(/^\.cursor\//, 'cursor/');
}

function writeGeneratedFile({
  relativePath,
  content,
}: {
  readonly relativePath: string;
  readonly content: string;
}): void {
  const destinations = [
    path.join(repoRoot, relativePath),
    path.join(cliRoot, 'templates', templatePathForWrapper({ relativePath })),
  ];

  for (const destination of destinations) {
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, content);
  }
}

for (const wrapper of CURSOR_RULE_WRAPPERS) {
  writeGeneratedFile({
    relativePath: `.cursor/rules/${wrapper.name}.mdc`,
    content: renderCursorRuleWrapper({ wrapper }),
  });
}

for (const wrapper of CURSOR_COMMAND_WRAPPERS) {
  writeGeneratedFile({
    relativePath: `.cursor/commands/${wrapper.name}.md`,
    content: renderCursorCommandWrapper({ wrapper }),
  });
}
