import type {
  RustSkillMutationAdapter,
  RustSkillMutationProposal,
  RustSkillMutationRequest,
} from './optimize';

export type RustOptimizerProvider = 'anthropic' | 'openai';
export type RustProviderFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface RustModelMutationAdapterOptions {
  apiKey?: string;
  env?: Record<string, string | undefined>;
  fetch?: RustProviderFetch;
  maxTokens?: number;
  model?: string;
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_DEFAULT_MODEL = 'claude-opus-4-8';
const DEFAULT_MAX_TOKENS = 4096;
const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_DEFAULT_MODEL = 'gpt-5.1-codex';

const RUST_SKILL_CANDIDATE_CONTRACT = [
  'You improve Rust coding guidance for coding agents.',
  'Return only a JSON object with string fields skillMarkdown and rationale.',
  'The skillMarkdown field must be a complete Markdown skill with YAML frontmatter.',
  'The frontmatter name must exactly match the requested candidate id.',
  'Write language-general Rust guidance that can transfer across crates and model families.',
  'Do not include benchmark identifiers, corpus identifiers, artifact paths, or hidden evaluation details.',
].join('\n');

const RUST_SKILL_CANDIDATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['skillMarkdown', 'rationale'],
  properties: {
    skillMarkdown: { type: 'string' },
    rationale: { type: 'string' },
  },
};

export function createRustModelMutationAdapter(
  provider: RustOptimizerProvider,
  options: RustModelMutationAdapterOptions = {},
): RustSkillMutationAdapter {
  switch (provider) {
    case 'anthropic':
      return createAnthropicRustSkillMutationAdapter(options);
    case 'openai':
      return createOpenAIRustSkillMutationAdapter(options);
    default: {
      const exhaustive: never = provider;
      throw new Error(`unsupported Rust optimizer provider: ${exhaustive}`);
    }
  }
}

export function createOpenAIRustSkillMutationAdapter(
  options: RustModelMutationAdapterOptions = {},
): RustSkillMutationAdapter {
  const apiKey = requiredApiKey('OPENAI_API_KEY', options);
  const fetchImpl = resolveFetch(options.fetch);
  const model = options.model ?? OPENAI_DEFAULT_MODEL;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  return {
    mutate: async request => {
      const response = await fetchImpl(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          instructions: RUST_SKILL_CANDIDATE_CONTRACT,
          input: buildRustSkillCandidatePrompt(request),
          max_output_tokens: maxTokens,
          store: false,
          text: {
            format: {
              type: 'json_schema',
              name: 'rust_skill_candidate',
              strict: true,
              schema: RUST_SKILL_CANDIDATE_SCHEMA,
            },
          },
        }),
      });

      const payload = await readProviderJson(response, 'OpenAI');
      return parseRustSkillCandidateOutput(extractOpenAIOutputText(payload));
    },
  };
}

export function createAnthropicRustSkillMutationAdapter(
  options: RustModelMutationAdapterOptions = {},
): RustSkillMutationAdapter {
  const apiKey = requiredApiKey('ANTHROPIC_API_KEY', options);
  const fetchImpl = resolveFetch(options.fetch);
  const model = options.model ?? ANTHROPIC_DEFAULT_MODEL;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  return {
    mutate: async request => {
      const response = await fetchImpl(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: RUST_SKILL_CANDIDATE_CONTRACT,
          messages: [
            {
              role: 'user',
              content: buildRustSkillCandidatePrompt(request),
            },
          ],
        }),
      });

      const payload = await readProviderJson(response, 'Anthropic');
      return parseRustSkillCandidateOutput(extractAnthropicOutputText(payload));
    },
  };
}

export function buildRustSkillCandidatePrompt(request: RustSkillMutationRequest): string {
  const sanitize = (value: string): string => sanitizeProviderText(value, request);
  const feedbackSections = request.failedRuns.map((run, index) =>
    [
      `Failure ${index + 1}`,
      `model family: ${run.modelFamily}`,
      `candidate skill id: ${sanitize(run.candidateSkillId)}`,
      `score: ${run.score}`,
      `failure reasons: ${run.failureReasons.map(sanitize).join('; ')}`,
      'feedback:',
      sanitize(run.feedback),
    ].join('\n'),
  );

  return [
    `Create an improved Rust skill named ${sanitize(request.candidateId)}.`,
    '',
    `Current skill description: ${sanitize(request.baseSkill.description)}`,
    '',
    'Current skill text:',
    '```markdown',
    sanitize(request.baseSkill.text),
    '```',
    '',
    `Target model families: ${request.modelFamilies.map(sanitize).join(', ')}`,
    '',
    'Failed-run feedback:',
    feedbackSections.join('\n\n'),
    '',
    'Return JSON with skillMarkdown and rationale.',
    'Keep the guidance Rust-specific, reusable, and independent of the examples above.',
  ].join('\n');
}

