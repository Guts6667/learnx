import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

import ts from 'typescript';

import {
  importBoundaryFailures,
  type ImportBoundaryConfiguration,
  type ProjectImportEdge,
} from '../src/lib/v4-1-import-boundaries.ts';

type QualityMode = 'baseline' | 'final' | 'report';

interface ImportBaseline {
  imports: {
    knownCycles: string[];
    preactImportingFiles: number;
    preactManifestPackages: string[];
  };
}

interface PackageManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const projectRoot = process.cwd();
const ignoredDirectories = new Set([
  '.git',
  'coverage',
  'dist',
  'generated',
  'node_modules',
  'playwright-report',
  'test-results',
]);
const sourceDirectories = ['api', 'prisma', 'scripts', 'src', 'tests'];
const sourceExtensions = new Set(['.ts', '.tsx']);

function readMode(arguments_: string[]): QualityMode {
  const modeIndex = arguments_.findIndex((argument) => argument === '--mode');
  const inlineMode = arguments_
    .find((argument) => argument.startsWith('--mode='))
    ?.slice('--mode='.length);
  const mode =
    inlineMode ?? (modeIndex >= 0 ? arguments_[modeIndex + 1] : undefined);
  if (mode === 'baseline' || mode === 'final' || mode === 'report') {
    return mode;
  }
  throw new Error('Expected --mode baseline, --mode final, or --mode report.');
}

function collectTypeScriptFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      return [];
    }
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectTypeScriptFiles(path);
    }
    return sourceExtensions.has(extname(path)) && !path.endsWith('.d.ts')
      ? [resolve(path)]
      : [];
  });
}

function normalizeProjectPath(path: string): string {
  return relative(projectRoot, path).split('\\').join('/');
}

function findModuleSpecifiers(sourceFile: ts.SourceFile): string[] {
  const specifiers: string[] = [];
  sourceFile.forEachChild((node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
  });
  return specifiers;
}

