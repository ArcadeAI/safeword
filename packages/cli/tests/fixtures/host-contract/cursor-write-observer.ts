import { appendFileSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

// Observation only: emit no permission or continuation decision. Record only
// synthetic tool fields, never user identity, credentials or the full transcript.
const input = JSON.parse(readFileSync(0, 'utf8')) as {
  hook_event_name?: string;
  cursor_version?: string;
  workspace_roots?: string[];
  tool_name?: string;
  tool_input?: { command?: string };
  tool_output?: string;
  command?: string;
  output?: string;
};
const workspace = input.workspace_roots?.[0];
if (!workspace || !nodePath.isAbsolute(workspace))
  throw new Error('Expected a native workspace root');
appendFileSync(
  nodePath.join(workspace, '.host-contract', 'write-observations.jsonl'),
  `${JSON.stringify({
    event: input.hook_event_name,
    source: process.argv[2] ?? 'project-observer',
    version: input.cursor_version,
    roots: input.workspace_roots,
    tool: input.tool_name,
    command: input.tool_input?.command ?? input.command,
    output: input.tool_output ?? input.output,
  })}\n`,
);
