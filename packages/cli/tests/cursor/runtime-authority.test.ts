import { describe, expect, it } from 'vitest';

import {
  CURSOR_COMMAND_WRAPPERS,
  CURSOR_RULE_WRAPPERS,
  renderCursorCommandWrapper,
  renderCursorRuleWrapper,
} from '../../src/cursor-wrappers.js';
import {
  assertCursorRuntimeAuthority,
  type RuntimeAuthorityAsset,
} from '../../src/plugin-runtime-authority.js';

function generatedCursorCatalogue(): RuntimeAuthorityAsset[] {
  const skillsRoot = nodePath.resolve(import.meta.dirname, '../../templates/skills');
  return [
    ...readdirSync(skillsRoot, { recursive: true, encoding: 'utf8' })
      .filter(path => path.endsWith('.md'))
      .map(path => ({
        relativePath: `.safeword/skills/${path}`,
        content: readFileSync(nodePath.join(skillsRoot, path), 'utf8'),
      })),
    ...CURSOR_COMMAND_WRAPPERS.map(wrapper => ({
      relativePath: `.cursor/commands/${wrapper.name}.md`,
      content: renderCursorCommandWrapper({ wrapper }),
    })),
    ...CURSOR_RULE_WRAPPERS.map(wrapper => ({
      relativePath: `.cursor/rules/${wrapper.name}.mdc`,
      content: renderCursorRuleWrapper({ wrapper }),
    })),
  ];
}

describe('Cursor runtime authority', () => {
  it("accepts the generated Cursor catalogue's project authority", () => {
    expect(() => {
      assertCursorRuntimeAuthority(generatedCursorCatalogue());
    }).not.toThrow();
  });

  it("rejects a Cursor executable reference to another host's runtime", () => {
    const assets = generatedCursorCatalogue().map(asset =>
      asset.relativePath === '.safeword/skills/audit/SKILL.md'
        ? {
            ...asset,
            content: `${asset.content}\nRun \`bun "\${CLAUDE_PLUGIN_ROOT}/runtime/cli.js" project audit-scope\`.\n`,
          }
        : asset,
    );
    expect(() => {
      assertCursorRuntimeAuthority(assets);
    }).toThrow('.safeword/skills/audit/SKILL.md');
  });
});
import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
