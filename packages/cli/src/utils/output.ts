/**
 * Console output utilities for consistent CLI messaging
 */

/**
 * Print info message
 * @param message
 */
export function info(message: string): void {
  console.log(message);
}

/**
 * Compose a glyph-prefixed line, hoisting any leading newlines ABOVE the glyph
 * so blank-line spacing renders before the marker instead of orphaning it on
 * its own line (ticket 469YSR). `('✓', '\nFoo')` → `'\n✓ Foo'`.
 * @param glyph   the status glyph (✓ / ⚠ / ✗)
 * @param message the message, which may start with newline(s) for spacing
 */
export function formatGlyphLine(glyph: string, message: string): string {
  const leadingNewlines = /^\n*/.exec(message)?.[0] ?? '';
  return `${leadingNewlines}${glyph} ${message.slice(leadingNewlines.length)}`;
}

/**
 * Print success message
 * @param message
 */
export function success(message: string): void {
  console.log(formatGlyphLine('✓', message));
}

/**
 * Print warning message
 * @param message
 */
export function warn(message: string): void {
  console.warn(formatGlyphLine('⚠', message));
}

/**
 * Print error message to stderr
 * @param message
 */
export function error(message: string): void {
  console.error(formatGlyphLine('✗', message));
}

/**
 * Print a section header
 * @param title
 */
export function header(title: string): void {
  console.log(`\n${title}`);
  console.log('─'.repeat(title.length));
}

/**
 * Print a list item
 * @param item
 * @param indent
 */
export function listItem(item: string, indent = 2): void {
  console.log(`${' '.repeat(indent)}• ${item}`);
}

/**
 * Print key-value pair
 * @param key
 * @param value
 */
export function keyValue(key: string, value: string): void {
  console.log(`  ${key}: ${value}`);
}
