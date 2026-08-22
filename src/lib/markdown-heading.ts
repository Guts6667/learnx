export function toPlainMarkdownHeading(value: string): string {
  return value
    .replace(/[ \t]+#+[ \t]*$/, '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findFirstMarkdownHeading(markdown: string): string | null {
  let fenceCharacter: '`' | '~' | null = null;
  let fenceLength = 0;

  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const fence = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      const marker = fence[1] ?? '';
      const character = marker[0] as '`' | '~';
      if (fenceCharacter === null) {
        fenceCharacter = character;
        fenceLength = marker.length;
      } else if (character === fenceCharacter && marker.length >= fenceLength) {
        fenceCharacter = null;
        fenceLength = 0;
      }
      continue;
    }
    if (fenceCharacter !== null) continue;

    const heading = /^ {0,3}#{1,6}(?:[ \t]+|$)(.*)$/.exec(line);
    const title = heading?.[1] ? toPlainMarkdownHeading(heading[1]) : '';
    if (title) return title;
  }

  return null;
}
