export interface ImportBoundaryConfiguration {
  rules: ImportBoundaryRule[];
  schemaVersion: number;
}

interface ImportBoundaryRule {
  disallow: string;
  from: string;
  message: string;
}

export interface ProjectImportEdge {
  from: string;
  to: string;
}

export function importBoundaryFailures(
  configuration: ImportBoundaryConfiguration,
  edges: ProjectImportEdge[],
): string[] {
  const failures: string[] = [];

  for (const rule of configuration.rules) {
    let fromPattern: RegExp;
    let disallowedPattern: RegExp;
    try {
      fromPattern = new RegExp(rule.from, 'u');
      disallowedPattern = new RegExp(rule.disallow, 'u');
    } catch {
      failures.push(`Invalid import-boundary rule: ${rule.message}`);
      continue;
    }

    for (const edge of edges) {
      if (fromPattern.test(edge.from) && disallowedPattern.test(edge.to)) {
        failures.push(`${edge.from} -> ${edge.to}: ${rule.message}`);
      }
    }
  }

  return [...new Set(failures)].sort();
}
