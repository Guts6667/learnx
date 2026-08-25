import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

import { classNames } from '@/components/ui/classNames';
import { useI18n } from '@/i18n';
import { toPlainMarkdownHeading } from '@/lib/markdown-heading';

type HeadingStartLevel = 2 | 3 | 4;

interface SafeMarkdownProps {
  class?: string;
  content: string;
  headingStartLevel?: HeadingStartLevel;
  omitFirstHeadingWhenEqual?: string;
}

interface MarkdownImage {
  alt: string;
  source: string;
  title: string | null;
}

type MarkdownBlock =
  | {
      content: string;
      focusLines: number[];
      language: string | null;
      path: string | null;
      type: 'code';
    }
  | { content: string; level: number; type: 'heading' }
  | { image: MarkdownImage; type: 'image' }
  | { content: string; type: 'paragraph' }
  | { items: string[]; start: number; type: 'ordered-list' }
  | { headers: string[]; rows: string[][]; type: 'table' }
  | { items: string[]; type: 'unordered-list' };

const headingPattern = /^(#{1,3})\s+(.+)$/;
const orderedListPattern = /^(\d+)\.\s+(.+)$/;
const unorderedListPattern = /^[-+*]\s+(.+)$/;
const codeFencePattern = /^```([a-zA-Z0-9_+#.-]*)(?:\s+(.+?))?\s*$/;
const markdownImagePattern =
  /^!\[([^\]\n]*)\]\(([^\s)\n]+)(?:\s+"([^"\n]*)")?\)$/;
const tableRowPattern = /^\|(.+)\|$/;
const inlinePattern =
  /(`[^`\n]+`|!\[[^\]\n]*\]\([^\s)\n]+(?:\s+"[^"\n]*")?\)|\[[^\]\n]+\]\([^)\n]+\)|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
const localImageOrigin = 'https://learnx.local';

interface CodeFenceMetadata {
  focusLines: number[];
  path: string | null;
}

function parseFocusLines(value: string | undefined): number[] {
  if (!value) return [];
  const lines = new Set<number>();
  for (const range of value.split(',')) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(range);
    if (!match) continue;
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end - start > 20) continue;
    for (let line = start; line <= end; line += 1) lines.add(line);
  }
  return [...lines].sort((left, right) => left - right);
}

function parseCodeFenceMetadata(value: string | undefined): CodeFenceMetadata {
  if (!value) return { focusLines: [], path: null };
  const path = /(?:^|\s)path=([^\s]+)/.exec(value)?.[1] ?? null;
  const focus = /(?:^|\s)focus=([^\s]+)/.exec(value)?.[1];
  return { focusLines: parseFocusLines(focus), path };
}

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

function decodeImagePath(pathname: string): string | null {
  let decoded = pathname;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return null;
    }
    if (next === decoded) return decoded;
    decoded = next;
  }
  return null;
}

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

