/**
 * TASK seam — run the review-spec skill (a candidate prompt) over a feature file.
 *
 * Runners (all satisfy SkillRunner):
 *  - `createAnthropicRunner` / `createOpenAIRunner` — real model calls, one per
 *    vendor, symmetric so each isolates the PROMPT, not a vendor's CLI harness.
 *  - `createRunnerFromEnv` — picks the vendor from `SAFEWORD_EVAL_VENDOR`.
 *  - `fakeRunner` — scripted detections for deterministic unit tests.
 *
 * The eval output contract below is appended to the candidate prompt at eval
 * time ONLY. It never edits the shipped SKILL.md — it just coerces the skill's
 * free-form findings into a machine-readable block so the metric can stay
 * deterministic instead of leaning on an LLM judge.
 */

import type { Detection, RunOutput, SkillRunner } from './types';
import { DEFECT_TYPES } from './types';

export const EVAL_OUTPUT_CONTRACT = `
---
EVAL OUTPUT CONTRACT (appended by the harness; not part of the skill)

After your normal review, append a single fenced JSON block describing every
defect you found, so it can be scored automatically. Key each finding by the
EXACT \`Scenario:\` name it applies to (use the scenario name verbatim). For a
set-level finding that is not tied to one scenario (e.g. a missing rejection
path or a cross-scenario conflict), set "scenarioId" to "*".

Use only these defectType values:
${DEFECT_TYPES.map(t => `  - ${t}`).join('\n')}

Format (and nothing after it):

\`\`\`json
{ "detections": [ { "scenarioId": "<scenario name or *>", "defectType": "<one of the above>" } ] }
\`\`\`
`;

const VALID = new Set<string>(DEFECT_TYPES);

/** Extract and validate the detections JSON block from raw model text. */
export function parseDetections(raw: string): Detection[] {
  const fence = raw.match(/```json\s*([\s\S]*?)```/gi);
  const blocks = fence ?? [];
  const last = blocks.length > 0 ? blocks[blocks.length - 1] : undefined;
  const jsonText = last ? last.replace(/```json\s*/i, '').replace(/```$/, '') : raw;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText.trim());
  } catch {
    return [];
  }
  const detections = (parsed as { detections?: unknown }).detections;
  if (!Array.isArray(detections)) return [];
  return detections
    .filter(
      (d): d is Detection =>
        typeof d === 'object' &&
        d !== null &&
        typeof (d as Detection).scenarioId === 'string' &&
        VALID.has((d as Detection).defectType),
    )
    .map(d => ({ scenarioId: d.scenarioId, defectType: d.defectType }));
}

export interface AnthropicRunnerOptions {
  apiKey?: string;
  /** Pin one model for reproducible scoring. */
  model?: string;
  maxTokens?: number;
}

/** Default runner: calls the Anthropic Messages API on Sonnet 5, thinking disabled. */
export function createAnthropicRunner(options: AnthropicRunnerOptions = {}): SkillRunner {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const model = options.model ?? 'claude-sonnet-5';
  // Bumped from 4096: Sonnet 5's tokenizer runs ~30% larger, so the review JSON
  // needs headroom or it can truncate mid-object and fail to parse.
  const maxTokens = options.maxTokens ?? 8192;
  if (!apiKey) {
    throw new Error('createAnthropicRunner: ANTHROPIC_API_KEY is not set');
  }
  return {
    async run(skillPrompt, featureSource): Promise<RunOutput> {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          // Sonnet 5 rejects `temperature` (400) and turns adaptive thinking ON
          // when `thinking` is omitted (4.6 ran without it). Disable it so the
          // model is the ONLY changed variable vs. the 4.6 baseline this harness
          // was tuned against — a scoring instrument must move one knob at a time.
          thinking: { type: 'disabled' },
          system: `${skillPrompt}\n${EVAL_OUTPUT_CONTRACT}`,
          messages: [{ role: 'user', content: featureSource }],
        }),
      });
      if (!res.ok) {
        throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as { content: { type: string; text?: string }[] };
      const raw = data.content.map(b => b.text ?? '').join('');
      return { detections: parseDetections(raw), raw };
    },
  };
}

export interface OpenAIRunnerOptions {
  apiKey?: string;
  /** Pin one model for reproducible scoring. Defaults to production's codex model. */
  model?: string;
  maxCompletionTokens?: number;
  /** Test seam — defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Runner for the OpenAI engine — the model production's codex reviewer uses.
 * Symmetric with createAnthropicRunner: a bare Chat Completions call, prompt as
 * system and feature as user, so BOTH vendor paths isolate the PROMPT rather than
 * a vendor's CLI harness.
 *
 * GPT-5.6 reasoning-model request invariants (verified 2026-07, GA 2026-07-09):
 *  - `max_completion_tokens`, never `max_tokens` (deprecated → silently dropped).
 *  - NO `temperature`: GPT-5 reasoning models reject any non-default value (400).
 *  - `reasoning_effort: 'none'` mirrors the Anthropic side's disabled thinking, so
 *    the prompt does the defect-finding, and Sol can't spend the whole token
 *    budget on hidden reasoning and truncate the JSON. Chat Completions, not
 *    Responses: the eval uses no function tools.
 */
export function createOpenAIRunner(options: OpenAIRunnerOptions = {}): SkillRunner {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const model = options.model ?? 'gpt-5.6-sol';
  const maxCompletionTokens = options.maxCompletionTokens ?? 8192;
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!apiKey) {
    throw new Error('createOpenAIRunner: OPENAI_API_KEY is not set');
  }
  return {
    async run(skillPrompt, featureSource): Promise<RunOutput> {
      const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_completion_tokens: maxCompletionTokens,
          reasoning_effort: 'none',
          messages: [
            { role: 'system', content: `${skillPrompt}\n${EVAL_OUTPUT_CONTRACT}` },
            { role: 'user', content: featureSource },
          ],
        }),
      });
      if (!res.ok) {
        throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string }; finish_reason?: string }[];
      };
      const choice = data.choices?.[0];
      const raw = choice?.message?.content ?? '';
      // Empty content or a `length` finish means the call ran out of budget, not
      // that the prompt found nothing — surface it so a truncation never scores as
      // a clean, empty review.
      if (raw.trim() === '' || choice?.finish_reason === 'length') {
        throw new Error(
          `createOpenAIRunner: no parseable output (finish_reason=${choice?.finish_reason ?? 'unknown'})`,
        );
      }
      return { detections: parseDetections(raw), raw };
    },
  };
}

/**
 * Pick the runner from the environment so one harness grades either vendor.
 * `SAFEWORD_EVAL_VENDOR=openai` grades on production's codex engine; anything else
 * (the default) stays on Anthropic. Model overrides are per-vendor
 * (`SAFEWORD_EVAL_MODEL` / `SAFEWORD_EVAL_OPENAI_MODEL`) so they never collide.
 */
export function createRunnerFromEnv(): SkillRunner {
  return process.env.SAFEWORD_EVAL_VENDOR === 'openai'
    ? createOpenAIRunner({ model: process.env.SAFEWORD_EVAL_OPENAI_MODEL })
    : createAnthropicRunner({ model: process.env.SAFEWORD_EVAL_MODEL });
}

/**
 * Test runner: returns scripted detections. The impl receives the same args as
 * a real runner, so tests can branch on the candidate prompt or feature source.
 */
export function fakeRunner(
  impl: (skillPrompt: string, featureSource: string) => Detection[],
): SkillRunner {
  return {
    run: async (skillPrompt, featureSource) => ({ detections: impl(skillPrompt, featureSource) }),
  };
}
