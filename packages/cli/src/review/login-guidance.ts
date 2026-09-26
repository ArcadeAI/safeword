/** Add the plugin-only sign-in handoff without changing project or Cursor templates. */
export function adaptReviewerLoginGuidance(content: string): string {
  const handoff =
    'run its exact recovery command in a visible interactive terminal and keep it open. ' +
    'Capture the exact HTTPS URL printed by the reviewer CLI and any Codex device code. ' +
    'Call `mcp__safeword_review__show_reviewer_login` with the same project root and review_id. ' +
    'The MCP Apps view requests that the host open the URL. If the host cannot show the view, ' +
    'try the local OS default URL opener with that URL as one argument; if blocked, show the ' +
    'clickable link and code in chat. The user completes sign-in and pastes any Claude code ' +
    'into the waiting terminal.';
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
