/** Canonical tool envelope for the pinned V2 SDK. Patch remains unproved. */
export function normalizeOpenCodeTool(
  _protocol: 'v2',
  tool: string,
  input: unknown,
):
  | { tool_name: 'Bash' | 'Edit' | 'Write' | 'apply_patch'; tool_input: Record<string, unknown> }
  | undefined {
  const covered = ['shell', 'edit', 'write'];
  if (!covered.includes(tool)) return undefined;
  const denial = 'Safeword denied this OpenCode tool call.';
  function requiredString(value: unknown): string {
    if (typeof value !== 'string' || value.length === 0) throw new Error(denial);
    return value;
  }
  function objectArguments(value: unknown): Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      throw new Error(denial);
    return value as Record<string, unknown>;
  }
  const args = objectArguments(input);
  function fileInput(): Record<string, unknown> {
    const fields: Record<string, unknown> = {
      file_path: requiredString(args.path),
    };
    if (tool === 'write') {
      if (typeof args.content === 'string') fields.content = args.content;
      return fields;
    }
    if (typeof args.oldString === 'string') fields.old_string = args.oldString;
    if (typeof args.newString === 'string') fields.new_string = args.newString;
    if (typeof args.replaceAll === 'boolean') fields.replace_all = args.replaceAll;
    return fields;
  }
  if (tool === 'shell') {
    return { tool_name: 'Bash', tool_input: { command: requiredString(args.command) } };
  }
  if (tool === 'edit' || tool === 'write') {
    return { tool_name: tool === 'edit' ? 'Edit' : 'Write', tool_input: fileInput() };
  }
  return undefined;
}
