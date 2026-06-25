/**
 * TASK seam — run the review-spec skill (a candidate prompt) over a feature file.
 *
 * Two implementations:
 *  - `createAnthropicRunner` — real model call (Phase 3 baseline + GEPA loop).
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

/** Default runner: calls the Anthropic Messages API at temperature 0. */
export function createAnthropicRunner(options: AnthropicRunnerOptions = {}): SkillRunner {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const model = options.model ?? 'claude-sonnet-4-6';
  const maxTokens = options.maxTokens ?? 4096;
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
          temperature: 0,
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
