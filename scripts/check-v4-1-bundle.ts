import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

interface BundleBaseline {
  bundle: {
    initial: {
      budgetsGzipBytes: BundleSizes;
    };
    totalDiagnostic: {
      warningThresholdsGzipBytes: BundleSizes;
    };
  };
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
const initialJavaScriptAssets = measureAssets(initialFiles, '.js');
const initialCssAssets = measureAssets(initialFiles, '.css');
const totalJavaScriptAssets = measureAssets(emittedFiles, '.js');
const totalCssAssets = measureAssets(emittedFiles, '.css');
const initialJavaScriptTotal = totalGzipBytes(initialJavaScriptAssets);
const initialCssTotal = totalGzipBytes(initialCssAssets);
const totalJavaScript = totalGzipBytes(totalJavaScriptAssets);
const totalCss = totalGzipBytes(totalCssAssets);
const { budgetsGzipBytes } = baseline.bundle.initial;
const { warningThresholdsGzipBytes } = baseline.bundle.totalDiagnostic;

printAssets('Initial JavaScript assets', initialJavaScriptAssets);
printAssets('Initial CSS assets', initialCssAssets);
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
