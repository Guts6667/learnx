import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

interface BundleBaseline {
  bundle: {
    asyncChunk: RegressionBudget & {
      exempt?: {
        filePrefixes: string[];
        maxGzipBytes: number;
        reason: string;
      };
      maiaFoundationObservedMaxGzipBytes?: number;
      observedMaxGzipBytes: number;
    };
    initial: {
      budgetsGzipBytes: BundleSizes;
    };
    pwaPrecache: RegressionBudget & {
      observedBytes: number;
      observedEntries: number;
    };
    totalDiagnostic: {
      warningThresholdsGzipBytes: BundleSizes;
    };
  };
}

interface RegressionBudget {
  maxRegressionPercent: number;
}

interface BundleSizes {
  css: number;
  javascript: number;
}

interface SizedAsset {
  gzipBytes: number;
  path: string;
}

interface ViteManifestChunk {
  css?: string[];
  file: string;
  imports?: string[];
  isEntry?: boolean;
}

type ViteManifest = Record<string, ViteManifestChunk>;

const projectRoot = process.cwd();
const distRoot = resolve(projectRoot, 'dist');
const manifestPath = resolve(distRoot, '.vite/manifest.json');
const baselinePath = resolve(projectRoot, 'quality/v4-1-baseline.json');

function collectFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  });
}

