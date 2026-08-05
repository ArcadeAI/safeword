export interface ModelFinding {
  consequential: boolean;
  consequence: string;
  path: string;
}

export interface OpenAIReviewOptions {
  apiKey: string;
  evidence: { content: string; path: string }[];
  fetchImplementation?: typeof fetch;
  model: string;
}

export async function reviewWithOpenAI(options: OpenAIReviewOptions): Promise<ModelFinding[]> {
  await Promise.resolve(options);
  throw new Error('OpenAI advisory reviewer is not implemented');
}