function requiredApiKey(
  name: 'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY',
  options: RustModelMutationAdapterOptions,
): string {
  const envValue = options.env === undefined ? process.env[name] : options.env[name];
  const value = options.apiKey ?? envValue;
  if (!value) {
    throw new Error(`${name} is required to use this Rust provider adapter`);
  }
  return value;
}

function resolveFetch(fetchImpl?: RustProviderFetch): RustProviderFetch {
  if (fetchImpl) return fetchImpl;
  if (!globalThis.fetch) {
    throw new Error('global fetch is unavailable; pass a fetch implementation');
  }
  return (url, init) => globalThis.fetch(url, init);
}

function sanitizeProviderText(value: string, request: RustSkillMutationRequest): string {
  let sanitized = value;
  for (const token of providerRedactionTokens(request)) {
    sanitized = replaceAllLiteral(sanitized, token, '[redacted]');
  }

  return sanitized
    .replace(/\b(train|validation|heldout)\b/gi, '[split]')
    .replace(/\b(GEPA|optimizer|mutation)\b/gi, '[evaluation-detail]')
    .replace(/\bsourceArtifact\b/gi, '[artifact-field]');
}

function providerRedactionTokens(request: RustSkillMutationRequest): string[] {
  return [
    request.sourceArtifact,
    ...request.failedRuns.map(run => run.repositoryId),
    ...request.failedRuns.map(run => run.taskId),
  ].filter((token): token is string => token.length > 0);
}

function replaceAllLiteral(value: string, search: string, replacement: string): string {
  return value.split(search).join(replacement);
}

async function readProviderJson(
  response: Response,
  providerName: 'Anthropic' | 'OpenAI',
): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`${providerName} API ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as unknown;
}

function extractOpenAIOutputText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    throw new Error('OpenAI API response did not include a JSON object');
  }
  const candidate = payload as { output?: unknown; output_text?: unknown };
  if (typeof candidate.output_text === 'string') {
    return candidate.output_text;
  }

  const fragments = collectOpenAIOutputFragments(candidate.output);
  if (fragments.length === 0) {
    throw new Error('OpenAI API response did not include output text');
  }
  return fragments.join('\n');
}

function collectOpenAIOutputFragments(output: unknown): string[] {
  if (!Array.isArray(output)) return [];
  return output.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const outputItem = item as { content?: unknown; text?: unknown };
    return [
      ...(typeof outputItem.text === 'string' ? [outputItem.text] : []),
      ...collectTextContentFragments(outputItem.content),
    ];
  });
}

function collectTextContentFragments(content: unknown): string[] {
  if (!Array.isArray(content)) return [];
  return content.flatMap(contentItem => {
    if (!contentItem || typeof contentItem !== 'object') return [];
    const item = contentItem as { text?: unknown };
    return typeof item.text === 'string' ? [item.text] : [];
  });
}

function extractAnthropicOutputText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Anthropic API response did not include a JSON object');
  }
  const candidate = payload as { content?: unknown };
  if (!Array.isArray(candidate.content)) {
    throw new Error('Anthropic API response did not include content blocks');
  }

  const fragments = candidate.content.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const content = item as { text?: unknown };
    return typeof content.text === 'string' ? [content.text] : [];
  });
  if (fragments.length === 0) {
    throw new Error('Anthropic API response did not include text content');
  }
  return fragments.join('\n');
}

function parseRustSkillCandidateOutput(text: string): RustSkillMutationProposal {
  const normalized = stripJsonFence(text.trim());
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized) as unknown;
  } catch (error) {
    throw new Error(
      `provider returned invalid Rust skill candidate JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('provider returned a non-object Rust skill candidate');
  }
  const candidate = parsed as { rationale?: unknown; skillMarkdown?: unknown };
  if (typeof candidate.skillMarkdown !== 'string' || candidate.skillMarkdown.trim() === '') {
    throw new Error('provider Rust skill candidate is missing skillMarkdown');
  }
  if (typeof candidate.rationale !== 'string' || candidate.rationale.trim() === '') {
    throw new Error('provider Rust skill candidate is missing rationale');
  }
  return {
    skillMarkdown: candidate.skillMarkdown,
    rationale: candidate.rationale,
  };
}

function stripJsonFence(text: string): string {
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  return match ? match[1].trim() : text;
}
