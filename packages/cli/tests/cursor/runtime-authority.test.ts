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
  return [
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
    expect(() => {
      assertCursorRuntimeAuthority([
        {
          relativePath: '.cursor/commands/audit.md',
          content:
            '```bash\necho audit\n```\nRun `bun "${CLAUDE_PLUGIN_ROOT}/runtime/cli.js" project audit-scope` for this project.',
        },
      ]);
    }).toThrow('.cursor/commands/audit.md');
  });
});
