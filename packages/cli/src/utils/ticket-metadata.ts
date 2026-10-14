import { type Document, isAlias, isScalar, parseDocument } from 'yaml';

/** Decode ticket YAML while preserving opaque IDs that resemble numeric scalars. */
export function parseTicketMetadata(content: string): {
  metadata: Record<string, unknown>;
  body: string;
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(content);
  if (match === null) throw new Error('Planning context ticket has no YAML metadata.');
  const document = parseDocument(match[1] ?? '', { uniqueKeys: true });
  if (document.errors.length > 0)
    throw new Error('Planning context ticket has invalid YAML metadata.');
  const value: unknown = document.toJS();
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Planning context ticket metadata must be a mapping.');
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Planning context ticket metadata must be a mapping.');
  }
  const metadata = { ...(value as Record<string, unknown>), ...opaqueTicketIdentifiers(document) };
  return { metadata, body: content.slice(match[0].length) };
}

function opaqueTicketIdentifiers(document: Document): Record<string, string> {
  const identifiers: Record<string, string> = {};
  for (const field of ['id', 'parent']) {
    const node = document.get(field, true);
    const scalar = isAlias(node) ? node.resolve(document) : node;
    if (isScalar(scalar) && typeof scalar.value === 'number' && scalar.source !== undefined) {
      identifiers[field] = scalar.source;
    }
  }
  return identifiers;
}
