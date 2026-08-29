import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, statSync } from 'node:fs';

/**
 * Fails when a CSS class is defined but never referenced from application code.
 *
 * knip covers dead JavaScript; nothing covered dead CSS, which is how
 * `.landing-proof-list`, four `.totem-auth-page` overrides for Tailwind classes
 * that no longer existed, and a broken forced-colors rule survived. That last
 * one mattered: `accessibility.css` styled `.ui-progress__fill` while the
 * component renders `.ui-progress__bar`, so the high-contrast accommodation had
 * never applied.
 */

const root = fileURLToPath(new URL('..', import.meta.url));

/**
 * Class name prefixes assembled at runtime, so a literal search cannot see
 * them. Each entry names the file that builds it. Add to this list only with
 * the construction site, never to silence a finding.
 */
const DYNAMIC_PREFIXES: { prefix: string; builtIn: string }[] = [
  { prefix: 'ui-state-panel--', builtIn: 'src/components/ui/StatePanel.tsx' },
  { prefix: 'ui-dialog-content--', builtIn: 'src/components/ui/Dialog.tsx' },
];

function walk(directory: string, extensions: string[]): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return walk(path, extensions);
    return extensions.some((extension) => path.endsWith(extension))
      ? [path]
      : [];
  });
}

const stylesheets = walk(join(root, 'src/styles'), ['.css']);
const consumers = [
  ...walk(join(root, 'src'), ['.ts', '.tsx']),
  ...walk(join(root, 'tests/e2e'), ['.ts']),
  join(root, 'index.html'),
];

const consumed = consumers.map((path) => readFileSync(path, 'utf8')).join('\n');

const definitions = new Map<string, string>();
for (const path of stylesheets) {
  const source = readFileSync(path, 'utf8');
  for (const match of source.matchAll(/(?<![\w-])\.([a-zA-Z][\w-]*)/g)) {
    const name = match[1];
    if (!definitions.has(name)) definitions.set(name, relative(root, path));
  }
}

const unused = [...definitions.entries()]
  .filter(([name]) => !consumed.includes(name))
  .filter(
    ([name]) => !DYNAMIC_PREFIXES.some(({ prefix }) => name.startsWith(prefix)),
  );

if (unused.length > 0) {
  console.error(
    `Dead CSS: ${unused.length} class(es) defined but never referenced.\n`,
  );
  for (const [name, path] of unused) console.error(`  .${name}  ${path}`);
  console.error(
    '\nDelete the rule, or add its prefix to DYNAMIC_PREFIXES with the file' +
      ' that builds it if the name is assembled at runtime.',
  );
  process.exit(1);
}

console.log(
  `Dead CSS: none. ${definitions.size} classes defined, ` +
    `${DYNAMIC_PREFIXES.length} dynamic prefixes allowed.`,
);
