import { ReviewPacketError } from './packet-error.js';

const HIGH_CONFIDENCE_SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/u,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/u,
  /\bsk-(?:proj-|ant-)[\w-]{16,}\b/u,
  /\bAIza[\w-]{35}\b/u,
] as const;

/** Apply the same disclosure boundary to full files, baselines and displayed patches. */
export function decodeReviewText(bytes: Buffer, target: string): string {
  let content: string;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ReviewPacketError(
      `Review target is not valid UTF-8 text: ${target}`,
      'REVIEW_TARGET_INVALID_TEXT',
    );
  }
  if (HIGH_CONFIDENCE_SECRET_PATTERNS.some(pattern => pattern.test(content))) {
    throw new Error(
      `Review packet rejected a high-confidence credential in ${target}; redact it before dispatch`,
    );
  }
  return content;
}
