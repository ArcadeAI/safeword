import {
  createAnthropicRustSkillMutationAdapter,
  createOpenAIRustSkillMutationAdapter,
} from '../src/model-adapters';
import type { RustSkillMutationRequest } from '../src/optimize';

const candidateSkillText = (
  name: string,
  body = 'Use Rust compiler diagnostics to guide small, local fixes.',
): string =>
  [
    '---',
    `name: ${name}`,
    'description: Candidate Rust guidance for general code changes.',
    '---',
    '',
    '# Rust',
    '',
    body,
    '',
  ].join('\n');

describe('Rust model mutation adapters', () => {
  it('calls the OpenAI Responses API with sanitized feedback and parses JSON output', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const adapter = createOpenAIRustSkillMutationAdapter({
      env: { OPENAI_API_KEY: 'sk-test' },
      fetch: async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              skillMarkdown: candidateSkillText('optimized-rust-v5'),
              rationale: 'Preserve Rust-specific debugging guidance.',
            }),
          }),
          { status: 200 },
        );
      },
    });

    const result = await adapter.mutate(providerRequest('optimized-rust-v5'));

    expect(result).toEqual({
      skillMarkdown: candidateSkillText('optimized-rust-v5'),
      rationale: 'Preserve Rust-specific debugging guidance.',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.openai.com/v1/responses');
    expect(calls[0].init.headers).toMatchObject({
      authorization: 'Bearer sk-test',
      'content-type': 'application/json',
    });

    const body = JSON.parse(String(calls[0].init.body)) as {
      input: string;
      instructions: string;
      model: string;
      store: boolean;
      text: { format: { type: string; name: string } };
    };
    expect(body.model).toBe('gpt-5.3-codex');
    expect(body.store).toBe(false);
    expect(body.text.format).toMatchObject({
      type: 'json_schema',
      name: 'rust_skill_candidate',
    });
    expect(body.input).toContain('Use Rust borrow checker feedback first.');
    expect(body.input).toContain('cargo test --locked failed with exit 1');
    expect(`${body.instructions}\n${body.input}`).not.toMatch(
      /\b(sharkdp\/fd|fd-cli-filesystem-bugfix|sourceArtifact|train|validation|heldout|GEPA|optimizer|mutation)\b/i,
    );
  });

  it('parses nested OpenAI output text blocks', async () => {
    const adapter = createOpenAIRustSkillMutationAdapter({
      env: { OPENAI_API_KEY: 'sk-test' },
      fetch: async () =>
        new Response(
          JSON.stringify({
            output: [
              {
                content: [
                  {
                    type: 'output_text',
                    text: JSON.stringify({
                      skillMarkdown: candidateSkillText('optimized-rust-v5'),
                      rationale: 'Parsed from nested output blocks.',
                    }),
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        ),
    });

    await expect(adapter.mutate(providerRequest('optimized-rust-v5'))).resolves.toEqual({
      skillMarkdown: candidateSkillText('optimized-rust-v5'),
      rationale: 'Parsed from nested output blocks.',
    });
  });

  it('calls the Anthropic Messages API with sanitized feedback and parses fenced JSON output', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const adapter = createAnthropicRustSkillMutationAdapter({
      env: { ANTHROPIC_API_KEY: 'sk-ant-test' },
      fetch: async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response(
          JSON.stringify({
            content: [
              {
                type: 'text',
                text: [
                  '```json',
                  JSON.stringify({
                    skillMarkdown: candidateSkillText('optimized-rust-v6'),
                    rationale: 'Keep the guidance general across Rust crates.',
                  }),
                  '```',
                ].join('\n'),
              },
            ],
          }),
          { status: 200 },
        );
      },
    });

    const result = await adapter.mutate(providerRequest('optimized-rust-v6'));

    expect(result).toEqual({
      skillMarkdown: candidateSkillText('optimized-rust-v6'),
      rationale: 'Keep the guidance general across Rust crates.',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages');
    expect(calls[0].init.headers).toMatchObject({
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'x-api-key': 'sk-ant-test',
    });

    const body = JSON.parse(String(calls[0].init.body)) as {
      max_tokens: number;
      messages: Array<{ role: string; content: string }>;
      model: string;
      system: string;
      temperature?: number;
    };
    expect(body.model).toBe('claude-opus-4-8');
    expect(body.max_tokens).toBeGreaterThan(0);
    expect(body).not.toHaveProperty('temperature');
    expect(body.messages).toEqual([
      expect.objectContaining({
        role: 'user',
        content: expect.stringContaining('Use Rust borrow checker feedback first.'),
      }),
    ]);
    expect(`${body.system}\n${body.messages[0].content}`).not.toMatch(
      /\b(sharkdp\/fd|fd-cli-filesystem-bugfix|sourceArtifact|train|validation|heldout|GEPA|optimizer|mutation)\b/i,
    );
  });

  it('requires provider API keys before creating adapters', () => {
    expect(() => createOpenAIRustSkillMutationAdapter({ env: {} })).toThrow(/OPENAI_API_KEY/);
    expect(() => createAnthropicRustSkillMutationAdapter({ env: {} })).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('reports provider HTTP failures with response details', async () => {
    const adapter = createOpenAIRustSkillMutationAdapter({
      env: { OPENAI_API_KEY: 'sk-test' },
      fetch: async () => new Response('rate limited', { status: 429 }),
    });

    await expect(adapter.mutate(providerRequest('optimized-rust-v7'))).rejects.toThrow(
      'OpenAI API 429: rate limited',
    );
  });
});

function providerRequest(candidateId: string): RustSkillMutationRequest {
  return {
    candidateId,
    baseSkill: {
      id: 'human-seed-rust',
      path: '/tmp/SKILL.md',
      description: 'Rust coding guidance for general code changes.',
      body: [
        '# Rust',
        '',
        'Use Rust borrow checker feedback first.',
        'Prefer minimal, local fixes and verify with the crate test command.',
      ].join('\n'),
      text: [
        '---',
        'name: human-seed-rust',
        'description: Rust coding guidance for general code changes.',
        '---',
        '',
        '# Rust',
        '',
        'Use Rust borrow checker feedback first.',
        '',
      ].join('\n'),
    },
    failedRuns: [
      {
        taskId: 'fd-cli-filesystem-bugfix',
        repositoryId: 'sharkdp/fd',
        modelFamily: 'gpt-codex',
        candidateSkillId: 'human-seed-rust',
        score: 0,
        failureReasons: ['required oracle failed: cargo test --locked'],
        feedback: [
          'cargo test --locked failed with exit 1',
          'borrow checker diagnostic pointed at a moved path value',
        ].join('\n'),
      },
    ],
    modelFamilies: ['gpt-codex'],
    sourceArtifact: '/tmp/artifacts/train-rust-runs.jsonl',
  };
}
