// Safeword: shared Markdown projection helpers for hook validators.

export function stripHtmlComments(content: string): string {
  return content.replaceAll(/<!--[\s\S]*?-->/g, comment => comment.replaceAll(/[^\r\n]/g, ''));
}

export function withoutFencedCode(content: string, preserveHtmlComments = false): string {
  const lines = content.split(/\r?\n/);
  let fence: { kind: '`' | '~'; length: number } | undefined;
  let htmlComment = false;
  const projected = lines
    .map(line => {
      if (fence !== undefined) {
        const closing = new RegExp(`^\\s{0,3}${fence.kind}{${fence.length},}\\s*$`);
        if (closing.test(line)) fence = undefined;
        return '';
      }

      if (htmlComment) {
        if (line.includes('-->')) htmlComment = false;
        return preserveHtmlComments ? line : '';
      }

      const opening = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (!opening) {
        const commentStart = line.indexOf('<!--');
        if (commentStart !== -1 && line.indexOf('-->', commentStart + 4) === -1) {
          htmlComment = true;
          return preserveHtmlComments ? line : line.slice(0, commentStart);
        }
        return line;
      }

      const run = opening[1]!;
      const kind = run[0] as '`' | '~';
      const info = opening[2] ?? '';
      // GFM/CommonMark does not permit backticks in a backtick-fence info string.
      if (kind === '`' && info.includes('`')) return line;
      fence = { kind, length: run.length };
      return '';
    })
    .join('\n');
  return preserveHtmlComments ? projected : stripHtmlComments(projected);
}
