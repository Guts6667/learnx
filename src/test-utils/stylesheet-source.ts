import { readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';

const importPattern =
  /^[\t ]*@import[\t ]+(['"])([^'"]+)\1[\t ]*;[\t ]*$/gmu;

export interface StylesheetSourceGraph {
  files: string[];
  packageImports: string[];
  source: string;
}

function repositoryPath(path: string): string {
  return relative(process.cwd(), path).split(sep).join('/');
}

export function readStylesheetSourceGraph(entryPath: string): StylesheetSourceGraph {
  const files: string[] = [];
  const packageImports: string[] = [];
  const visited = new Set<string>();
  const active = new Set<string>();

  function visit(path: string): string {
    const absolutePath = resolve(path);
    const displayPath = repositoryPath(absolutePath);

    if (active.has(absolutePath)) {
      throw new Error(`Circular stylesheet import detected at ${displayPath}`);
    }

    if (visited.has(absolutePath)) {
      throw new Error(`Duplicate stylesheet import detected at ${displayPath}`);
    }

    active.add(absolutePath);
    visited.add(absolutePath);
    files.push(displayPath);

    const source = readFileSync(absolutePath, 'utf8').replace(
      importPattern,
      (statement, _quote: string, specifier: string) => {
        if (!specifier.startsWith('.')) {
          packageImports.push(specifier);
          return statement;
        }

        return visit(resolve(dirname(absolutePath), specifier)).replace(/\n$/u, '');
      },
    );

    active.delete(absolutePath);
    return source;
  }

  return {
    files,
    packageImports,
    source: visit(entryPath),
  };
}