function measureAssets(
  files: string[],
  extension: '.css' | '.js',
): SizedAsset[] {
  return files
    .filter((file) => extname(file) === extension)
    .map((file) => ({
      gzipBytes: gzipSync(readFileSync(file), { level: 9 }).byteLength,
      path: relative(projectRoot, file),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function totalGzipBytes(assets: SizedAsset[]): number {
  return assets.reduce((total, asset) => total + asset.gzipBytes, 0);
}

function resolveEmittedFile(relativePath: string): string {
  const path = resolve(distRoot, relativePath);
  if (path !== distRoot && !path.startsWith(`${distRoot}${sep}`)) {
    throw new Error(`Manifest asset escapes dist: ${relativePath}.`);
  }
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`Manifest asset is missing: ${relativePath}.`);
  }
  return path;
}

function collectInitialFiles(manifest: ViteManifest): string[] {
  const entryKeys = Object.entries(manifest)
    .filter(([, chunk]) => chunk.isEntry === true)
    .map(([key]) => key)
    .sort();
  if (entryKeys.length === 0) {
    throw new Error('The Vite manifest has no initial entry.');
  }

  const visitedChunks = new Set<string>();
  const emittedFiles = new Set<string>();

  function visitChunk(key: string): void {
    if (visitedChunks.has(key)) {
      return;
    }
    const chunk = manifest[key];
    if (!chunk) {
      throw new Error(`Vite manifest is missing imported chunk ${key}.`);
    }
    visitedChunks.add(key);
    emittedFiles.add(resolveEmittedFile(chunk.file));
    for (const cssFile of chunk.css ?? []) {
      emittedFiles.add(resolveEmittedFile(cssFile));
    }
    for (const importedChunk of chunk.imports ?? []) {
      visitChunk(importedChunk);
    }
  }

  for (const entryKey of entryKeys) {
    visitChunk(entryKey);
  }

  console.log(`Vite initial entries: ${entryKeys.join(', ')}`);
  return [...emittedFiles].sort();
}

function allowedRegression(
  observed: number,
  maxRegressionPercent: number,
): number {
  return Math.floor(observed * (1 + maxRegressionPercent / 100));
}

function collectAsyncJavaScriptFiles(
  manifest: ViteManifest,
  initialFiles: string[],
): string[] {
  const initial = new Set(initialFiles);
  return [
    ...new Set(
      Object.values(manifest)
        .map((chunk) => resolveEmittedFile(chunk.file))
        .filter((file) => extname(file) === '.js' && !initial.has(file)),
    ),
  ].sort();
}

function measurePwaPrecache(): { bytes: number; entries: number } {
  const serviceWorkerPath = resolve(distRoot, 'sw.js');
  if (!existsSync(serviceWorkerPath)) {
    throw new Error('The production service worker is missing.');
  }
  const serviceWorker = readFileSync(serviceWorkerPath, 'utf8');
  const manifestMatch = /precacheAndRoute\(\[(.*?)\],\{\}\)/su.exec(
    serviceWorker,
  );
  if (!manifestMatch?.[1]) {
    throw new Error('The Workbox precache manifest cannot be read.');
  }
  const urls = [...manifestMatch[1].matchAll(/url:"([^"]+)"/gu)].map(
    (match) => match[1],
  );
  if (urls.length === 0) {
    throw new Error('The Workbox precache manifest is empty.');
  }

  let bytes = 0;
  for (const url of urls) {
    const normalizedUrl = url.split('?')[0]?.replace(/^\//u, '');
    if (!normalizedUrl) {
      throw new Error(`Invalid Workbox precache URL: ${url}.`);
    }
    bytes += statSync(resolveEmittedFile(normalizedUrl)).size;
  }
  return { bytes, entries: urls.length };
}

function printAssets(label: string, assets: SizedAsset[]): void {
  console.log(`${label}:`);
  for (const asset of assets) {
    console.log(`  ${asset.path}: ${asset.gzipBytes} bytes gzip`);
  }
}

if (!existsSync(distRoot) || !statSync(distRoot).isDirectory()) {
  throw new Error('dist is missing. Run pnpm build before the bundle gate.');
}
if (!existsSync(manifestPath)) {
  throw new Error('The Vite build manifest is missing. Run pnpm build first.');
}

const baseline = JSON.parse(
  readFileSync(baselinePath, 'utf8'),
) as BundleBaseline;
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ViteManifest;
const emittedFiles = collectFiles(distRoot);
const initialFiles = collectInitialFiles(manifest);
const asyncJavaScriptFiles = collectAsyncJavaScriptFiles(
  manifest,
  initialFiles,
);
const initialJavaScriptAssets = measureAssets(initialFiles, '.js');
const initialCssAssets = measureAssets(initialFiles, '.css');
const asyncJavaScriptAssets = measureAssets(asyncJavaScriptFiles, '.js');
const totalJavaScriptAssets = measureAssets(emittedFiles, '.js');
const totalCssAssets = measureAssets(emittedFiles, '.css');
const initialJavaScriptTotal = totalGzipBytes(initialJavaScriptAssets);
const initialCssTotal = totalGzipBytes(initialCssAssets);
const totalJavaScript = totalGzipBytes(totalJavaScriptAssets);
const totalCss = totalGzipBytes(totalCssAssets);
// A chunk may be exempt from the route budget without being unmeasured: the
// exemption exists because the budget below asks "is a route getting fat?",
// and a chunk that is not a route cannot answer it. Exempt chunks get their
// own explicit ceiling instead, so the exemption is a different question, not
// the absence of one.
const exemptAsyncChunks = baseline.bundle.asyncChunk.exempt;
const isExempt = (file: string): boolean =>
  (exemptAsyncChunks?.filePrefixes ?? []).some((prefix) =>
    file.split(sep).pop()?.startsWith(prefix),
  );

const routeAsyncJavaScriptAssets = asyncJavaScriptAssets.filter(
  (asset) => !isExempt(asset.path),
);
const exemptAsyncJavaScriptAssets = asyncJavaScriptAssets.filter((asset) =>
  isExempt(asset.path),
);
const largestAsyncJavaScript = [...routeAsyncJavaScriptAssets].sort(
  (left, right) => right.gzipBytes - left.gzipBytes,
)[0];
const pwaPrecache = measurePwaPrecache();
const { budgetsGzipBytes } = baseline.bundle.initial;
const asyncChunkReference = Math.max(
  baseline.bundle.asyncChunk.observedMaxGzipBytes,
  baseline.bundle.asyncChunk.maiaFoundationObservedMaxGzipBytes ?? 0,
);
const asyncChunkBudget = allowedRegression(
  asyncChunkReference,
  baseline.bundle.asyncChunk.maxRegressionPercent,
);
const pwaEntryBudget = allowedRegression(
  baseline.bundle.pwaPrecache.observedEntries,
  baseline.bundle.pwaPrecache.maxRegressionPercent,
);
const pwaByteBudget = allowedRegression(
  baseline.bundle.pwaPrecache.observedBytes,
  baseline.bundle.pwaPrecache.maxRegressionPercent,
);
const { warningThresholdsGzipBytes } = baseline.bundle.totalDiagnostic;

printAssets('Initial JavaScript assets', initialJavaScriptAssets);
printAssets('Initial CSS assets', initialCssAssets);
printAssets('Lazy JavaScript assets', asyncJavaScriptAssets);
console.log(
  `Initial JavaScript: ${initialJavaScriptTotal}/${budgetsGzipBytes.javascript} bytes gzip`,
);
console.log(
  `Initial CSS: ${initialCssTotal}/${budgetsGzipBytes.css} bytes gzip`,
);
console.log(
  `Total JavaScript diagnostic: ${totalJavaScript}/${warningThresholdsGzipBytes.javascript} bytes gzip`,
);
console.log(
  `Total CSS diagnostic: ${totalCss}/${warningThresholdsGzipBytes.css} bytes gzip`,
);
console.log(
  `Largest lazy JavaScript: ${largestAsyncJavaScript?.gzipBytes ?? 0}/${asyncChunkBudget} bytes gzip`,
);
for (const asset of exemptAsyncJavaScriptAssets) {
  console.log(
    `Exempt lazy JavaScript: ${asset.path} ${asset.gzipBytes}/${exemptAsyncChunks?.maxGzipBytes ?? 0} bytes gzip`,
  );
}
console.log(`PWA precache entries: ${pwaPrecache.entries}/${pwaEntryBudget}`);
console.log(`PWA precache bytes: ${pwaPrecache.bytes}/${pwaByteBudget}`);

const failures: string[] = [];
if (initialJavaScriptTotal > budgetsGzipBytes.javascript) {
  failures.push(
    `Initial JavaScript exceeds its budget by ${initialJavaScriptTotal - budgetsGzipBytes.javascript} bytes.`,
  );
}
if (initialCssTotal > budgetsGzipBytes.css) {
  failures.push(
    `Initial CSS exceeds its budget by ${initialCssTotal - budgetsGzipBytes.css} bytes.`,
  );
}
if ((largestAsyncJavaScript?.gzipBytes ?? 0) > asyncChunkBudget) {
  failures.push(
    `Largest lazy JavaScript chunk exceeds its regression budget by ${(largestAsyncJavaScript?.gzipBytes ?? 0) - asyncChunkBudget} bytes.`,
  );
}
for (const asset of exemptAsyncJavaScriptAssets) {
  if (asset.gzipBytes > (exemptAsyncChunks?.maxGzipBytes ?? 0)) {
    failures.push(
      `Exempt lazy chunk ${asset.path} exceeds its own ceiling by ${asset.gzipBytes - (exemptAsyncChunks?.maxGzipBytes ?? 0)} bytes.`,
    );
  }
}
if (pwaPrecache.entries > pwaEntryBudget) {
  failures.push(
    `PWA precache contains ${pwaPrecache.entries - pwaEntryBudget} entries above its regression budget.`,
  );
}
if (pwaPrecache.bytes > pwaByteBudget) {
  failures.push(
    `PWA precache exceeds its regression budget by ${pwaPrecache.bytes - pwaByteBudget} bytes.`,
  );
}

if (totalJavaScript > warningThresholdsGzipBytes.javascript) {
  console.warn(
    `Total JavaScript exceeds its non-blocking diagnostic threshold by ${totalJavaScript - warningThresholdsGzipBytes.javascript} bytes.`,
  );
}
if (totalCss > warningThresholdsGzipBytes.css) {
  console.warn(
    `Total CSS exceeds its non-blocking diagnostic threshold by ${totalCss - warningThresholdsGzipBytes.css} bytes.`,
  );
}

if (failures.length > 0) {
  throw new Error(failures.join('\n'));
}
