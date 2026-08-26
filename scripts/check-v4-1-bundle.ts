import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

interface BundleBaseline {
  bundle: {
    budgetsGzipBytes: {
      css: number;
      javascript: number;
    };
  };
}

interface SizedAsset {
  gzipBytes: number;
  path: string;
}

const projectRoot = process.cwd();
const distRoot = resolve(projectRoot, 'dist');
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

function printAssets(label: string, assets: SizedAsset[]): void {
  console.log(`${label}:`);
  for (const asset of assets) {
    console.log(`  ${asset.path}: ${asset.gzipBytes} bytes gzip`);
  }
}

if (!existsSync(distRoot) || !statSync(distRoot).isDirectory()) {
  throw new Error('dist is missing. Run pnpm build before the bundle gate.');
}

const baseline = JSON.parse(
  readFileSync(baselinePath, 'utf8'),
) as BundleBaseline;
const emittedFiles = collectFiles(distRoot);
const javascriptAssets = measureAssets(emittedFiles, '.js');
const cssAssets = measureAssets(emittedFiles, '.css');
const javascriptTotal = totalGzipBytes(javascriptAssets);
const cssTotal = totalGzipBytes(cssAssets);
const { budgetsGzipBytes } = baseline.bundle;

printAssets('JavaScript assets', javascriptAssets);
printAssets('CSS assets', cssAssets);
console.log(
  `JavaScript total: ${javascriptTotal}/${budgetsGzipBytes.javascript} bytes gzip`,
);
console.log(`CSS total: ${cssTotal}/${budgetsGzipBytes.css} bytes gzip`);

const failures: string[] = [];
if (javascriptTotal > budgetsGzipBytes.javascript) {
  failures.push(
    `JavaScript exceeds its budget by ${javascriptTotal - budgetsGzipBytes.javascript} bytes.`,
  );
}
if (cssTotal > budgetsGzipBytes.css) {
  failures.push(
    `CSS exceeds its budget by ${cssTotal - budgetsGzipBytes.css} bytes.`,
  );
}

if (failures.length > 0) {
  throw new Error(failures.join('\n'));
}
