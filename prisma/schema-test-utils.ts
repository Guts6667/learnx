import { readFileSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function schemaFiles(root: string): string[] {
  const prismaRoot = resolve(root, 'prisma');
  const modelsRoot = resolve(prismaRoot, 'models');

  return [
    resolve(prismaRoot, 'schema.prisma'),
    ...readdirSync(modelsRoot)
      .filter((file) => file.endsWith('.prisma'))
      .sort()
      .map((file) => resolve(modelsRoot, file)),
  ];
}

export function readPrismaSchemaSync(root = process.cwd()): string {
  return schemaFiles(root)
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
}

export async function readPrismaSchema(root = process.cwd()): Promise<string> {
  return (
    await Promise.all(schemaFiles(root).map((file) => readFile(file, 'utf8')))
  ).join('\n');
}
