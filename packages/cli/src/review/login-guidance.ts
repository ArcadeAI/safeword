/** Add the plugin-only sign-in handoff without changing project or Cursor templates. */
export function adaptReviewerLoginGuidance(content: string): string {
  const handoff =
    'call `mcp__safeword_review__start_reviewer_login` with the same project root and review_id. ' +
    'It launches only the assigned reviewer CLI outside the author shell sandbox and asks the OS default browser to open its exact HTTPS URL without a shell. ' +
    'If that opener cannot start, the MCP Apps view requests a host browser open. ' +
    'If neither opens the page, show the exact clickable link and any Codex device code in chat. ' +
    'The user completes the vendor sign-in flow.';
  return content
    .replaceAll(
      /execute its exact recovery command;\s+the\s+user's browser or device flow may need to complete\./gu,
      () => handoff,
    )
    .replaceAll(
      /execute its exact recovery command and\s+rerun the same coordinator command once after authentication succeeds\./gu,
      () => `${handoff} Rerun the same coordinator command once after authentication succeeds.`,
    );
}