export function getSafeImageSource(value: string): string | null {
  const candidate = value.trim();
  if (
    !candidate.startsWith('/learning/') ||
    candidate.includes('\\') ||
    containsControlCharacter(candidate)
  ) {
    return null;
  }

  try {
    const url = new URL(candidate, localImageOrigin);
    const decodedPath = decodeImagePath(url.pathname);
    if (
      url.origin !== localImageOrigin ||
      !url.pathname.startsWith('/learning/') ||
      !decodedPath?.startsWith('/learning/') ||
      containsControlCharacter(decodedPath) ||
      decodedPath.includes('\\') ||
      decodedPath.split('/').some((segment) => ['.', '..'].includes(segment))
    ) {
      return null;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function parseMarkdownImage(value: string): MarkdownImage | null {
  const match = markdownImagePattern.exec(value);
  if (!match) return null;
  return {
    alt: match[1] ?? '',
    source: match[2] ?? '',
    title: match[3] ?? null,
  };
}

function parseTableRow(value: string): string[] | null {
  const match = tableRowPattern.exec(value.trim());
  return match?.[1]?.split('|').map((cell) => cell.trim()) ?? null;
}

function isTableStart(lines: string[], index: number): boolean {
  const headers = parseTableRow(lines[index] ?? '');
  const delimiter = parseTableRow(lines[index + 1] ?? '');
  return Boolean(
    headers?.length &&
    delimiter?.length === headers.length &&
    delimiter.every((cell) => /^:?-{3,}:?$/.test(cell)),
  );
}

function isBlockStart(line: string): boolean {
  return (
    headingPattern.test(line) ||
    orderedListPattern.test(line) ||
    unorderedListPattern.test(line) ||
    codeFencePattern.test(line) ||
    parseMarkdownImage(line) !== null
  );
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

    const codeFence = codeFencePattern.exec(line);
    if (codeFence) {
      const code: string[] = [];
      const metadata = parseCodeFenceMetadata(codeFence[2]);
      index += 1;
      while (index < lines.length && lines[index]?.trim() !== '```') {
        code.push(lines[index] ?? '');
        index += 1;
      }
      if (lines[index]?.trim() === '```') index += 1;
      blocks.push({
        content: code.join('\n'),
        focusLines: metadata.focusLines,
        language: codeFence[1]?.toLowerCase() || null,
        path: metadata.path,
        type: 'code',
      });
      continue;
    }

    const image = parseMarkdownImage(line);
    if (image) {
      blocks.push({ image, type: 'image' });
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const headers = parseTableRow(line) ?? [];
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length) {
        const row = parseTableRow(lines[index] ?? '');
        if (!row || row.length !== headers.length) break;
        rows.push(row);
        index += 1;
      }
      blocks.push({ headers, rows, type: 'table' });
      continue;
    }

    const heading = headingPattern.exec(line);
    if (heading) {
      blocks.push({
        content: heading[2] ?? '',
        level: heading[1]?.length ?? 1,
        type: 'heading',
      });
      index += 1;
      continue;
    }

    const ordered = orderedListPattern.exec(line);
    if (ordered) {
      const items: string[] = [];
      const start = Number(ordered[1]);
      while (index < lines.length) {
        const item = orderedListPattern.exec(lines[index]?.trim() ?? '');
        if (!item) break;
        items.push(item[2] ?? '');
        index += 1;
      }
      blocks.push({ items, start, type: 'ordered-list' });
      continue;
    }

    const unordered = unorderedListPattern.exec(line);
    if (unordered) {
      const items: string[] = [];
      while (index < lines.length) {
        const item = unorderedListPattern.exec(lines[index]?.trim() ?? '');
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
      if (!next || isBlockStart(next) || isTableStart(lines, index)) break;
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

    if (value.startsWith('`')) {
      children.push(
        <code class="ui-inline-code" key={`${index}-code`}>
          {value.slice(1, -1)}
        </code>,
      );
    } else if (value.startsWith('![')) {
      const image = parseMarkdownImage(value);
      const source = image ? getSafeImageSource(image.source) : null;
      children.push(
        image && source ? (
          <img
            alt={image.alt}
            class="ui-markdown-image ui-markdown-image--inline"
            decoding="async"
            key={`${index}-image`}
            loading="lazy"
            src={source}
            title={image.title ?? undefined}
          />
        ) : (
          <span class="ui-image-fallback" key={`${index}-image-fallback`}>
            {image?.alt ?? value}
          </span>
        ),
      );
    } else if (value.startsWith('**')) {
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

function MarkdownCodeBlock({
  content,
  focusLines,
  language,
  path,
}: {
  content: string;
  focusLines: number[];
  language: string | null;
  path: string | null;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const lines = content.split('\n');
  const outputLanguages = new Set(['console', 'http', 'log', 'output', 'text']);
  const isOutput = language ? outputLanguages.has(language) : false;
  const label = isOutput ? t('markdown.output') : t('markdown.code');

  async function copyCode() {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard permissions vary by browser; code remains selectable.
    }
  }

  return (
    <div
      aria-label={language ? `${label} — ${language}` : label}
      class={classNames('ui-code-block', isOutput && 'ui-code-block--output')}
      role="region"
      tabIndex={0}
    >
      <div class="ui-code-block__bar">
        <div class="ui-code-block__context">
          {path ? <strong class="ui-code-block__path">{path}</strong> : null}
          <span class="ui-code-block__language">{language ?? label}</span>
        </div>
        <button
          class="ui-code-block__copy"
          onClick={() => void copyCode()}
          type="button"
        >
          {copied ? t('markdown.copied') : t('markdown.copy')}
        </button>
      </div>
      <pre>
        <code class={language ? `language-${language}` : undefined}>
          {lines.map((line, index) => {
            const lineNumber = index + 1;
            return (
              <span
                class={classNames(
                  'ui-code-block__line',
                  focusLines.includes(lineNumber) &&
                    'ui-code-block__line--focused',
                )}
                key={`${lineNumber}-${line}`}
              >
                <span aria-hidden="true" class="ui-code-block__line-number">
                  {lineNumber}
                </span>
                <span class="ui-code-block__line-content">{line || ' '}</span>
                {index < lines.length - 1 ? '\n' : null}
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}

function MarkdownImageBlock({ image }: { image: MarkdownImage }) {
  const source = getSafeImageSource(image.source);
  if (!source) return <p class="ui-image-fallback">{image.alt}</p>;
  return (
    <figure class="ui-markdown-figure">
      <div
        aria-label={image.alt}
        class="ui-markdown-figure__viewport"
        role="region"
        tabIndex={0}
      >
        <img
          alt={image.alt}
          class="ui-markdown-image"
          decoding="async"
          loading="lazy"
          src={source}
        />
      </div>
      {image.title ? <figcaption>{image.title}</figcaption> : null}
    </figure>
  );
}

function MarkdownTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div
      aria-label={headers.join(', ')}
      class="ui-markdown-table"
      role="region"
      tabIndex={0}
    >
      <table>
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={`header-${index}`} scope="col">
                {renderInline(header)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`cell-${rowIndex}-${cellIndex}`}>
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkdownHeading({
  content,
  level,
}: {
  content: string;
  level: number;
}) {
  const children = renderInline(content);
  if (level === 2) return <h2>{children}</h2>;
  if (level === 3) return <h3>{children}</h3>;
  if (level === 4) return <h4>{children}</h4>;
  if (level === 5) return <h5>{children}</h5>;
  return <h6>{children}</h6>;
}

export function SafeMarkdown({
  class: className,
  content,
  headingStartLevel = 2,
  omitFirstHeadingWhenEqual,
}: SafeMarkdownProps) {
  const blocks = parseBlocks(content);
  const firstHeadingIndex = blocks.findIndex(
    (block) => block.type === 'heading',
  );
  const omittedHeadingIndex =
    firstHeadingIndex >= 0 &&
    omitFirstHeadingWhenEqual !== undefined &&
    toPlainMarkdownHeading(
      (blocks[firstHeadingIndex] as Extract<MarkdownBlock, { type: 'heading' }>)
        .content,
    ) === toPlainMarkdownHeading(omitFirstHeadingWhenEqual)
      ? firstHeadingIndex
      : -1;
  const renderedHeadingStartLevel =
    omittedHeadingIndex >= 0
      ? Math.max(2, headingStartLevel - 1)
      : headingStartLevel;
  const firstHeadingLevel = blocks.reduce<number | null>(
    (lowestLevel, block) =>
      block.type === 'heading'
        ? Math.min(lowestLevel ?? block.level, block.level)
        : lowestLevel,
    null,
  );

  return (
    <div class={classNames('ui-prose', className)}>
      {blocks.map((block, index) => {
        if (index === omittedHeadingIndex) return null;
        if (block.type === 'code') {
          return (
            <MarkdownCodeBlock
              content={block.content}
              focusLines={block.focusLines}
              key={`code-${index}`}
              language={block.language}
              path={block.path}
            />
          );
        }
        if (block.type === 'heading') {
          return (
            <MarkdownHeading
              content={block.content}
              key={`heading-${index}`}
              level={Math.min(
                6,
                renderedHeadingStartLevel +
                  block.level -
                  (firstHeadingLevel ?? block.level),
              )}
            />
          );
        }
        if (block.type === 'image') {
          return (
            <MarkdownImageBlock image={block.image} key={`image-${index}`} />
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
        if (block.type === 'table') {
          return (
            <MarkdownTable
              headers={block.headers}
              key={`table-${index}`}
              rows={block.rows}
            />
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
