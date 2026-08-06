import type { ModelFinding, OpenAIReviewOptions } from '../pr-review/providers/openai.js';
import type { PublishedReceipt } from '../pr-review/review.js';

export interface InspectPullRequestCommandOptions {
  cwd: string;
  inputPath: string;
  outputPath: string;
  provider(options: OpenAIReviewOptions): Promise<ModelFinding[]>;
}

export function inspectPullRequestCommand(
  _options: InspectPullRequestCommandOptions,
): Promise<PublishedReceipt> {
  throw new Error('Not implemented');
}
