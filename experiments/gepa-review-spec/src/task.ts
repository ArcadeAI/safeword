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

import { execFileSync } from 'node:child_process';

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
  /**
   * Thinking depth. `off`/undefined disables thinking (except on always-on models
   * like Fable/Mythos); `low`..`max` → adaptive thinking + `output_config.effort`.
   */
  effort?: string;
  /** Test seam — defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

/** Default runner: calls the Anthropic Messages API on Sonnet 5, thinking disabled. */
export function createAnthropicRunner(options: AnthropicRunnerOptions = {}): SkillRunner {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const model = options.model ?? 'claude-sonnet-5';
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!apiKey) {
    throw new Error('createAnthropicRunner: ANTHROPIC_API_KEY is not set');
  }
  // Sonnet 5 rejects `temperature` (400) and runs adaptive thinking when
  // `thinking` is omitted, so both are set explicitly. `effort` off/undefined
  // DISABLES thinking (the prompt-isolating default) — except on Fable/Mythos,
  // which think ALWAYS (`disabled` 400s) and so floor at adaptive-low. Off keeps
  // the lean 8192 budget; thinking-on gets headroom (32000) so reasoning tokens,
  // which count against max_tokens, don't crowd out the JSON and truncate it.
  const alwaysThinking = /fable|mythos/.test(model);
  const off = options.effort === undefined || options.effort === 'off' || options.effort === 'none';
  const thinking =
    off && !alwaysThinking
      ? { thinking: { type: 'disabled' } }
      : { thinking: { type: 'adaptive' }, output_config: { effort: off ? 'low' : options.effort } };
  const maxTokens = options.maxTokens ?? (off && !alwaysThinking ? 8192 : 32000);
  return {
    async run(skillPrompt, featureSource): Promise<RunOutput> {
      const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          ...thinking,
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
  /** Reasoning depth: `off`/undefined → `reasoning_effort:'none'`; `low`..`max` pass through. */
  effort?: string;
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
  const reasoningEffort =
    options.effort === undefined || options.effort === 'off' || options.effort === 'none'
      ? 'none'
      : options.effort;
  // Reasoning tokens count against this budget, so give thinking-on headroom or
  // the JSON truncates; `none` keeps the lean 8192.
  const maxCompletionTokens =
    options.maxCompletionTokens ?? (reasoningEffort === 'none' ? 8192 : 32000);
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
          reasoning_effort: reasoningEffort,
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

export interface HeadlessRunnerOptions {
  /** Pin one model for reproducible scoring. */
  model?: string;
  /** `claude` binary; overridable for a shimmed/pinned install. */
  claudeBin?: string;
  /** Per-call wall clock — the agentic harness is slower than a bare call. */
  timeoutMs?: number;
}

/**
 * TIER-2 runner — drive the candidate skill through the REAL `claude -p` headless
 * harness (full Claude Code system prompt + agentic model), not a bare Messages
 * call. This is the honest ship gate the bare-model proxy can't be: it exposes the
 * candidate to the large-context conditions (context rot / lost-in-the-middle) that
 * only appear once the skill sits inside the full CC system prompt — exactly where
 * a +124% monolith would degrade and a lean skill would not.
 *
 * Fidelity note: the skill is injected via `--append-system-prompt`, not loaded
 * from `.claude/skills/`. That keeps the runner hermetic and symmetric with Tier-1
 * (skill = system, feature = user turn) while still placing the candidate after the
 * full CC system prompt — the context-rot surface we're testing. File tools are
 * disallowed so the model reviews the inline feature instead of hunting a ticket on
 * disk (the skill says "read the active ticket's .feature"; there is none here).
 * Uses local Claude Code auth — no API key / op needed.
 */
export function createHeadlessClaudeRunner(options: HeadlessRunnerOptions = {}): SkillRunner {
  const model = options.model ?? 'claude-sonnet-5';
  const claudeBin = options.claudeBin ?? process.env.SAFEWORD_CLAUDE_BIN ?? 'claude';
  const timeout = options.timeoutMs ?? 300_000;
  return {
    async run(skillPrompt, featureSource): Promise<RunOutput> {
      const system = `${skillPrompt}\n${EVAL_OUTPUT_CONTRACT}`;
      let raw: string;
      try {
        raw = execFileSync(
          claudeBin,
          [
            '-p',
            '--model',
            model,
            '--append-system-prompt',
            system,
            '--disallowedTools',
            'Read,Edit,Write,Bash,Glob,Grep,WebFetch,WebSearch,Task,NotebookEdit',
            '--permission-mode',
            'bypassPermissions',
            featureSource,
          ],
          { encoding: 'utf8', timeout, maxBuffer: 32 * 1024 * 1024 },
        );
      } catch (error) {
        // Surface stdout/stderr the CLI captured before dying, so a truncation or
        // auth failure never scores as a clean empty review.
        const e = error as { message: string; stdout?: string; stderr?: string };
        throw new Error(`claude -p failed: ${e.message}${e.stderr ? ` — ${e.stderr}` : ''}`);
      }
      return { detections: parseDetections(raw), raw };
    },
  };
}

/**
 * Pick the runner from the environment so one harness grades either vendor.
 * `SAFEWORD_EVAL_VENDOR=openai` grades on production's codex engine;
 * `claude-headless` grades through the real `claude -p` harness (Tier-2); anything
 * else (the default) stays on the bare Anthropic API (Tier-1). Model overrides are
 * per-vendor (`SAFEWORD_EVAL_MODEL` / `SAFEWORD_EVAL_OPENAI_MODEL`) so they never collide.
 */
export function createRunnerFromEnv(): SkillRunner {
  const effort = process.env.SAFEWORD_EVAL_EFFORT;
  const vendor = process.env.SAFEWORD_EVAL_VENDOR;
  if (vendor === 'claude-headless') {
    return createHeadlessClaudeRunner({ model: process.env.SAFEWORD_EVAL_MODEL });
  }
  return vendor === 'openai'
    ? createOpenAIRunner({ model: process.env.SAFEWORD_EVAL_OPENAI_MODEL, effort })
    : createAnthropicRunner({ model: process.env.SAFEWORD_EVAL_MODEL, effort });
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
