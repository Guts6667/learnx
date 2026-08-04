import type { ComponentChildren } from 'preact';

import { classNames } from '@/components/ui/classNames';

interface SafeMarkdownProps {
  class?: string;
  content: string;
}

type MarkdownBlock =
  | { content: string; level: number; type: 'heading' }
  | { content: string; type: 'paragraph' }
  | { items: string[]; start: number; type: 'ordered-list' }
  | { items: string[]; type: 'unordered-list' };

const blockPattern = /^(#{1,3})\s+|^\d+\.\s+|^[-+*]\s+/;
const inlinePattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\([^)\n]+\))/g;

export function getSafeLink(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function parseBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trim() ?? '';
    if (!line) {
      index += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({
        content: heading[2] ?? '',
        level: heading[1]?.length ?? 1,
        type: 'heading',
      });
      index += 1;
      continue;
    }

    const ordered = /^(\d+)\.\s+(.+)$/.exec(line);
    if (ordered) {
      const items: string[] = [];
      const start = Number(ordered[1]);
      while (index < lines.length) {
        const item = /^\d+\.\s+(.+)$/.exec(lines[index]?.trim() ?? '');
        if (!item) break;
        items.push(item[1] ?? '');
        index += 1;
      }
      blocks.push({ items, start, type: 'ordered-list' });
      continue;
    }

    const unordered = /^[-+*]\s+(.+)$/.exec(line);
    if (unordered) {
      const items: string[] = [];
      while (index < lines.length) {
        const item = /^[-+*]\s+(.+)$/.exec(lines[index]?.trim() ?? '');
        if (!item) break;
        items.push(item[1] ?? '');
        index += 1;
      }
      blocks.push({ items, type: 'unordered-list' });
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index]?.trim() ?? '';
      if (!next || blockPattern.test(next)) break;
      paragraph.push(next);
      index += 1;
    }
    blocks.push({ content: paragraph.join(' '), type: 'paragraph' });
  }

  return blocks;
}

function renderInline(content: string): ComponentChildren[] {
  const children: ComponentChildren[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(inlinePattern)) {
    const value = match[0];
    const index = match.index;
    if (index > lastIndex) children.push(content.slice(lastIndex, index));

    if (value.startsWith('**')) {
      children.push(
        <strong key={`${index}-strong`}>{value.slice(2, -2)}</strong>,
      );
    } else if (value.startsWith('*')) {
      children.push(<em key={`${index}-emphasis`}>{value.slice(1, -1)}</em>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(value);
      const href = link ? getSafeLink(link[2] ?? '') : null;
      const label = link?.[1] ?? value;
      children.push(
        href ? (
          <a
            href={href}
            key={`${index}-link`}
            rel="noreferrer noopener"
            target="_blank"
          >
            {label}
            <span class="sr-only"> (nouvel onglet)</span>
          </a>
        ) : (
          <span key={`${index}-unsafe-link`}>{label}</span>
        ),
      );
    }
    lastIndex = index + value.length;
  }

  if (lastIndex < content.length) children.push(content.slice(lastIndex));
  return children;
}

function MarkdownHeading({
  content,
  level,
}: {
  content: string;
  level: number;
}) {
  const children = renderInline(content);
  if (level === 1) return <h2>{children}</h2>;
  if (level === 2) return <h3>{children}</h3>;
  return <h4>{children}</h4>;
}

export function SafeMarkdown({ class: className, content }: SafeMarkdownProps) {
  const blocks = parseBlocks(content);

  return (
    <div class={classNames('ui-prose', className)}>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <MarkdownHeading
              content={block.content}
              key={`heading-${index}`}
              level={block.level}
            />
          );
        }
        if (block.type === 'ordered-list') {
          return (
            <ol key={`ordered-${index}`} start={block.start}>
              {block.items.map((item, itemIndex) => (
                <li key={`${itemIndex}-${item}`}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }
        if (block.type === 'unordered-list') {
          return (
            <ul key={`unordered-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${itemIndex}-${item}`}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        return <p key={`paragraph-${index}`}>{renderInline(block.content)}</p>;
      })}
    </div>
  );
}
