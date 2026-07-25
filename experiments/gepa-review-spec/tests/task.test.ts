import { describe, expect, it } from 'vitest';

import { createAnthropicRunner, createOpenAIRunner, createRunnerFromEnv } from '../src/task';

interface ChatBody {
  model: string;
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  reasoning_effort?: string;
  messages: { role: string; content: string }[];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

interface AnthropicBody {
  model: string;
  max_tokens: number;
  temperature?: number;
  thinking: { type: string };
  output_config?: { effort: string };
  messages: { role: string; content: string }[];
}

function anthropicResponse(text: string): Response {
  return new Response(JSON.stringify({ content: [{ type: 'text', text }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** Run `body` with one env var forced to `value` (or unset), then restore it. */
function withEnv(key: string, value: string | undefined, body: () => void): void {
  const prev = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try {
    body();
  } finally {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
}

describe('createOpenAIRunner — GPT-5.6 reasoning-model request invariants', () => {
  it('builds a valid Chat Completions request and parses the detections fence', async () => {
    let captured: ChatBody | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      captured = JSON.parse(String(init?.body)) as ChatBody;
      return jsonResponse({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: '```json\n{"detections":[{"scenarioId":"S1","defectType":"security"}]}\n```',
            },
          },
        ],
      });
    };

    const runner = createOpenAIRunner({ apiKey: 'sk-test', fetchImpl });
    const out = await runner.run('SKILL BODY', 'FEATURE SOURCE');

    // The invariants that would otherwise 400 (temperature / max_tokens) or
    // silently truncate (unbounded reasoning). Pinned so a regression fails HERE,
    // not at scoring time against a paid API.
    expect(captured?.model).toBe('gpt-5.6-sol');
    expect(captured?.temperature).toBeUndefined();
    expect(captured?.max_tokens).toBeUndefined();
    expect(captured?.max_completion_tokens ?? 0).toBeGreaterThan(0);
    expect(captured?.reasoning_effort).toBe('none');
    expect(captured?.messages[0]?.role).toBe('system');
    expect(captured?.messages[0]?.content).toContain('SKILL BODY');
    expect(captured?.messages[1]).toEqual({ role: 'user', content: 'FEATURE SOURCE' });
    expect(out.detections).toEqual([{ scenarioId: 'S1', defectType: 'security' }]);
  });

  it('treats empty / length-truncated output as a run error, not a zero-detection review', async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({ choices: [{ finish_reason: 'length', message: { content: '' } }] });
    const runner = createOpenAIRunner({ apiKey: 'sk-test', fetchImpl });
    // A silent empty review would score the prompt as if it found nothing — worse
    // than a loud failure, because it corrupts the recall number it feeds GEPA.
    await expect(runner.run('p', 'f')).rejects.toThrow(/no parseable output/);
  });

  it('surfaces a non-2xx as an error, never as an empty review', async () => {
    const fetchImpl: typeof fetch = async () => jsonResponse({ error: 'bad' }, 400);
    const runner = createOpenAIRunner({ apiKey: 'sk-test', fetchImpl });
    await expect(runner.run('p', 'f')).rejects.toThrow(/OpenAI API 400/);
  });

  it('throws a clear error when OPENAI_API_KEY is absent', () => {
    withEnv('OPENAI_API_KEY', undefined, () => {
      expect(() => createOpenAIRunner()).toThrow(/OPENAI_API_KEY/);
    });
  });
});

describe('createRunnerFromEnv — one harness, either vendor', () => {
  it('routes to the vendor named by SAFEWORD_EVAL_VENDOR', () => {
    // Only the OpenAI key is present. If the flag were ignored (or openai routed to
    // anthropic), the openai case would throw for a missing ANTHROPIC key — and the
    // default case proves the fallback really is anthropic.
    withEnv('ANTHROPIC_API_KEY', undefined, () => {
      withEnv('OPENAI_API_KEY', 'sk-o', () => {
        withEnv('SAFEWORD_EVAL_VENDOR', 'openai', () => {
          expect(() => createRunnerFromEnv()).not.toThrow();
        });
        withEnv('SAFEWORD_EVAL_VENDOR', undefined, () => {
          expect(() => createRunnerFromEnv()).toThrow(/ANTHROPIC_API_KEY/);
        });
      });
    });
  });
});

describe('effort knob — thinking/reasoning level per vendor', () => {
  it('OpenAI: an effort level passes through to reasoning_effort with a bigger budget', async () => {
    let captured: ChatBody | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      captured = JSON.parse(String(init?.body)) as ChatBody;
      return jsonResponse({
        choices: [
          { finish_reason: 'stop', message: { content: '```json\n{"detections":[]}\n```' } },
        ],
      });
    };
    await createOpenAIRunner({ apiKey: 'k', effort: 'high', fetchImpl }).run('p', 'f');
    expect(captured?.reasoning_effort).toBe('high');
    // Reasoning tokens eat the budget, so thinking-on must get more headroom.
    expect(captured?.max_completion_tokens ?? 0).toBeGreaterThan(8192);
  });

  it('Anthropic: default disables thinking (the prompt-isolating baseline)', async () => {
    let captured: AnthropicBody | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      captured = JSON.parse(String(init?.body)) as AnthropicBody;
      return anthropicResponse('```json\n{"detections":[]}\n```');
    };
    await createAnthropicRunner({ apiKey: 'k', model: 'claude-sonnet-5', fetchImpl }).run('p', 'f');
    expect(captured?.thinking.type).toBe('disabled');
    expect(captured?.output_config).toBeUndefined();
  });

  it('Anthropic: an effort level switches to adaptive thinking at that effort', async () => {
    let captured: AnthropicBody | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      captured = JSON.parse(String(init?.body)) as AnthropicBody;
      return anthropicResponse('```json\n{"detections":[]}\n```');
    };
    await createAnthropicRunner({
      apiKey: 'k',
      model: 'claude-opus-4-8',
      effort: 'high',
      fetchImpl,
    }).run('p', 'f');
    expect(captured?.thinking.type).toBe('adaptive');
    expect(captured?.output_config?.effort).toBe('high');
    expect(captured?.max_tokens).toBeGreaterThan(8192);
  });

  it('Anthropic: Fable is NEVER sent disabled thinking (it 400s) — floors at adaptive-low', async () => {
    let captured: AnthropicBody | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      captured = JSON.parse(String(init?.body)) as AnthropicBody;
      return anthropicResponse('```json\n{"detections":[]}\n```');
    };
    // 'off' on Fable must STILL be adaptive — `disabled` would 400 on every call.
    await createAnthropicRunner({
      apiKey: 'k',
      model: 'claude-fable-5',
      effort: 'off',
      fetchImpl,
    }).run('p', 'f');
    expect(captured?.thinking.type).toBe('adaptive');
    expect(captured?.output_config?.effort).toBe('low');
  });
});