function resolveProjectModule(
  containingFile: string,
  specifier: string,
  projectFiles: Set<string>,
): string | undefined {
  let basePath: string;
  if (specifier.startsWith('@/')) {
    basePath = resolve(projectRoot, 'src', specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    basePath = resolve(dirname(containingFile), specifier);
  } else {
    return undefined;
  }

  const extensionlessBase = basePath.replace(/\.(?:js|jsx|mjs)$/, '');
  const candidates = [
    basePath,
    `${extensionlessBase}.ts`,
    `${extensionlessBase}.tsx`,
    join(extensionlessBase, 'index.ts'),
    join(extensionlessBase, 'index.tsx'),
  ].map((candidate) => resolve(candidate));
  return candidates.find((candidate) => projectFiles.has(candidate));
}

function isPreactSpecifier(specifier: string): boolean {
  return (
    specifier === 'preact' ||
    specifier.startsWith('preact/') ||
    specifier === 'preact-router' ||
    specifier.startsWith('preact-router/') ||
    specifier.startsWith('@preact/') ||
    specifier === '@testing-library/preact' ||
    specifier === 'vite-plugin-pwa/preact'
  );
}

function isReactSpecifier(specifier: string): boolean {
  return specifier === 'react' || specifier.startsWith('react/');
}

function findCycles(graph: Map<string, Set<string>>): string[] {
  let nextIndex = 0;
  const indexes = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycles: string[] = [];

  function requiredIndex(
    indexMap: Map<string, number>,
    modulePath: string,
  ): number {
    const index = indexMap.get(modulePath);
    if (index === undefined) {
      throw new Error(`Missing graph index for ${modulePath}.`);
    }
    return index;
  }

  function visit(modulePath: string): void {
    const moduleIndex = nextIndex;
    nextIndex += 1;
    indexes.set(modulePath, moduleIndex);
    lowLinks.set(modulePath, moduleIndex);
    stack.push(modulePath);
    onStack.add(modulePath);

    for (const dependency of graph.get(modulePath) ?? []) {
      if (!indexes.has(dependency)) {
        visit(dependency);
        lowLinks.set(
          modulePath,
          Math.min(
            requiredIndex(lowLinks, modulePath),
            requiredIndex(lowLinks, dependency),
          ),
        );
      } else if (onStack.has(dependency)) {
        lowLinks.set(
          modulePath,
          Math.min(
            requiredIndex(lowLinks, modulePath),
            requiredIndex(indexes, dependency),
          ),
        );
      }
    }

    if (lowLinks.get(modulePath) !== indexes.get(modulePath)) {
      return;
    }
    const component: string[] = [];
    let member: string;
    do {
      const poppedMember = stack.pop();
      if (poppedMember === undefined) {
        throw new Error(`Invalid empty graph stack at ${modulePath}.`);
      }
      member = poppedMember;
      onStack.delete(member);
      component.push(member);
    } while (member !== modulePath);

    const onlyMember = component.length === 1 ? component[0] : undefined;
    const hasSelfCycle =
      onlyMember !== undefined && graph.get(onlyMember)?.has(onlyMember);
    if (component.length > 1 || hasSelfCycle) {
      cycles.push(component.sort().join(' -> '));
    }
  }

  for (const modulePath of [...graph.keys()].sort()) {
    if (!indexes.has(modulePath)) {
      visit(modulePath);
    }
  }
  return cycles.sort();
}

const mode = readMode(process.argv.slice(2));
const baseline = JSON.parse(
  readFileSync(resolve(projectRoot, 'quality/v4-1-baseline.json'), 'utf8'),
) as ImportBaseline;
const boundaryConfiguration = JSON.parse(
  readFileSync(
    resolve(projectRoot, 'quality/v4-1-import-boundaries.json'),
    'utf8',
  ),
) as ImportBoundaryConfiguration;
const packageManifest = JSON.parse(
  readFileSync(resolve(projectRoot, 'package.json'), 'utf8'),
) as PackageManifest;
const rootTypeScriptFiles = readdirSync(projectRoot, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isFile() &&
      sourceExtensions.has(extname(entry.name)) &&
      !entry.name.endsWith('.d.ts'),
  )
  .map((entry) => resolve(projectRoot, entry.name));
const files = [
  ...sourceDirectories.flatMap((directory) =>
    collectTypeScriptFiles(resolve(projectRoot, directory)),
  ),
  ...rootTypeScriptFiles,
].sort();
const projectFiles = new Set(files);
const graph = new Map<string, Set<string>>();
const preactImports = new Map<string, Set<string>>();
const reactImports = new Map<string, Set<string>>();
let staticProjectEdges = 0;
const projectImportEdges: ProjectImportEdge[] = [];

for (const file of files) {
  const normalizedFile = normalizeProjectPath(file);
  const sourceFile = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    false,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const dependencies = new Set<string>();
  for (const specifier of findModuleSpecifiers(sourceFile)) {
    if (isPreactSpecifier(specifier)) {
      const imports = preactImports.get(normalizedFile) ?? new Set<string>();
      imports.add(specifier);
      preactImports.set(normalizedFile, imports);
    }
    if (isReactSpecifier(specifier)) {
      const imports = reactImports.get(normalizedFile) ?? new Set<string>();
      imports.add(specifier);
      reactImports.set(normalizedFile, imports);
    }
    const dependency = resolveProjectModule(file, specifier, projectFiles);
    if (dependency) {
      const normalizedDependency = normalizeProjectPath(dependency);
      dependencies.add(normalizedDependency);
      projectImportEdges.push({
        from: normalizedFile,
        to: normalizedDependency,
      });
    }
  }
  staticProjectEdges += dependencies.size;
  graph.set(normalizedFile, dependencies);
}

const manifestPackages = {
  ...packageManifest.dependencies,
  ...packageManifest.devDependencies,
};
const preactManifestPackages = Object.keys(manifestPackages)
  .filter((packageName) => isPreactSpecifier(packageName))
  .sort();
const cycles = findCycles(graph);
const boundaryFailures = importBoundaryFailures(
  boundaryConfiguration,
  projectImportEdges,
);

console.log(`TypeScript files: ${files.length}`);
console.log(`Static project import/export edges: ${staticProjectEdges}`);
console.log(`Files importing Preact APIs: ${preactImports.size}`);
console.log(`Files importing React APIs: ${reactImports.size}`);
console.log(
  `Preact manifest packages: ${preactManifestPackages.join(', ') || 'none'}`,
);
console.log(`Project cycles: ${cycles.length}`);
console.log(`Forbidden import-boundary edges: ${boundaryFailures.length}`);

for (const [file, specifiers] of [...preactImports].sort(([left], [right]) =>
  left.localeCompare(right),
)) {
  console.log(`  Preact ${file}: ${[...specifiers].sort().join(', ')}`);
}
for (const [file, specifiers] of [...reactImports].sort(([left], [right]) =>
  left.localeCompare(right),
)) {
  console.log(`  React ${file}: ${[...specifiers].sort().join(', ')}`);
}
for (const cycle of cycles) {
  console.log(`  Cycle: ${cycle}`);
}
for (const boundaryFailure of boundaryFailures) {
  console.log(`  Boundary: ${boundaryFailure}`);
}

if (mode === 'report') {
  process.exit(0);
}

const failures: string[] = [];
failures.push(...boundaryFailures);
const newCycles = cycles.filter(
  (cycle) => !baseline.imports.knownCycles.includes(cycle),
);
if (newCycles.length > 0) {
  failures.push(`New project cycles: ${newCycles.join('; ')}`);
}

if (mode === 'baseline') {
  if (preactImports.size > baseline.imports.preactImportingFiles) {
    failures.push(
      `Preact import footprint grew from ${baseline.imports.preactImportingFiles} to ${preactImports.size} files.`,
    );
  }
  const newPreactPackages = preactManifestPackages.filter(
    (packageName) =>
      !baseline.imports.preactManifestPackages.includes(packageName),
  );
  if (newPreactPackages.length > 0) {
    failures.push(`New Preact packages: ${newPreactPackages.join(', ')}`);
  }
} else {
  if (preactImports.size > 0) {
    failures.push(
      `Final V4.1 gate still has ${preactImports.size} Preact import files.`,
    );
  }
  if (preactManifestPackages.length > 0) {
    failures.push(
      `Final V4.1 gate still has Preact packages: ${preactManifestPackages.join(', ')}.`,
    );
  }
  if (cycles.length > 0) {
    failures.push(`Final V4.1 gate still has ${cycles.length} project cycles.`);
  }
}

if (failures.length > 0) {
  throw new Error(failures.join('\n'));
}
