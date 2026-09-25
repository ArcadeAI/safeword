// Shared scenario-format helpers for test-definitions.md.
// Extracted so the GFM checkbox rules are unit-testable independent of the
// stop hook's top-level IO/exit flow.

export interface ScenarioFormat {
  checked: number;
  unchecked: number;
  /**
   * True when the file has meaningful content (> 50 chars, excluding stubs)
   * but zero recognized GFM checkboxes — signals legacy / malformed scenario
   * format that would silently slip past the progress check.
   */
  isUnrecognized: boolean;
}

/** Analyze GFM checkbox state in test-definitions.md content. */
export function analyzeScenarioFormat(content: string): ScenarioFormat {
  const checked = (content.match(/^\s*- \[x\]/gim) ?? []).length;
  const unchecked = (content.match(/^\s*- \[ \]/gim) ?? []).length;
  return {
    checked,
    unchecked,
    isUnrecognized: checked + unchecked === 0 && content.length > 50,
  };
}
