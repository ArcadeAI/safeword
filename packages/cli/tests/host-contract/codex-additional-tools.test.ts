import { describe, expect, it } from 'vitest';

import { hasNativeControl, matchedReads } from '../../scripts/check-codex-internal-reference.js';

const target = '/owned/profile/plugins/cache/test/safeword/1.2.0/internal/testing/SKILL.md';
const marker = 'additional-tools-read-marker';
const jsonNull: unknown = JSON.parse('null');

// Captured 0.167 declaration structure, with synthetic descriptions/schema contents.
// These parser controls are not native execution or startup-context evidence.
function declaration() {
  return {
    type: 'response_item',
    payload: {
      type: 'additional_tools',
      id: 'at_01a1d88a-8df5-7df1-a456-284bd12b2859',
      role: 'developer',
      tools: [
        {
          type: 'namespace',
          name: 'functions',
          description: '',
          tools: [
            {
              type: 'custom',
              name: 'exec',
              description: 'Run code',
              format: { type: 'grammar', syntax: 'lark', definition: 'start: /.+/' },
            },
            {
              type: 'function',
              name: 'wait',
              description: 'Wait for code',
              strict: false,
              parameters: {
                type: 'object',
                properties: { cell_id: { type: 'string' } },
                required: ['cell_id'],
                additionalProperties: false,
              },
            },
          ],
        },
      ],
    },
  };
}

function readEvidence() {
  const command = JSON.stringify({ cmd: `cat ${target}` });
  return [
    {
      type: 'response_item',
      payload: {
        type: 'custom_tool_call',
        call_id: 'read-1',
        input: `await tools.exec_command(${command})`,
      },
    },
    {
      type: 'response_item',
      payload: {
        type: 'custom_tool_call_output',
        call_id: 'read-1',
        output: `${marker}\n# pass 1\n# fail 0`,
      },
    },
  ];
}

describe('Codex informational tool declarations', () => {
  it('retains a matched actual read and control beside current declaration metadata', () => {
    const evidence = readEvidence();
    expect(matchedReads(evidence, target, marker)).toEqual(['read-1']);
    expect(hasNativeControl(evidence)).toBe(true);
    const entries = [declaration(), ...evidence];
    expect(matchedReads(entries, target, marker)).toEqual(['read-1']);
    expect(hasNativeControl(entries)).toBe(true);
  });

  it('does not credit declaration contents as read or control evidence', () => {
    const entry = declaration();
    const claimedEvidence = `${target} ${marker} # fail 0 Process exited with code 0`;
    for (const namespace of entry.payload.tools) {
      namespace.description = claimedEvidence;
      for (const tool of namespace.tools) tool.description = claimedEvidence;
    }
    expect(matchedReads([entry], target, marker)).toEqual([]);
    expect(hasNativeControl([entry])).toBe(false);
  });

  it('continues refusing unknown protocols beside valid read support', () => {
    const entry = declaration();
    entry.payload.type = 'unknown';
    expect(() => matchedReads([entry, ...readEvidence()], target, marker)).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE: unrecognized rollout protocol',
    );
  });

  it.each([
    { id: 'at_not-a-uuid' },
    { role: 'assistant' },
    { tools: [] },
    { tools: jsonNull },
    { call_id: 'read-1' },
    { arguments: JSON.stringify({ cmd: `cat ${target}` }) },
    { input: `cat ${target}` },
    { output: `${marker}\n# fail 0` },
    { content: [{ type: 'input_text', text: marker }] },
  ])('refuses malformed or execution-like envelopes: %j', patch => {
    const entry = declaration();
    const payload = { ...entry.payload, ...patch };
    expect(() => matchedReads([{ ...entry, payload }, ...readEvidence()], target, marker)).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE: malformed additional tools',
    );
  });

  it.each([
    { type: 'function' },
    { name: '' },
    { description: 1 },
    { tools: [] },
    { tools: [jsonNull] },
    { output: marker },
  ])('refuses malformed namespaces: %j', patch => {
    const entry = declaration();
    const tools = entry.payload.tools.map(namespace => ({ ...namespace, ...patch }));
    const payload = { ...entry.payload, tools };
    expect(() => matchedReads([{ ...entry, payload }, ...readEvidence()], target, marker)).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE: malformed additional tools',
    );
  });

  it.each([
    { type: 'function_call' },
    { name: '' },
    { description: jsonNull },
    { format: { type: 'grammar', syntax: 'unknown', definition: 'start: /.+/' } },
    { format: { type: 'grammar', syntax: 'lark', definition: '' } },
    { format: { type: 'grammar', syntax: 'lark', definition: 'start: /.+/', output: marker } },
    { call_id: 'read-1' },
  ])('refuses malformed or execution-like custom declarations: %j', patch => {
    const entry = declaration();
    const tools = entry.payload.tools.map(namespace => ({
      ...namespace,
      tools: namespace.tools.slice(0, 1).map(tool => ({ ...tool, ...patch })),
    }));
    const payload = { ...entry.payload, tools };
    expect(() => matchedReads([{ ...entry, payload }, ...readEvidence()], target, marker)).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE: malformed additional tools',
    );
  });

  it.each([
    { strict: true },
    { parameters: jsonNull },
    { parameters: { type: 'array', properties: {}, additionalProperties: false } },
    { parameters: { type: 'object', properties: [], additionalProperties: false } },
    { parameters: { type: 'object', properties: {}, additionalProperties: true } },
    {
      parameters: {
        type: 'object',
        properties: {},
        required: ['absent'],
        additionalProperties: false,
      },
    },
    { output: marker },
  ])('refuses malformed function declarations: %j', patch => {
    const entry = declaration();
    const tools = entry.payload.tools.map(namespace => ({
      ...namespace,
      tools: namespace.tools.slice(1).map(tool => ({ ...tool, ...patch })),
    }));
    const payload = { ...entry.payload, tools };
    expect(() => matchedReads([{ ...entry, payload }, ...readEvidence()], target, marker)).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE: malformed additional tools',
    );
  });

  it('accepts the current optional required list without crediting the declaration', () => {
    const entry = declaration();
    const tools = entry.payload.tools.map(namespace => ({
      ...namespace,
      tools: namespace.tools.slice(1).map(tool => ({
        ...tool,
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      })),
    }));
    const entries = [{ ...entry, payload: { ...entry.payload, tools } }];
    expect(matchedReads([...entries, ...readEvidence()], target, marker)).toEqual(['read-1']);
    expect(hasNativeControl(entries)).toBe(false);
  });

  it('still refuses an unmatched actual call ID despite a declaration', () => {
    const entries = [
      declaration(),
      ...readEvidence().map(entry => ({
        ...entry,
        payload: { ...entry.payload, call_id: entry.payload.output ? 'foreign' : 'read-1' },
      })),
    ];
    expect(() => matchedReads(entries, target, marker)).toThrow(
      'HOST_CONTRACT_PROOF_UNAVAILABLE: missing/ambiguous correlated tool output',
    );
  });

  it('does not replace missing actual read output with declaration text', () => {
    const entries = [
      declaration(),
      ...readEvidence().map(entry => ({
        ...entry,
        payload: { ...entry.payload, ...(entry.payload.output && { output: 'unrelated' }) },
      })),
    ];
    expect(matchedReads(entries, target, marker)).toEqual([]);
    expect(hasNativeControl(entries)).toBe(false);
  });
});
